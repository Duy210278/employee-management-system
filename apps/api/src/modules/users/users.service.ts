import { Inject, Injectable } from '@nestjs/common';
import {
  canHoldAssignment,
  ROLE_LABEL,
  USER_STATUS_LABEL,
  type AccountRole,
  type ApproveUserBodyT,
  type CreateUserBodyT,
  type ImportRowView,
  type ImportUsersResponse,
  type OrgOptions,
  type UpdateUserBodyT,
  type UserDetailResponse,
  type UserListItem,
  type UserListResponse,
  type UserStatus,
} from '@lotrinh/shared';
import bcrypt from 'bcryptjs';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mssql-core';
import { ClockService } from '../../adapters/clock/clock.service';
import { badRequest, conflict, forbidden, notFound, staleData } from '../../common/errors';
import type { SessionUser } from '../../common/session';
import type { Db, Tx } from '../../db/client';
import { env } from '../../config';
import { DB } from '../../db/db.provider';
import { areas, credentials, staff, stores, users, userScopes } from '../../db/schema';
import { areaScopeRows, replaceScopes, storeScopeRows } from '../../db/scopes';
import { logUserChanges, userChangeHistory } from '../audit/user-changes';
import { AccessService } from '../access/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { activeAssignmentsOf, applyHandover, assignmentCandidates } from '../runs/assignments';
import { parseCsv } from './csv';
import { lockRows } from '../../db/mssql';

type UserRow = typeof users.$inferSelect;

/** Mật khẩu ban đầu của tài khoản do BP ĐT nhập hàng loạt; người dùng đổi sau khi có chức năng đổi mật khẩu */
export const IMPORT_PASSWORD = 'Upharma@123';

const FIELD_LABEL: Record<string, string> = {
  registered: 'Đăng ký',
  created: 'Tạo tài khoản',
  imported: 'Nhập từ CSV',
  approved: 'Duyệt đăng ký',
  rejected: 'Từ chối đăng ký',
  fullName: 'Họ tên',
  employeeCode: 'Mã NV',
  phone: 'Điện thoại',
  role: 'Vai trò',
  status: 'Trạng thái',
  canBuddy: 'Có thể làm Buddy',
  // Quyền cũ đã bỏ, giữ nhãn để đọc lịch sử thay đổi
  canApproveVersions: 'Người duyệt phiên bản',
  stores: 'Cửa hàng phụ trách',
  areas: 'Khu vực phụ trách',
  handover: 'Chuyển giao',
};

const yesNo = (v: boolean) => (v ? 'Có' : 'Không');

