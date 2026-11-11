import { Inject, Injectable, Logger } from '@nestjs/common';
import { canHoldAssignment, ROLE_LABEL, USER_STATUS_LABEL, type AccountRole, type UserStatus } from '@lotrinh/shared';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { ExternalIdentity } from '../../adapters/identity/identity.service';
import { ClockService } from '../../adapters/clock/clock.service';
import { forbidden } from '../../common/errors';
import type { SessionUser } from '../../common/session';
import { env } from '../../config';
import type { Db, Tx } from '../../db/client';
import { DB } from '../../db/db.provider';
import { isUniqueViolation } from '../../db/mssql';
import { areas, staff, stores, users, userScopes } from '../../db/schema';
import { areaScopeRows, replaceScopes, storeScopeRows } from '../../db/scopes';
import { logUserChanges, type UserChange } from '../audit/user-changes';
import { NotificationsService } from '../notifications/notifications.service';
import { activeAssignmentsOf } from '../runs/assignments';

/** Thứ tự ưu tiên khi một người có nhiều chức danh ở Web A */
const ROLE_RANK: Record<AccountRole, number> = { bp: 4, qlkv: 3, cht: 2, nv: 1 };

/** Chức danh Web A → vai trò module theo HOST_ROLE_MAP; nhiều chức danh lấy vai trò cao nhất; null nếu không map được */
export function roleFromTitles(titles: string[], roleMap: Record<string, string> = JSON.parse(env().HOST_ROLE_MAP)): AccountRole | null {
  const roles = titles.map((t) => roleMap[t]).filter((r): r is AccountRole => r === 'bp' || r === 'qlkv' || r === 'cht' || r === 'nv');
  return roles.sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0] ?? null;
}

export interface DirectorySyncResult {
  seen: number;
  created: number;
  updated: number;
  left: number;
  skipped: number;
}

/**
 * Đồng bộ người dùng từ Web A (nguồn chuẩn của danh tính, vai trò, phạm vi, trạng thái nghỉ việc).
 * Khớp theo external_id rồi mã nhân viên; không tự khớp theo email. Phân công theo lượt (Buddy, CHT, QLKV
 * của từng lượt) vẫn do module quản lý.
 */
@Injectable()
export class UserSyncService {
  private readonly logger = new Logger('UserSync');

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Đồng bộ một người khi họ vào module; trả về người dùng của phiên, hoặc ném 403 */
  async ensure(identity: ExternalIdentity): Promise<SessionUser> {
    const role = roleFromTitles(identity.titles);
    let result: { user: SessionUser; created: boolean; lostAssignments: string[] };
    try {
      result = await this.db.transaction((tx) => this.upsert(tx, identity, role));
    } catch (err) {
      // Hai request đầu tiên của cùng một người chạy song song: người sau gặp trùng khóa thì đọc lại
      if (!isUniqueViolation(err)) throw err;
      result = await this.db.transaction((tx) => this.upsert(tx, identity, role));
    }
    if (result.lostAssignments.length) await this.alertHandover(result.user, result.lostAssignments);
    if (!identity.active) throw forbidden('ACCOUNT_INACTIVE', 'Tài khoản đã ngừng hoạt động ở hệ thống chính');
    if (!role) throw forbidden('NO_MODULE_ACCESS', 'Chức danh của bạn chưa được cấp quyền dùng Lộ trình. Liên hệ BP Đào tạo');
    return result.user;
  }

  private async findExisting(tx: Tx, identity: ExternalIdentity) {
    const [byExternal] = await tx.select().from(users).where(eq(users.externalId, identity.externalId));
    if (byExternal) return byExternal;
    const [byCode] = await tx.select().from(users).where(eq(users.employeeCode, identity.employeeCode));
    if (byCode && byCode.externalId && byCode.externalId !== identity.externalId) {
      // Mã nhân viên đã gắn với một người khác ở Web A: không tự gộp
      throw forbidden('IDENTITY_CONFLICT', `Mã nhân viên ${identity.employeeCode} đã gắn với tài khoản khác. Liên hệ BP Đào tạo`);
    }
    return byCode ?? null;
  }

