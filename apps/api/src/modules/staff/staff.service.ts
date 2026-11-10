import { Inject, Injectable } from '@nestjs/common';
import {
  countAlerts,
  ROLE_LABEL,
  type CreateStaffBodyT,
  type DeleteStaffBodyT,
  type PersonOption,
  type StaffFormOptions,
  type StaffListItem,
  type StaffListResponse,
  type StaffProfileResponse,
} from '@lotrinh/shared';
import { and, asc, desc, eq, inArray, like, or } from 'drizzle-orm';
import { ClockService } from '../../adapters/clock/clock.service';
import { badRequest, forbidden, notFound } from '../../common/errors';
import { toActor, type SessionUser } from '../../common/session';
import type { Db } from '../../db/client';
import { DB } from '../../db/db.provider';
import {
  areas,
  levelReviews,
  levelRuns,
  notifications,
  observations,
  runAssignments,
  runEvaluations,
  runJournal,
  runPauses,
  runTasks,
  salesMonthly,
  signoffs,
  staff,
  stores,
  taskConfirmations,
  taskEvents,
  users,
} from '../../db/schema';
import { areaScopeRows, storeScopeRows } from '../../db/scopes';
import { AccessService } from '../access/access.service';
import { AlertsService } from '../alerts/alerts.service';
import { createRun, findVersionForDate } from '../runs/run-factory';
import { RunContextService } from '../runs/run-context.service';
import { TaskQueryService } from '../runs/task-query.service';
import { buildPath, buildTaskViews, currentRunOf, levelSummary, summarizeRun } from '../runs/task-views';

