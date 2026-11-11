import { Inject, Injectable } from '@nestjs/common';
import { canHoldAssignment, type OrgOptions, type UpdateUserBodyT, type UserDetailResponse, type UserListItem, type UserListResponse } from '@lotrinh/shared';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { ClockService } from '../../adapters/clock/clock.service';
import { forbidden, notFound, staleData } from '../../common/errors';
import type { SessionUser } from '../../common/session';
import type { Db, Tx } from '../../db/client';
import { DB } from '../../db/db.provider';
import { areas, staff, stores, users, userScopes } from '../../db/schema';
import { areaScopeRows, storeScopeRows } from '../../db/scopes';
import { logUserChanges, userChangeHistory } from '../audit/user-changes';
import { AccessService } from '../access/access.service';
import { activeAssignmentsOf, applyHandover, assignmentCandidates } from '../runs/assignments';
import { lockRows } from '../../db/mssql';

type UserRow = typeof users.$inferSelect;

const FIELD_LABEL: Record<string, string> = {
  canBuddy: 'Có thể làm Buddy',
  handover: 'Chuyển giao',
};

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly access: AccessService,
  ) {}

  private assertAdmin(user: SessionUser) {
    return this.access.assertCan(user, 'manage', 'User', 'Chỉ BP Đào tạo quản lý quyền Buddy');
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
    const rows = await this.db
      .select({ u: users, staffId: staff.id })
      .from(users)
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
    return rows.map(({ u, staffId }) => ({
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
      user: { ...item!, rowVersion: row.rowVersion, staffName: staffRow?.name ?? null },
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
      isLastBp: false,
    };
  }

  async update(user: SessionUser, id: number, input: UpdateUserBodyT): Promise<UserDetailResponse> {
    await this.assertAdmin(user);
    const now = await this.clock.now();
    const today = await this.clock.today();

    await this.db.transaction(async (tx) => {
      const row = await this.row(id, tx, true);
      if (row.rowVersion !== input.rowVersion) throw staleData();
      if (row.status !== 'active') throw forbidden('ACCOUNT_INACTIVE', 'Chỉ tài khoản đang hoạt động mới được thay đổi quyền Buddy');

      const next = { role: row.role, status: row.status, canBuddy: input.canBuddy };
      const affected = (await activeAssignmentsOf(tx, id)).filter((a) => !canHoldAssignment(a.role, next));
      const handed = await applyHandover(tx, affected, input.handover, today, id);

      if (row.canBuddy !== input.canBuddy) {
        await tx.update(users).set({ canBuddy: input.canBuddy, rowVersion: sql`${users.rowVersion} + 1` }).where(eq(users.id, id));
        await logUserChanges(tx, [{
          userId: id,
          changedBy: user.id,
          field: 'canBuddy',
          oldValue: row.canBuddy ? 'Có' : 'Không',
          newValue: input.canBuddy ? 'Có' : 'Không',
          at: now,
        }]);
      }
      if (handed.length) {
        await logUserChanges(tx, handed.map((value) => ({ userId: id, changedBy: user.id, field: 'handover', oldValue: null, newValue: value, at: now })));
      }
    });
    return this.detail(user, id);
  }
}