  private async upsert(tx: Tx, identity: ExternalIdentity, role: AccountRole | null) {
    const now = await this.clock.now();
    const existing = await this.findExisting(tx, identity);
    const status: UserStatus = identity.active ? 'active' : 'left';
    const { storeIds, areaIds } = await this.scopeIds(tx, role, identity);

    if (!existing) {
      if (!identity.active || !role) return { user: this.sessionOf({ id: 0, role: role ?? 'nv', status, fullName: identity.fullName, email: identity.email, canBuddy: false, lastSeenAt: null }), created: false, lostAssignments: [] };
      if (env().HOST_PROVISION === 'deny') throw forbidden('NOT_PROVISIONED', 'Bạn chưa có tài khoản Lộ trình. Liên hệ BP Đào tạo để được cấp');
      const [row] = await tx
        .insert(users)
        .output()
        .values({
          externalId: identity.externalId,
          employeeCode: identity.employeeCode,
          fullName: identity.fullName,
          email: identity.email,
          role,
          status: 'active',
          canBuddy: identity.canBuddy ?? false,
          reviewedAt: now,
        });
      await replaceScopes(tx, row!.id, storeIds, areaIds);
      await logUserChanges(tx, [{ userId: row!.id, changedBy: null, field: 'created', newValue: `${ROLE_LABEL[role]} · đồng bộ từ hệ thống chính`, at: now }]);
      await this.linkStaff(tx, row!.id, identity.employeeCode);
      return { user: this.sessionOf(row!), created: true, lostAssignments: [] };
    }

    const nextRole = role ?? existing.role;
    const patch: Partial<typeof users.$inferInsert> = {};
    const changes: UserChange[] = [];
    const change = (field: string, oldValue: string | null, newValue: string | null) => changes.push({ userId: existing.id, changedBy: null, field, oldValue, newValue, at: now });
    if (existing.externalId !== identity.externalId) patch.externalId = identity.externalId;
    if (existing.employeeCode !== identity.employeeCode) {
      patch.employeeCode = identity.employeeCode;
      change('employeeCode', existing.employeeCode, identity.employeeCode);
    }
    if (existing.fullName !== identity.fullName) {
      patch.fullName = identity.fullName;
      change('fullName', existing.fullName, identity.fullName);
    }
    if (identity.email && existing.email !== identity.email) {
      patch.email = identity.email;
      change('email', existing.email, identity.email);
    }
    if (existing.role !== nextRole) {
      patch.role = nextRole;
      change('role', ROLE_LABEL[existing.role], ROLE_LABEL[nextRole]);
    }
    if (existing.status !== status) {
      patch.status = status;
      change('status', USER_STATUS_LABEL[existing.status], USER_STATUS_LABEL[status]);
    }
    if (identity.canBuddy !== undefined && existing.canBuddy !== identity.canBuddy) {
      patch.canBuddy = identity.canBuddy;
      change('canBuddy', existing.canBuddy ? 'Có' : 'Không', identity.canBuddy ? 'Có' : 'Không');
    }
    if (Object.keys(patch).length) await tx.update(users).set(patch).where(eq(users.id, existing.id));

    // Phạm vi: chỉ khi Web A cho map được vai trò; người nghỉ giữ nguyên để tra cứu lịch sử
    if (role && identity.active) {
      const oldStores = (await storeScopeRows(tx).where(eq(userScopes.userId, existing.id))).map((r) => r.storeId).sort();
      const oldAreas = (await areaScopeRows(tx).where(eq(userScopes.userId, existing.id))).map((r) => r.areaId).sort();
      const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
      if (!same(oldStores, [...storeIds].sort()) || !same(oldAreas, [...areaIds].sort())) {
        await replaceScopes(tx, existing.id, storeIds, areaIds);
        change('stores', await this.codes(tx, 'store', oldStores), await this.codes(tx, 'store', storeIds));
        change('areas', await this.codes(tx, 'area', oldAreas), await this.codes(tx, 'area', areaIds));
      }
    }
    await logUserChanges(
      tx,
      changes.filter((c) => (c.oldValue ?? '') !== (c.newValue ?? '')),
    );
    await this.linkStaff(tx, existing.id, identity.employeeCode);

    // Đổi vai trò hoặc nghỉ việc làm mất quyền giữ phân công đang có: không tự gỡ, báo BP chuyển giao
    const next = { role: nextRole, status, canBuddy: patch.canBuddy ?? existing.canBuddy };
    const lostAssignments = (await activeAssignmentsOf(tx, existing.id)).filter((a) => !canHoldAssignment(a.role, next)).map((a) => `${a.staffName} (${a.role})`);
    const [fresh] = await tx.select().from(users).where(eq(users.id, existing.id));
    return { user: this.sessionOf(fresh!), created: false, lostAssignments };
  }