@Injectable()
export class StaffService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly access: AccessService,
    private readonly runs: RunContextService,
    private readonly taskQuery: TaskQueryService,
    private readonly alerts: AlertsService,
  ) {}

  /** Bảng Nhân sự (mục 11.4): chỉ NV trong phạm vi, mặc định nhiều cảnh báo đỏ trước */
  async list(user: SessionUser): Promise<StaffListResponse> {
    const today = await this.clock.today();
    const contexts = await this.alerts.currentRunsInScope(user);
    const data = await this.taskQuery.loadForRuns(contexts.map((c) => c.run.id));
    const actor = toActor(user);
    const views = new Map(contexts.map((ctx) => [ctx.run.id, buildTaskViews(ctx, data.get(ctx.run.id)!, today, actor)]));
    const alerts = await this.alerts.forRuns(contexts, views, today);

    const items: StaffListItem[] = contexts.map((ctx) => ({
      staff: ctx.staff,
      run: summarizeRun(ctx, views.get(ctx.run.id)!, today),
      level: levelSummary(ctx),
      alerts: alerts.get(ctx.run.id) ?? [],
    }));
    const red = (i: StaffListItem) => countAlerts(i.alerts).red;
    items.sort(
      (a, b) => red(b) - red(a) || (b.run?.counts.overdue ?? 0) - (a.run?.counts.overdue ?? 0) || a.staff.fullName.localeCompare(b.staff.fullName, 'vi'),
    );
    return { today, items, canCreate: await this.access.can(user, 'create', 'Staff'), canExport: await this.access.can(user, 'read', 'Report') };
  }

  async profile(user: SessionUser, staffId: number): Promise<StaffProfileResponse> {
    const today = await this.clock.today();
    const [row] = await this.db
      .select({ staff, accountEmail: users.email })
      .from(staff)
      .leftJoin(users, eq(users.id, staff.userId))
      .where(eq(staff.id, staffId));
    if (!row) throw notFound('STAFF_NOT_FOUND', 'Không tìm thấy hồ sơ nhân viên');

    const allRuns = await this.db.select().from(levelRuns).where(eq(levelRuns.staffId, staffId)).orderBy(desc(levelRuns.startDate));
    const current = currentRunOf(allRuns);
    if (!current) throw notFound('RUN_NOT_FOUND', 'Nhân viên chưa có lượt Level nào');
    const contexts = await this.runs.loadMany(allRuns.map((r) => r.id));
    const ctx = contexts.find((c) => c.run.id === current.id)!;
    await this.access.assertCanViewRun(user, ctx);

    const views = buildTaskViews(ctx, (await this.taskQuery.loadForRuns([ctx.run.id])).get(ctx.run.id)!, today, toActor(user));
    const alerts = (await this.alerts.forRuns([ctx], new Map([[ctx.run.id, views]]), today)).get(ctx.run.id) ?? [];
    return {
      today,
      alerts,
      // Lượt onboarding CHT: chỉ BP ĐT, QLKV quản lý (CHT không tự đổi phân công, tạm dừng)
      canManage: !(ctx.track !== 'nvbh' && (user.role === 'cht' || user.id === ctx.staff.userId)) && (await this.access.can(user, 'update', AccessService.recordOf(ctx))),
      canDelete: user.role === 'bp',
      staff: {
        ...ctx.staff,
        hireDate: row.staff.hireDate,
        currentLevel: row.staff.currentLevel,
        accountEmail: row.accountEmail,
        active: row.staff.active,
        stopReason: row.staff.stopReason,
        stoppedAt: row.staff.stoppedAt?.toISOString() ?? null,
      },
      run: summarizeRun(ctx, views, today),
      level: levelSummary(ctx),
      people: { buddy: ctx.names.buddy, cht: ctx.names.cht, qlkv: ctx.names.qlkv, trainer: ctx.names.trainer },
      path: buildPath(ctx, allRuns),
      history: contexts.map((c) => ({
        runId: c.run.id,
        track: c.track,
        levelKey: c.run.levelKey,
        levelName: c.level.name,
        versionCode: c.versionCode,
        startDate: c.run.startDate,
        plannedEnd: c.run.plannedEnd,
        status: c.run.status,
      })),
      isSelf: ctx.staff.userId === user.id,
    };
  }

  private async storesInScope(user: SessionUser) {
    const rows = await this.db
      .select({ id: stores.id, name: stores.name, areaId: stores.areaId, areaName: areas.name })
      .from(stores)
      .innerJoin(areas, eq(areas.id, stores.areaId))
      .where(eq(stores.active, true))
      .orderBy(asc(stores.name));
    const out = [];
    for (const s of rows) {
      if (await this.access.can(user, 'create', { userId: null, storeId: s.id, areaId: s.areaId, buddyId: null, chtId: null, qlkvId: null })) out.push(s);
    }
    return out;
  }

  /** Lựa chọn cho form Thêm nhân viên: cửa hàng trong phạm vi, CHT/QLKV mặc định theo cửa hàng (mục 9.1) */
  async formOptions(user: SessionUser): Promise<StaffFormOptions> {
    await this.access.assertCan(user, 'create', 'Staff', 'Chỉ CHT, QLKV hoặc BP Đào tạo được thêm nhân viên');
    const [storeList, active, storeScopes, areaScopes, linked, version] = await Promise.all([
      this.storesInScope(user),
      this.db.select().from(users).where(eq(users.status, 'active')).orderBy(asc(users.fullName)),
      storeScopeRows(this.db),
      areaScopeRows(this.db),
      this.db.select({ userId: staff.userId, storeName: stores.name }).from(staff).innerJoin(stores, eq(stores.id, staff.storeId)),
      findVersionForDate(this.db, await this.clock.today()),
    ]);
    const storeOfUser = new Map(linked.filter((l) => l.userId !== null).map((l) => [l.userId!, l.storeName]));
    const opt = (u: (typeof active)[number], note?: string): PersonOption => ({
      id: u.id,
      fullName: u.fullName,
      note: note ?? (storeOfUser.get(u.id) ? `${ROLE_LABEL[u.role]} · ${storeOfUser.get(u.id)}` : ROLE_LABEL[u.role]),
    });
    const activeIds = new Set(active.map((u) => u.id));
    const firstOf = (role: 'cht' | 'qlkv', match: (userId: number) => boolean) =>
      active.find((u) => u.role === role && activeIds.has(u.id) && match(u.id))?.id ?? null;

    return {
      today: await this.clock.today(),
      stores: storeList.map((s) => ({
        id: s.id,
        name: s.name,
        areaName: s.areaName,
        defaultChtId: firstOf('cht', (id) => storeScopes.some((x) => x.userId === id && x.storeId === s.id)),
        defaultQlkvId: firstOf('qlkv', (id) => areaScopes.some((x) => x.userId === id && x.areaId === s.areaId)),
      })),
      buddies: active.filter((u) => u.canBuddy || u.role === 'cht').map((u) => opt(u)),
      chts: active.filter((u) => u.role === 'cht').map((u) => opt(u)),
      qlkvs: active.filter((u) => u.role === 'qlkv').map((u) => opt(u)),
      accounts: active.filter((u) => u.role === 'nv' && !storeOfUser.has(u.id)).map((u) => opt(u, u.email)),
      levels: version.content.levels.map((l) => ({ key: l.key, name: l.name, durationLabel: l.durationLabel })),
    };
  }

  /** Tạo hồ sơ NV và bắt đầu lượt Level, gắn phiên bản hiệu lực tại ngày bắt đầu (R01) */
  async create(user: SessionUser, body: CreateStaffBodyT): Promise<{ staffId: number; runId: number }> {
    const [store] = await this.db.select().from(stores).where(and(eq(stores.id, body.storeId), eq(stores.active, true)));
    if (!store) throw badRequest('STORE_NOT_FOUND', 'Cửa hàng không tồn tại hoặc đã ngừng hoạt động');
    const allowed = await this.access.can(user, 'create', { userId: null, storeId: store.id, areaId: store.areaId, buddyId: null, chtId: null, qlkvId: null });
    if (!allowed) throw forbidden('OUT_OF_SCOPE', 'Bạn chỉ thêm được nhân viên cho cửa hàng trong phạm vi của mình');

    const ids = [body.userId, body.buddyId, body.chtId, body.qlkvId].filter((id): id is number => !!id);
    const people = new Map((await this.db.select().from(users).where(inArray(users.id, ids))).map((u) => [u.id, u]));
    const person = (id: number | null | undefined) => (id ? people.get(id) : undefined);
    const cht = person(body.chtId);
    const qlkv = person(body.qlkvId);
    const buddy = person(body.buddyId);
    const account = person(body.userId);
    if (cht?.role !== 'cht' || cht.status !== 'active') throw badRequest('INVALID_CHT', 'Cửa hàng trưởng phải là tài khoản CHT đang hoạt động');
    if (qlkv?.role !== 'qlkv' || qlkv.status !== 'active') throw badRequest('INVALID_QLKV', 'QLKV phải là tài khoản QLKV đang hoạt động');
    if (body.buddyId && (!buddy || buddy.status !== 'active' || !(buddy.canBuddy || buddy.role === 'cht'))) {
      throw badRequest('INVALID_BUDDY', 'Buddy phải là tài khoản có quyền "Có thể làm Buddy" hoặc CHT');
    }
    if (body.userId) {
      if (!account || account.role !== 'nv' || account.status !== 'active') throw badRequest('INVALID_ACCOUNT', 'Chỉ gắn được tài khoản vai trò NV đã được duyệt');
      const [taken] = await this.db.select({ id: staff.id }).from(staff).where(eq(staff.userId, body.userId));
      if (taken) throw badRequest('ACCOUNT_TAKEN', 'Tài khoản này đã gắn với một hồ sơ nhân viên khác');
      if (body.userId === body.buddyId) throw badRequest('INVALID_BUDDY', 'Nhân viên không thể là Buddy của chính mình');
    }

    const startDate = body.levelKey === 1 ? body.hireDate : body.startDate!;
    if (startDate < body.hireDate) throw badRequest('INVALID_START', 'Ngày bắt đầu Level không được trước ngày nhận việc');
    const version = await findVersionForDate(this.db, startDate);

    return this.db.transaction(async (tx) => {
      const [st] = await tx
        .insert(staff)
        .values({
          userId: body.userId ?? null,
          employeeCode: body.employeeCode || account?.employeeCode || null,
          fullName: body.fullName,
          storeId: store.id,
          hireDate: body.hireDate,
          currentLevel: body.levelKey,
        })
        .returning();
      const { run } = await createRun(tx, {
        staffId: st.id,
        levelKey: body.levelKey,
        startDate,
        version: { id: version.id, content: version.content },
        people: { buddy: body.buddyId ?? null, cht: cht.id, qlkv: qlkv.id },
        createdBy: user.id,
      });
      return { staffId: st.id, runId: run.id };
    });
  }

  /**
   * Xóa hẳn hồ sơ nhân viên (nhập nhầm, dữ liệu thử): mọi lượt Level, đầu việc, xác nhận, doanh số, Rubric, phiếu đánh giá,
   * nhật ký onboarding và thông báo trỏ tới hồ sơ. Tài khoản đăng nhập giữ nguyên (khóa ở Quản trị nếu cần).
   * Nghỉ việc thì dùng "Ngừng theo dõi" để giữ dữ liệu. Nhật ký hệ thống ghi lại họ tên và lý do (body của request).
   */
  async remove(user: SessionUser, staffId: number, body: DeleteStaffBodyT): Promise<{ ok: true; fullName: string; runs: number }> {
    if (user.role !== 'bp') throw forbidden('CANNOT_DELETE_STAFF', 'Chỉ BP Đào tạo xóa được hồ sơ nhân viên');
    const [row] = await this.db.select().from(staff).where(eq(staff.id, staffId));
    if (!row) throw notFound('STAFF_NOT_FOUND', 'Không tìm thấy hồ sơ nhân viên');
    if (body.confirmName.trim().toLowerCase() !== row.fullName.trim().toLowerCase()) {
      throw badRequest('CONFIRM_MISMATCH', `Họ tên nhập vào không khớp với "${row.fullName}"`);
    }

    const runIds = (await this.db.select({ id: levelRuns.id }).from(levelRuns).where(eq(levelRuns.staffId, staffId))).map((r) => r.id);
    await this.db.transaction(async (tx) => {
      if (runIds.length) {
        const taskIds = tx.select({ id: runTasks.id }).from(runTasks).where(inArray(runTasks.runId, runIds));
        await tx.delete(taskConfirmations).where(inArray(taskConfirmations.taskId, taskIds));
        await tx.delete(taskEvents).where(inArray(taskEvents.taskId, taskIds));
        // signoffs trước level_reviews vì chữ ký phiếu đánh giá trỏ tới phiếu
        for (const t of [runTasks, runAssignments, signoffs, runPauses, runJournal, runEvaluations, salesMonthly, observations, levelReviews]) {
          await tx.delete(t).where(inArray(t.runId, runIds));
        }
        await tx.delete(levelRuns).where(inArray(levelRuns.id, runIds));
      }
      await tx.delete(notifications).where(or(eq(notifications.link, `/nhan-su/${staffId}`), like(notifications.link, `/nhan-su/${staffId}?%`)));
      await tx.delete(staff).where(eq(staff.id, staffId));
    });
    return { ok: true, fullName: row.fullName, runs: runIds.length };
  }
}
