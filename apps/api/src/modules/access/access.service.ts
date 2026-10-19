import { subject } from '@casl/ability';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { forbidden } from '../../common/errors';
import type { SessionUser } from '../../common/session';
import type { Db } from '../../db/client';
import { DB } from '../../db/db.provider';
import { levelRuns, runAssignments, staff, stores, systemSettings, userAreaScopes, userStoreScopes } from '../../db/schema';
import type { RunContext } from '../runs/run-context.service';
import { defineAbilityFor, type Action, type AppAbility, type StaffRecord, type SubjectName, type UserScopes } from './ability';

/** Khóa cấu hình V20 trong system_settings */
export const BP_SELF_PUBLISH_KEY = 'bp_self_publish';

/**
 * Phạm vi dữ liệu kiểm tra ở tầng máy chủ (R22, mục 14.8), không chỉ ẩn trên giao diện.
 * Quyền tính một lần cho mỗi request (khóa theo đối tượng req.user).
 */
@Injectable()
export class AccessService {
  private readonly cache = new WeakMap<SessionUser, Promise<{ ability: AppAbility; scopes: UserScopes }>>();

  constructor(@Inject(DB) private readonly db: Db) {}

  private load(user: SessionUser) {
    let entry = this.cache.get(user);
    if (!entry) {
      entry = (async () => {
        const [storeRows, areaRows, selfPublish] = await Promise.all([
          this.db.select({ id: userStoreScopes.storeId }).from(userStoreScopes).where(eq(userStoreScopes.userId, user.id)),
          this.db.select({ id: userAreaScopes.areaId }).from(userAreaScopes).where(eq(userAreaScopes.userId, user.id)),
          this.db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, BP_SELF_PUBLISH_KEY)),
        ]);
        const scopes = { storeIds: storeRows.map((r) => r.id), areaIds: areaRows.map((r) => r.id) };
        return { ability: defineAbilityFor(user, scopes, { bpSelfPublish: selfPublish[0]?.value === true }), scopes };
      })();
      this.cache.set(user, entry);
    }
    return entry;
  }

  async scopesOf(user: SessionUser): Promise<UserScopes> {
    return (await this.load(user)).scopes;
  }

  async can(user: SessionUser, action: Action, target: SubjectName | StaffRecord): Promise<boolean> {
    const { ability } = await this.load(user);
    return typeof target === 'string' ? ability.can(action, target) : ability.can(action, subject('Staff', { ...target }) as never);
  }

  async assertCan(user: SessionUser, action: Action, target: SubjectName | StaffRecord, message: string): Promise<void> {
    if (!(await this.can(user, action, target))) throw forbidden('FORBIDDEN', message);
  }

  static recordOf(ctx: RunContext): StaffRecord {
    return {
      userId: ctx.staff.userId,
      storeId: ctx.staff.storeId,
      areaId: ctx.staff.areaId,
      buddyId: ctx.people.buddyId,
      chtId: ctx.people.chtId,
      qlkvId: ctx.people.qlkvId,
    };
  }

  canViewRun(user: SessionUser, ctx: RunContext): Promise<boolean> {
    return this.can(user, 'read', AccessService.recordOf(ctx));
  }

  async assertCanViewRun(user: SessionUser, ctx: RunContext): Promise<void> {
    if (!(await this.canViewRun(user, ctx))) {
      throw forbidden('OUT_OF_SCOPE', 'Hồ sơ này nằm ngoài phạm vi dữ liệu của bạn');
    }
  }

  /**
   * scopeFilter (mục 14.8 bước 3): điều kiện SQL trên bảng staff (đã join stores) cho danh sách nhân sự.
   * Khớp với quy tắc "read Staff" trong ability.ts.
   */
  async staffScope(user: SessionUser): Promise<SQL | undefined> {
    if (user.role === 'bp') return undefined;
    const { storeIds, areaIds } = await this.scopesOf(user);
    const assigned = inArray(
      staff.id,
      this.db
        .select({ id: levelRuns.staffId })
        .from(levelRuns)
        .innerJoin(runAssignments, eq(runAssignments.runId, levelRuns.id))
        .where(and(eq(runAssignments.userId, user.id), isNull(runAssignments.toDate))),
    );
    const parts: SQL[] = [eq(staff.userId, user.id), assigned];
    if (user.role === 'cht' && storeIds.length) parts.push(inArray(staff.storeId, storeIds));
    if (user.role === 'qlkv' && areaIds.length) parts.push(inArray(stores.areaId, areaIds));
    return or(...parts) ?? sql`false`;
  }
}