  /** Phạm vi theo vai trò: CHT theo cửa hàng, QLKV theo khu vực (như quản trị tài khoản); mã không có thì bỏ qua */
  private async scopeIds(tx: Tx, role: AccountRole | null, identity: ExternalIdentity) {
    const storeCodes = role === 'cht' ? identity.storeCodes : [];
    const areaCodes = role === 'qlkv' ? identity.areaCodes : [];
    const storeRows = storeCodes.length ? await tx.select({ id: stores.id, code: stores.code }).from(stores).where(inArray(stores.code, storeCodes)) : [];
    const areaRows = areaCodes.length ? await tx.select({ id: areas.id, code: areas.code }).from(areas).where(inArray(areas.code, areaCodes)) : [];
    const missing = [...storeCodes.filter((c) => !storeRows.some((r) => r.code === c)), ...areaCodes.filter((c) => !areaRows.some((r) => r.code === c))];
    if (missing.length) this.logger.warn(`${identity.employeeCode}: không có mã ${missing.join(', ')} trong danh mục cửa hàng/khu vực của module`);
    return { storeIds: storeRows.map((r) => r.id), areaIds: areaRows.map((r) => r.id) };
  }

  private async codes(tx: Tx, kind: 'store' | 'area', ids: number[]): Promise<string | null> {
    if (!ids.length) return null;
    const rows = kind === 'store' ? await tx.select({ n: stores.name }).from(stores).where(inArray(stores.id, ids)) : await tx.select({ n: areas.name }).from(areas).where(inArray(areas.id, ids));
    return rows.map((r) => r.n).sort().join(', ');
  }

  /** Gắn hồ sơ nhân viên cùng mã chưa có tài khoản: NV thấy ngay checklist của mình */
  private async linkStaff(tx: Tx, userId: number, employeeCode: string): Promise<void> {
    const [linked] = await tx.select({ id: staff.id }).from(staff).where(eq(staff.userId, userId));
    if (linked) return;
    await tx.update(staff).set({ userId }).where(and(eq(staff.employeeCode, employeeCode), isNull(staff.userId)));
  }

  private async alertHandover(user: SessionUser, lost: string[]): Promise<void> {
    const bps = await this.notifications.activeIds({ role: 'bp' });
    await this.notifications.notify(bps, {
      type: 'account',
      title: `Cần chuyển giao phân công của ${user.fullName}`,
      body: `Vai trò hoặc trạng thái ở hệ thống chính đã đổi, không còn giữ được: ${lost.join('; ')}`,
      link: '/quan-tri/tai-khoan',
      dedupeKey: `handover:${user.id}:${lost.join('|')}`,
    });
  }

  private sessionOf(u: { id: number; role: AccountRole; status: UserStatus; fullName: string; email: string | null; canBuddy: boolean; lastSeenAt: Date | null }): SessionUser {
    return { id: u.id, role: u.role, status: u.status, fullName: u.fullName, email: u.email, canBuddy: u.canBuddy, lastSeenAt: u.lastSeenAt };
  }

  /**
   * Đồng bộ hàng loạt từ danh sách nhân sự Web A (HOST_DIRECTORY_URL): tạo, cập nhật mọi người, kể cả người chưa
   * từng mở module (để BP chọn làm Buddy, CHT, QLKV khi gán checklist). Người đã từng đồng bộ mà không còn trong danh
   * sách thì chuyển "Đã nghỉ".
   */
  async syncDirectory(records: ExternalIdentity[]): Promise<DirectorySyncResult> {
    const result: DirectorySyncResult = { seen: records.length, created: 0, updated: 0, left: 0, skipped: 0 };
    for (const identity of records) {
      const role = roleFromTitles(identity.titles);
      if (!role && identity.active) {
        result.skipped++;
        continue;
      }
      try {
        const r = await this.db.transaction((tx) => this.upsert(tx, identity, role));
        if (r.created) result.created++;
        else if (r.user.id) result.updated++;
        if (r.lostAssignments.length) await this.alertHandover(r.user, r.lostAssignments);
      } catch (err) {
        result.skipped++;
        this.logger.warn(`Bỏ qua ${identity.employeeCode}: ${(err as Error).message}`);
      }
    }
    const present = new Set(records.filter((r) => r.active).map((r) => r.externalId));
    const synced = await this.db
      .select({ id: users.id, externalId: users.externalId, fullName: users.fullName, role: users.role, status: users.status, email: users.email, canBuddy: users.canBuddy, lastSeenAt: users.lastSeenAt })
      .from(users)
      .where(and(isNotNull(users.externalId), eq(users.status, 'active')));
    const now = await this.clock.now();
    for (const u of synced.filter((x) => !present.has(x.externalId!))) {
      await this.db.transaction(async (tx) => {
        await tx.update(users).set({ status: 'left' }).where(eq(users.id, u.id));
        await logUserChanges(tx, [{ userId: u.id, changedBy: null, field: 'status', oldValue: USER_STATUS_LABEL.active, newValue: USER_STATUS_LABEL.left, at: now }]);
      });
      result.left++;
      const lost = (await activeAssignmentsOf(this.db, u.id)).map((a) => `${a.staffName} (${a.role})`);
      if (lost.length) await this.alertHandover({ ...u, status: 'left' }, lost);
    }
    return result;
  }
}