/**
 * Quản trị người dùng (mục 5): chỉ BP Đào tạo (ma trận 3.3).
 * Quy tắc mục 5.4: còn ít nhất 1 BP ĐT hoạt động (R19); khóa/cho nghỉ/đổi vai trò người đang được phân công phải chuyển giao (R20);
 * mọi thay đổi ghi user_changes; đổi vai trò có hiệu lực ở request kế tiếp vì AuthGuard nạp lại tài khoản mỗi lần.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  private assertAdmin(user: SessionUser) {
    return this.access.assertCan(user, 'manage', 'User', 'Chỉ BP Đào tạo quản trị tài khoản');
  }

  async orgOptions(): Promise<OrgOptions> {
    const [areaRows, storeRows] = await Promise.all([
      this.db.select({ id: areas.id, code: areas.code, name: areas.name, active: areas.active }).from(areas).orderBy(asc(areas.name)),
      this.db
        .select({ id: stores.id, code: stores.code, name: stores.name, areaId: stores.areaId, areaName: areas.name, active: stores.active })
        .from(stores)
        .innerJoin(areas, eq(areas.id, stores.areaId))
        .orderBy(asc(stores.name)),
    ]);
    return { areas: areaRows, stores: storeRows };
  }

  private async items(where?: ReturnType<typeof eq>): Promise<UserListItem[]> {
    const reqStore = alias(stores, 'req_store');
    const reqArea = alias(areas, 'req_area');
    const rows = await this.db
      .select({ u: users, reqStoreName: reqStore.name, reqAreaName: reqArea.name, staffId: staff.id })
      .from(users)
      .leftJoin(reqStore, eq(reqStore.id, users.requestedStoreId))
      .leftJoin(reqArea, eq(reqArea.id, users.requestedAreaId))
      .leftJoin(staff, eq(staff.userId, users.id))
      .where(where)
      .orderBy(asc(users.fullName));
    const ids = rows.map((r) => r.u.id);
    const [storeScopes, areaScopes] = ids.length
      ? await Promise.all([
          this.db
            .select({ userId: userScopes.userId, id: stores.id, name: stores.name })
            .from(userScopes)
            .innerJoin(stores, eq(stores.id, userScopes.storeId))
            .where(inArray(userScopes.userId, ids)),
          this.db
            .select({ userId: userScopes.userId, id: areas.id, name: areas.name })
            .from(userScopes)
            .innerJoin(areas, eq(areas.id, userScopes.areaId))
            .where(inArray(userScopes.userId, ids)),
        ])
      : [[], []];
    return rows.map(({ u, reqStoreName, reqAreaName, staffId }) => ({
      id: u.id,
      fullName: u.fullName,
      employeeCode: u.employeeCode,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      canBuddy: u.canBuddy,
      stores: storeScopes.filter((s) => s.userId === u.id).map(({ id, name }) => ({ id, name })),
      areas: areaScopes.filter((a) => a.userId === u.id).map(({ id, name }) => ({ id, name })),
      staffId,
      lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      requested: u.requestedRole
        ? { role: u.requestedRole, storeId: u.requestedStoreId, storeName: reqStoreName, areaId: u.requestedAreaId, areaName: reqAreaName }
        : null,
      reviewNote: u.reviewNote,
    }));
  }

  async list(user: SessionUser): Promise<UserListResponse> {
    await this.assertAdmin(user);
    return { items: await this.items(), options: await this.orgOptions() };
  }

  private async row(id: number, tx: Tx | Db = this.db, lock = false): Promise<UserRow> {
    if (lock) await lockRows(tx, users, 'rowVersion', eq(users.id, id));
    const [row] = await tx.select().from(users).where(eq(users.id, id));
    if (!row) throw notFound('USER_NOT_FOUND', 'Không tìm thấy tài khoản');
    return row;
  }

  async detail(user: SessionUser, id: number): Promise<UserDetailResponse> {
    await this.assertAdmin(user);
    const row = await this.row(id);
    const [item] = await this.items(eq(users.id, id));
    const history = await userChangeHistory(this.db, id);
    const [staffRow] = await this.db.select({ name: staff.fullName }).from(staff).where(eq(staff.userId, id));
    return {
      user: { ...item, rowVersion: row.rowVersion, staffName: staffRow?.name ?? null },
      history: history.map((c) => ({
        id: c.id,
        at: c.at.toISOString(),
        byName: c.byName,
        field: c.field,
        fieldLabel: FIELD_LABEL[c.field] ?? c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
      })),
      assignments: await activeAssignmentsOf(this.db, id),
      candidates: await assignmentCandidates(this.db),
      options: await this.orgOptions(),
      isLastBp: row.role === 'bp' && row.status === 'active' && (await this.otherActiveBp(id)) === 0,
    };
  }

  private async otherActiveBp(exceptId: number, tx: Tx | Db = this.db): Promise<number> {
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.role, 'bp'), eq(users.status, 'active'), ne(users.id, exceptId)));
    return n;
  }

  private async assertScopeIds(storeIds: number[], areaIds: number[]) {
    if (storeIds.length) {
      const found = await this.db.select({ id: stores.id }).from(stores).where(inArray(stores.id, storeIds));
      if (found.length !== new Set(storeIds).size) throw badRequest('STORE_NOT_FOUND', 'Có cửa hàng không tồn tại');
    }
    if (areaIds.length) {
      const found = await this.db.select({ id: areas.id }).from(areas).where(inArray(areas.id, areaIds));
      if (found.length !== new Set(areaIds).size) throw badRequest('AREA_NOT_FOUND', 'Có khu vực không tồn tại');
    }
  }

  /** Phạm vi chỉ có nghĩa với CHT (cửa hàng) và QLKV (khu vực) */
  private scopesFor(role: AccountRole, storeIds: number[], areaIds: number[]) {
    return { storeIds: role === 'cht' ? [...new Set(storeIds)] : [], areaIds: role === 'qlkv' ? [...new Set(areaIds)] : [] };
  }

  private async scopeNames(storeIds: number[], areaIds: number[]) {
    const s = storeIds.length ? await this.db.select({ name: stores.name }).from(stores).where(inArray(stores.id, storeIds)).orderBy(asc(stores.name)) : [];
    const a = areaIds.length ? await this.db.select({ name: areas.name }).from(areas).where(inArray(areas.id, areaIds)).orderBy(asc(areas.name)) : [];
    return { stores: s.map((x) => x.name).join(', '), areas: a.map((x) => x.name).join(', ') };
  }

  private replaceScopes(tx: Tx, userId: number, storeIds: number[], areaIds: number[]) {
    return replaceScopes(tx, userId, storeIds, areaIds);
  }

  /** Lấy người dùng từ Web A: họ tên, mã NV, vai trò, phạm vi, trạng thái do Web A quản lý; module chỉ còn sửa quyền Buddy */
  private assertLocal(): void {
    if (env().AUTH_MODE === 'external') throw forbidden('MANAGED_BY_HOST', 'Tài khoản được tạo và duyệt ở hệ thống chính, không làm ở Lộ trình');
  }

  private async keepHostFields(id: number, body: UpdateUserBodyT): Promise<UpdateUserBodyT> {
    const row = await this.row(id);
    const storeIds = (await storeScopeRows(this.db).where(eq(userScopes.userId, id))).map((s) => s.storeId);
    const areaIds = (await areaScopeRows(this.db).where(eq(userScopes.userId, id))).map((a) => a.areaId);
    const status = row.status === 'locked' || row.status === 'left' ? row.status : 'active';
    return { ...body, fullName: row.fullName, employeeCode: row.employeeCode, phone: row.phone ?? '', role: row.role, status, storeIds, areaIds };
  }

  async approve(user: SessionUser, id: number, body: ApproveUserBodyT): Promise<UserDetailResponse> {
    this.assertLocal();
    await this.assertAdmin(user);
    const scope = this.scopesFor(body.role, body.storeIds, body.areaIds);
    await this.assertScopeIds(scope.storeIds, scope.areaIds);
    const now = await this.clock.now();
    const names = await this.scopeNames(scope.storeIds, scope.areaIds);
    await this.db.transaction(async (tx) => {
      const row = await this.row(id, tx, true);
      if (row.status !== 'pending') throw conflict('NOT_PENDING', 'Tài khoản này không ở trạng thái chờ duyệt');
      await tx
        .update(users)
        .set({
          role: body.role,
          status: 'active',
          canBuddy: body.canBuddy,
          reviewedBy: user.id,
          reviewedAt: now,
          reviewNote: null,
          rowVersion: sql`${users.rowVersion} + 1`,
        })
        .where(eq(users.id, id));
      await this.replaceScopes(tx, id, scope.storeIds, scope.areaIds);
      const scopeText = [names.stores, names.areas].filter(Boolean).join(' · ');
      await logUserChanges(tx, [
        {
          userId: id,
          changedBy: user.id,
          field: 'approved',
          oldValue: USER_STATUS_LABEL.pending,
          newValue: `${ROLE_LABEL[body.role]}${scopeText ? ` · ${scopeText}` : ''}${body.canBuddy ? ' · Có thể làm Buddy' : ''}`,
          at: now,
        },
      ]);
    });
    await this.notifications.notify([id], { type: 'account', title: 'Tài khoản của bạn đã được duyệt', body: `Vai trò: ${ROLE_LABEL[body.role]}`, link: '/' });
    return this.detail(user, id);
  }

  /** Từ chối không xóa bản ghi, chỉ chuyển "Bị từ chối" kèm lý do (mục 5.4 điều 5, T-U02) */
  async reject(user: SessionUser, id: number, note: string): Promise<UserDetailResponse> {
    this.assertLocal();
    await this.assertAdmin(user);
    const now = await this.clock.now();
    await this.db.transaction(async (tx) => {
      const row = await this.row(id, tx, true);
      if (row.status !== 'pending') throw conflict('NOT_PENDING', 'Tài khoản này không ở trạng thái chờ duyệt');
      await tx
        .update(users)
        .set({ status: 'rejected', reviewNote: note, reviewedBy: user.id, reviewedAt: now, rowVersion: sql`${users.rowVersion} + 1` })
        .where(eq(users.id, id));
      await logUserChanges(tx, [{ userId: id, changedBy: user.id, field: 'rejected', oldValue: USER_STATUS_LABEL.pending, newValue: note, at: now }]);
    });
    return this.detail(user, id);
  }

  async update(user: SessionUser, id: number, input: UpdateUserBodyT): Promise<UserDetailResponse> {
    await this.assertAdmin(user);
    const body = env().AUTH_MODE === 'external' ? await this.keepHostFields(id, input) : input;
    const scope = this.scopesFor(body.role, body.storeIds, body.areaIds);
    await this.assertScopeIds(scope.storeIds, scope.areaIds);
    const now = await this.clock.now();
    const today = await this.clock.today();
    const names = await this.scopeNames(scope.storeIds, scope.areaIds);

    await this.db.transaction(async (tx) => {
      const row = await this.row(id, tx, true);
      if (row.rowVersion !== body.rowVersion) throw staleData();
      if (row.status === 'pending' || row.status === 'rejected') throw conflict('NOT_REVIEWED', 'Duyệt hoặc từ chối đăng ký trước khi sửa tài khoản');
      if (id === user.id && body.status !== 'active') throw badRequest('SELF_LOCK', 'Không tự khóa hoặc cho nghỉ tài khoản của chính mình');
      // R19, T-U03
      if (row.role === 'bp' && row.status === 'active' && (body.role !== 'bp' || body.status !== 'active') && (await this.otherActiveBp(id, tx)) === 0) {
        throw conflict('LAST_BP', 'Phải còn ít nhất 1 tài khoản BP Đào tạo đang hoạt động. Cấp quyền BP ĐT cho người khác trước');
      }
      if (body.employeeCode && body.employeeCode !== row.employeeCode) {
        const [dup] = await tx.select({ id: users.id }).from(users).where(and(eq(users.employeeCode, body.employeeCode), ne(users.id, id)));
        if (dup) throw conflict('EMPLOYEE_CODE_TAKEN', 'Mã nhân viên đã được dùng cho tài khoản khác');
      }

      // R20, T-U04: phân công không còn hợp lệ với tài khoản sau khi đổi thì phải chuyển giao
      const next = { role: body.role, status: body.status as UserStatus, canBuddy: body.canBuddy };
      const affected = (await activeAssignmentsOf(tx, id)).filter((a) => !canHoldAssignment(a.role, next));
      const handed = await applyHandover(tx, affected, body.handover, today, id);

      // Trong giao dịch SQL Server mỗi lần chỉ chạy một truy vấn: đọc tuần tự, không dùng Promise.all
      const oldStores = await storeScopeRows(tx).where(eq(userScopes.userId, id));
      const oldAreas = await areaScopeRows(tx).where(eq(userScopes.userId, id));
      const old = await this.scopeNames(
        oldStores.map((s) => s.storeId),
        oldAreas.map((a) => a.areaId),
      );

      await tx
        .update(users)
        .set({
          fullName: body.fullName,
          employeeCode: body.employeeCode || null,
          phone: body.phone || null,
          role: body.role,
          status: body.status,
          canBuddy: body.canBuddy,
          rowVersion: sql`${users.rowVersion} + 1`,
        })
        .where(eq(users.id, id));
      await this.replaceScopes(tx, id, scope.storeIds, scope.areaIds);

      const changes: [string, string | null, string | null][] = [
        ['fullName', row.fullName, body.fullName],
        ['employeeCode', row.employeeCode, body.employeeCode || null],
        ['phone', row.phone, body.phone || null],
        ['role', ROLE_LABEL[row.role], ROLE_LABEL[body.role]],
        ['status', USER_STATUS_LABEL[row.status], USER_STATUS_LABEL[body.status]],
        ['canBuddy', yesNo(row.canBuddy), yesNo(body.canBuddy)],
        ['stores', old.stores || null, names.stores || null],
        ['areas', old.areas || null, names.areas || null],
      ];
      const rows = changes
        .filter(([, a, b]) => (a ?? '') !== (b ?? ''))
        .map(([field, oldValue, newValue]) => ({ userId: id, changedBy: user.id, field, oldValue, newValue, at: now }));
      for (const h of handed) rows.push({ userId: id, changedBy: user.id, field: 'handover', oldValue: null, newValue: h, at: now });
      await logUserChanges(tx, rows);
    });
    return this.detail(user, id);
  }

  private async assertUnique(email: string, employeeCode: string | null) {
    const [byEmail] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (byEmail) throw conflict('EMAIL_TAKEN', 'Email đã có tài khoản');
    if (employeeCode) {
      const [byCode] = await this.db.select({ id: users.id }).from(users).where(eq(users.employeeCode, employeeCode));
      if (byCode) throw conflict('EMPLOYEE_CODE_TAKEN', 'Mã nhân viên đã có tài khoản');
    }
  }

  async create(user: SessionUser, body: CreateUserBodyT): Promise<{ id: number }> {
    this.assertLocal();
    await this.assertAdmin(user);
    await this.assertUnique(body.email, body.employeeCode);
    const scope = this.scopesFor(body.role, body.storeIds, body.areaIds);
    await this.assertScopeIds(scope.storeIds, scope.areaIds);
    const hash = await bcrypt.hash(body.password, 10);
    const now = await this.clock.now();
    return this.db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .output()
        .values({
          fullName: body.fullName,
          employeeCode: body.employeeCode || null,
          email: body.email,
          phone: body.phone || null,
          role: body.role,
          status: 'active',
          canBuddy: body.canBuddy,
          reviewedBy: user.id,
          reviewedAt: now,
        });
      await tx.insert(credentials).values({ userId: u.id, passwordHash: hash });
      await this.replaceScopes(tx, u.id, scope.storeIds, scope.areaIds);
      await logUserChanges(tx, [{ userId: u.id, changedBy: user.id, field: 'created', newValue: ROLE_LABEL[body.role], at: now }]);
      return { id: u.id };
    });
  }

  /**
   * Nhập tài khoản hàng loạt (mục 5.6): xem trước, đánh dấu dòng lỗi (trùng mã, cửa hàng không tồn tại),
   * chỉ nhập các dòng hợp lệ khi người dùng xác nhận.
   */
  async importCsv(user: SessionUser, csv: string, commit: boolean): Promise<ImportUsersResponse> {
    this.assertLocal();
    await this.assertAdmin(user);
    const table = parseCsv(csv);
    if (!table.length) throw badRequest('EMPTY_CSV', 'Tệp CSV trống');
    const header = table[0].map((h) => h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '_'));
    const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
    const idx = {
      code: col('ma_nv', 'ma_nhan_vien', 'employee_code'),
      name: col('ho_ten', 'ho_va_ten', 'full_name'),
      email: col('email'),
      phone: col('dien_thoai', 'so_dien_thoai', 'phone'),
      role: col('vai_tro', 'role'),
      store: col('ma_cua_hang', 'cua_hang', 'store_code'),
      area: col('ma_khu_vuc', 'khu_vuc', 'area_code'),
      buddy: col('buddy', 'quyen_buddy', 'co_the_lam_buddy'),
    };
    const missingCols = (['name', 'email', 'role'] as const).filter((k) => idx[k] < 0);
    if (missingCols.length) throw badRequest('BAD_HEADER', 'Thiếu cột bắt buộc: ho_ten, email, vai_tro. Tải mẫu CSV để xem đúng tên cột');

    const [existingUsers, storeRows, areaRows] = await Promise.all([
      this.db.select({ email: users.email, code: users.employeeCode }).from(users),
      this.db.select().from(stores),
      this.db.select().from(areas),
    ]);
    const emails = new Set(existingUsers.map((u) => u.email));
    const codes = new Set(existingUsers.map((u) => u.code).filter(Boolean));
    const ROLE_ALIASES: Record<string, AccountRole> = { nv: 'nv', 'nhan vien': 'nv', cht: 'cht', 'cua hang truong': 'cht', qlkv: 'qlkv', bp: 'bp', 'bp dt': 'bp', 'bp dao tao': 'bp' };
    const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
    const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');

    const rows: (ImportRowView & { _role?: AccountRole; _storeId?: number; _areaId?: number })[] = [];
    table.slice(1).forEach((r, k) => {
      if (r.every((c) => !c.trim())) return;
      const row: ImportRowView & { _role?: AccountRole; _storeId?: number; _areaId?: number } = {
        line: k + 2,
        employeeCode: get(r, idx.code),
        fullName: get(r, idx.name),
        email: get(r, idx.email).toLowerCase(),
        phone: get(r, idx.phone),
        role: get(r, idx.role),
        storeCode: get(r, idx.store),
        areaCode: get(r, idx.area),
        canBuddy: ['1', 'x', 'co', 'yes', 'true'].includes(norm(get(r, idx.buddy))),
        errors: [],
      };
      const e = row.errors;
      if (row.fullName.length < 2) e.push('Thiếu họ tên');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) e.push('Email không hợp lệ');
      else if (emails.has(row.email)) e.push('Email đã có tài khoản hoặc trùng dòng trên');
      if (row.employeeCode && codes.has(row.employeeCode)) e.push('Mã NV đã có tài khoản hoặc trùng dòng trên');
      const role = ROLE_ALIASES[norm(row.role)];
      if (!role) e.push('Vai trò phải là NV, CHT, QLKV hoặc BP');
      const store = row.storeCode ? storeRows.find((s) => s.code.toLowerCase() === row.storeCode.toLowerCase()) : undefined;
      const area = row.areaCode ? areaRows.find((a) => a.code.toLowerCase() === row.areaCode.toLowerCase()) : undefined;
      if (row.storeCode && !store) e.push(`Cửa hàng ${row.storeCode} không tồn tại`);
      if (row.areaCode && !area) e.push(`Khu vực ${row.areaCode} không tồn tại`);
      if (role === 'cht' && !row.storeCode) e.push('CHT phải có mã cửa hàng');
      if (role === 'qlkv' && !row.areaCode) e.push('QLKV phải có mã khu vực');
      row._role = role;
      row._storeId = store?.id;
      row._areaId = area?.id ?? (store ? store.areaId : undefined);
      if (!e.length) {
        emails.add(row.email);
        if (row.employeeCode) codes.add(row.employeeCode);
      }
      rows.push(row);
    });

    const valid = rows.filter((r) => !r.errors.length);
    let imported: number | null = null;
    if (commit && valid.length) {
      const hash = await bcrypt.hash(IMPORT_PASSWORD, 10);
      const now = await this.clock.now();
      await this.db.transaction(async (tx) => {
        for (const r of valid) {
          const role = r._role!;
          const [u] = await tx
            .insert(users)
            .output()
            .values({
              fullName: r.fullName,
              employeeCode: r.employeeCode || null,
              email: r.email,
              phone: r.phone || null,
              role,
              status: 'active',
              canBuddy: r.canBuddy,
              requestedStoreId: role === 'nv' ? (r._storeId ?? null) : null,
              reviewedBy: user.id,
              reviewedAt: now,
            });
          await tx.insert(credentials).values({ userId: u.id, passwordHash: hash });
          await this.replaceScopes(tx, u.id, role === 'cht' && r._storeId ? [r._storeId] : [], role === 'qlkv' && r._areaId ? [r._areaId] : []);
          await logUserChanges(tx, [{ userId: u.id, changedBy: user.id, field: 'imported', newValue: `${ROLE_LABEL[role]} · dòng ${r.line}`, at: now }]);
        }
      });
      imported = valid.length;
    }
    return {
      rows: rows.map(({ _role, _storeId, _areaId, ...r }) => r),
      valid: valid.length,
      invalid: rows.length - valid.length,
      imported,
      initialPassword: IMPORT_PASSWORD,
    };
  }
}
