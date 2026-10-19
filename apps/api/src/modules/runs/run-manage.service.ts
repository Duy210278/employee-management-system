import { Inject, Injectable } from '@nestjs/common';
import {
  ASSIGNMENT_LABEL,
  canHoldAssignment,
  fmtDate,
  pauseLength,
  shiftByPauses,
  type AssignmentRole,
  type PauseBodyT,
  type PauseView,
  type RunManageResponse,
  type StopStaffBodyT,
  type TransferBodyT,
} from '@lotrinh/shared';
import { and, asc, desc, eq, inArray, notInArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ClockService } from '../../adapters/clock/clock.service';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors';
import type { SessionUser } from '../../common/session';
import type { Db, Tx } from '../../db/client';
import { DB } from '../../db/db.provider';
import { areas, levelRuns, runPauses, runTasks, staff, stores, taskDateChanges, userAreaScopes, users, userStoreScopes } from '../../db/schema';
import { AccessService } from '../access/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { activeAssignmentsOf, applyHandover, assignmentCandidates, reassign } from './assignments';
import { RunContextService, type RunContext } from './run-context.service';
import { isOpenRun } from './task-views';

type PauseRow = typeof runPauses.$inferSelect;

/**
 * Các tình huống vận hành của lượt Level (mục 9.3): tạm dừng, đổi Buddy/CHT/QLKV, chuyển cửa hàng, ngừng theo dõi.
 * Quyền theo ma trận 3.3: CHT ◐ đề xuất tạm dừng, QLKV ◐ / BP ĐT duyệt; đổi phân công, chuyển cửa hàng, ngừng theo dõi: CHT ◐, QLKV ◐, BP ĐT.
 */
@Injectable()
export class RunManageService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly runs: RunContextService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  private async permissions(user: SessionUser, ctx: RunContext) {
    const record = AccessService.recordOf(ctx);
    // Lượt onboarding CHT do BP ĐT, QLKV quản lý; CHT (kể cả chính người được đào tạo) không tự đổi phân công, tạm dừng
    const cht = ctx.track !== 'nvbh' && (user.role === 'cht' || user.id === ctx.staff.userId);
    const update = !cht && (await this.access.can(user, 'update', record));
    const approve = !cht && (await this.access.can(user, 'approve', record));
    const open = isOpenRun(ctx.run.status) && ctx.staff.active;
    return { assign: update && open, requestPause: update && open, decidePause: approve && open, transfer: update && ctx.staff.active, stop: update && ctx.staff.active };
  }

  private async load(user: SessionUser, runId: number) {
    const ctx = await this.runs.load(runId);
    await this.access.assertCanViewRun(user, ctx);
    return { ctx, perm: await this.permissions(user, ctx) };
  }

  /** Cửa hàng người dùng được đặt nhân viên vào, kèm CHT/QLKV mặc định theo cửa hàng (mục 9.1) */
  private async storeOptions(user: SessionUser) {
    const [rows, storeScopes, areaScopes, active] = await Promise.all([
      this.db
        .select({ id: stores.id, name: stores.name, areaId: stores.areaId, areaName: areas.name })
        .from(stores)
        .innerJoin(areas, eq(areas.id, stores.areaId))
        .where(eq(stores.active, true))
        .orderBy(asc(stores.name)),
      this.db.select().from(userStoreScopes),
      this.db.select().from(userAreaScopes),
      this.db.select({ id: users.id, role: users.role }).from(users).where(eq(users.status, 'active')).orderBy(asc(users.fullName)),
    ]);
    const out = [];
    for (const s of rows) {
      if (!(await this.access.can(user, 'create', { userId: null, storeId: s.id, areaId: s.areaId, buddyId: null, chtId: null, qlkvId: null }))) continue;
      out.push({
        id: s.id,
        name: s.name,
        areaName: s.areaName,
        defaultChtId: active.find((u) => u.role === 'cht' && storeScopes.some((x) => x.userId === u.id && x.storeId === s.id))?.id ?? null,
        defaultQlkvId: active.find((u) => u.role === 'qlkv' && areaScopes.some((x) => x.userId === u.id && x.areaId === s.areaId))?.id ?? null,
      });
    }
    return out;
  }

  private async pauseViews(runId: number): Promise<PauseView[]> {
    const requester = alias(users, 'requester');
    const decider = alias(users, 'decider');
    const rows = await this.db
      .select({ p: runPauses, requestedByName: requester.fullName, decidedByName: decider.fullName })
      .from(runPauses)
      .innerJoin(requester, eq(requester.id, runPauses.requestedBy))
      .leftJoin(decider, eq(decider.id, runPauses.decidedBy))
      .where(eq(runPauses.runId, runId))
      .orderBy(desc(runPauses.fromDate));
    return rows.map(({ p, requestedByName, decidedByName }) => ({
      id: p.id,
      from: p.fromDate,
      to: p.toDate,
      days: pauseLength({ from: p.fromDate, to: p.toDate }),
      reason: p.reason,
      status: p.status,
      requestedByName,
      requestedAt: p.requestedAt.toISOString(),
      decidedByName,
      decidedAt: p.decidedAt?.toISOString() ?? null,
      decisionNote: p.decisionNote,
    }));
  }

  async manage(user: SessionUser, runId: number): Promise<RunManageResponse> {
    const { ctx, perm } = await this.load(user, runId);
    const candidates = await assignmentCandidates(this.db);
    return {
      today: await this.clock.today(),
      runId,
      track: ctx.track,
      staffId: ctx.staff.id,
      levelKey: ctx.run.levelKey,
      runStatus: ctx.run.status,
      startDate: ctx.run.startDate,
      plannedEnd: ctx.run.plannedEnd,
      storeId: ctx.staff.storeId,
      people: { buddyId: ctx.people.buddyId, chtId: ctx.people.chtId, qlkvId: ctx.people.qlkvId, trainerId: ctx.people.trainerId ?? null },
      options: {
        // NV không thể là Buddy của chính mình
        buddies: candidates.buddy.filter((c) => c.id !== ctx.staff.userId),
        chts: candidates.cht,
        qlkvs: candidates.qlkv,
        trainers: candidates.trainer,
        stores: perm.transfer ? await this.storeOptions(user) : [],
      },
      pauses: await this.pauseViews(runId),
      permissions: perm,
      buddyOf: ctx.staff.userId ? (await activeAssignmentsOf(this.db, ctx.staff.userId)).filter((a) => a.runId !== runId) : [],
      active: ctx.staff.active,
    };
  }

  /** Lùi mọi mốc chưa xong từ ngày bắt đầu tạm dừng (mục 10.2), ghi log từng thay đổi (R18) */
  private async applyPause(tx: Tx, ctx: RunContext, pause: PauseRow, by: number, now: Date) {
    const span = { from: pause.fromDate, to: pause.toDate };
    const tasks = await tx
      .select()
      .from(runTasks)
      .where(and(eq(runTasks.runId, ctx.run.id), notInArray(runTasks.status, ['done', 'na', 'void'])));
    const changes: (typeof taskDateChanges.$inferInsert)[] = [];
    for (const t of tasks) {
      const newOpen = shiftByPauses(t.openDate, [span]);
      const newDue = shiftByPauses(t.dueDate, [span]);
      if (newOpen === t.openDate && newDue === t.dueDate) continue;
      await tx.update(runTasks).set({ openDate: newOpen, dueDate: newDue, updatedAt: now }).where(eq(runTasks.id, t.id));
      changes.push({ taskId: t.id, oldOpen: t.openDate, oldDue: t.dueDate, newOpen, newDue, reason: 'pause', refId: pause.id, at: now, by });
    }
    if (changes.length) await tx.insert(taskDateChanges).values(changes);
    await tx.update(levelRuns).set({ plannedEnd: shiftByPauses(ctx.run.plannedEnd, [span]) }).where(eq(levelRuns.id, ctx.run.id));
    return changes.length;
  }

  /** CHT đề xuất (chờ QLKV hoặc BP ĐT duyệt); QLKV, BP ĐT tạo thì có hiệu lực ngay */
  async requestPause(user: SessionUser, runId: number, body: PauseBodyT): Promise<RunManageResponse> {
    const { ctx, perm } = await this.load(user, runId);
    if (!perm.requestPause) throw forbidden('CANNOT_PAUSE', 'Chỉ CHT, QLKV phụ trách hoặc BP Đào tạo được tạm dừng lượt Level đang mở');
    if (body.from < ctx.run.startDate) throw badRequest('INVALID_PAUSE', `Ngày bắt đầu tạm dừng không được trước ngày bắt đầu Level (${fmtDate(ctx.run.startDate)})`);
    const existing = await this.db
      .select()
      .from(runPauses)
      .where(and(eq(runPauses.runId, runId), inArray(runPauses.status, ['pending', 'approved'])));
    const clash = existing.find((p) => p.fromDate <= body.to && body.from <= p.toDate);
    if (clash) throw conflict('PAUSE_OVERLAP', `Trùng với lần tạm dừng ${fmtDate(clash.fromDate)} → ${fmtDate(clash.toDate)} (${clash.status === 'pending' ? 'đang chờ duyệt' : 'đã duyệt'})`);
    if (existing.some((p) => p.status === 'pending')) throw conflict('PAUSE_PENDING', 'Đang có một đề xuất tạm dừng chờ duyệt');

    const now = await this.clock.now();
    const approved = perm.decidePause;
    const days = pauseLength(body);
    await this.db.transaction(async (tx) => {
      const [pause] = await tx
        .insert(runPauses)
        .values({
          runId,
          fromDate: body.from,
          toDate: body.to,
          reason: body.reason,
          status: approved ? 'approved' : 'pending',
          requestedBy: user.id,
          requestedAt: now,
          decidedBy: approved ? user.id : null,
          decidedAt: approved ? now : null,
        })
        .returning();
      if (approved) await this.applyPause(tx, ctx, pause, user.id, now);
    });

    const link = `/nhan-su/${ctx.staff.id}?tab=manage&run=${runId}`;
    const range = `${fmtDate(body.from)} → ${fmtDate(body.to)} (${days} ngày)`;
    if (approved) {
      await this.notifications.notify([ctx.staff.userId, ctx.people.buddyId, ctx.people.chtId], { type: 'pause', title: `Lộ trình của ${ctx.staff.fullName} tạm dừng ${range}`, body: body.reason, link }, user.id);
    } else {
      const deciders = [ctx.people.qlkvId, ...(await this.notifications.activeIds({ role: 'bp' }))];
      await this.notifications.notify(deciders, { type: 'pause_request', title: `Đề xuất tạm dừng lộ trình ${ctx.staff.fullName} chờ duyệt`, body: `${range} · ${body.reason}`, link }, user.id);
    }
    return this.manage(user, runId);
  }

  async decidePause(user: SessionUser, runId: number, pauseId: number, body: { approve: boolean; note: string }): Promise<RunManageResponse> {
    const { ctx, perm } = await this.load(user, runId);
    if (!perm.decidePause) throw forbidden('CANNOT_DECIDE_PAUSE', 'Chỉ QLKV phụ trách hoặc BP Đào tạo duyệt tạm dừng');
    if (!body.approve && !body.note) throw badRequest('NOTE_REQUIRED', 'Nhập lý do từ chối để CHT biết');
    const now = await this.clock.now();
    const pause = await this.db.transaction(async (tx) => {
      const [p] = await tx
        .select()
        .from(runPauses)
        .where(and(eq(runPauses.id, pauseId), eq(runPauses.runId, runId)))
        .for('update');
      if (!p) throw notFound('PAUSE_NOT_FOUND', 'Không tìm thấy đề xuất tạm dừng');
      if (p.status !== 'pending') throw conflict('PAUSE_DECIDED', 'Đề xuất này đã được xử lý');
      await tx
        .update(runPauses)
        .set({ status: body.approve ? 'approved' : 'rejected', decidedBy: user.id, decidedAt: now, decisionNote: body.note || null })
        .where(eq(runPauses.id, pauseId));
      if (body.approve) await this.applyPause(tx, ctx, p, user.id, now);
      return p;
    });
    await this.notifications.notify(
      [pause.requestedBy, ...(body.approve ? [ctx.staff.userId, ctx.people.buddyId] : [])],
      {
        type: 'pause',
        title: `${body.approve ? 'Đã duyệt' : 'Từ chối'} tạm dừng lộ trình ${ctx.staff.fullName} ${fmtDate(pause.fromDate)} → ${fmtDate(pause.toDate)}`,
        body: body.note || null,
        link: `/nhan-su/${ctx.staff.id}?tab=manage&run=${runId}`,
      },
      user.id,
    );
    return this.manage(user, runId);
  }

  /** Đổi Buddy / CHT / QLKV: chỉ đổi người nhận các việc chưa xác nhận, lịch không đổi (mục 9.3) */
  async assign(user: SessionUser, runId: number, body: { role: AssignmentRole; userId: number }): Promise<RunManageResponse> {
    const { ctx, perm } = await this.load(user, runId);
    if (!perm.assign) throw forbidden('CANNOT_ASSIGN', 'Chỉ CHT, QLKV phụ trách hoặc BP Đào tạo được đổi phân công của lượt đang mở');
    const current = { buddy: ctx.people.buddyId, cht: ctx.people.chtId, qlkv: ctx.people.qlkvId, trainer: ctx.people.trainerId ?? null }[body.role];
    if (current === body.userId) return this.manage(user, runId);
    const [target] = await this.db.select().from(users).where(eq(users.id, body.userId));
    const label = ASSIGNMENT_LABEL[body.role];
    if (!target || !canHoldAssignment(body.role, target)) {
      throw badRequest(
        'INVALID_ASSIGNEE',
        body.role === 'buddy'
          ? 'Buddy phải là tài khoản đang hoạt động có quyền "Có thể làm Buddy" hoặc là CHT'
          : body.role === 'trainer'
            ? 'Người phụ trách Đào tạo phải là tài khoản BP Đào tạo đang hoạt động'
            : `${label} phải là tài khoản ${label} đang hoạt động`,
      );
    }
    if (body.role === 'buddy' && target.id === ctx.staff.userId) throw badRequest('INVALID_ASSIGNEE', 'Nhân viên không thể là Buddy của chính mình');
    const today = await this.clock.today();
    await this.db.transaction((tx) => reassign(tx, runId, body.role, target.id, today));
    await this.notifications.notify(
      [target.id],
      { type: 'assignment', title: `Bạn được phân công làm ${label} của ${ctx.staff.fullName}`, body: `Level ${ctx.run.levelKey} · ${ctx.staff.storeName}`, link: `/nhan-su/${ctx.staff.id}` },
      user.id,
    );
    return this.manage(user, runId);
  }

  private async staffRun(user: SessionUser, staffId: number) {
    const runRows = await this.db.select({ id: levelRuns.id, status: levelRuns.status }).from(levelRuns).where(eq(levelRuns.staffId, staffId)).orderBy(desc(levelRuns.startDate));
    if (!runRows.length) throw notFound('STAFF_NOT_FOUND', 'Không tìm thấy hồ sơ nhân viên');
    const current = runRows.find((r) => isOpenRun(r.status)) ?? runRows[0];
    return this.load(user, current.id);
  }

  /** Chuyển cửa hàng: đổi cửa hàng, có thể đổi luôn CHT/QLKV theo cửa hàng mới; lịch không đổi */
  async transfer(user: SessionUser, staffId: number, body: TransferBodyT): Promise<RunManageResponse> {
    const { ctx, perm } = await this.staffRun(user, staffId);
    if (!perm.transfer) throw forbidden('CANNOT_TRANSFER', 'Bạn không chuyển cửa hàng cho nhân viên này được');
    const [store] = await this.db.select().from(stores).where(and(eq(stores.id, body.storeId), eq(stores.active, true)));
    if (!store) throw badRequest('STORE_NOT_FOUND', 'Cửa hàng không tồn tại hoặc đã ngừng hoạt động');
    const allowed = await this.access.can(user, 'create', { userId: null, storeId: store.id, areaId: store.areaId, buddyId: null, chtId: null, qlkvId: null });
    if (!allowed) throw forbidden('OUT_OF_SCOPE', 'Cửa hàng mới nằm ngoài phạm vi của bạn');
    const ids = [body.chtId, body.qlkvId].filter((id): id is number => !!id);
    const people = new Map((ids.length ? await this.db.select().from(users).where(inArray(users.id, ids)) : []).map((u) => [u.id, u]));
    if (body.chtId && !canHoldAssignment('cht', people.get(body.chtId) ?? { role: 'nv', status: 'left', canBuddy: false })) throw badRequest('INVALID_ASSIGNEE', 'CHT phải là tài khoản CHT đang hoạt động');
    if (body.qlkvId && !canHoldAssignment('qlkv', people.get(body.qlkvId) ?? { role: 'nv', status: 'left', canBuddy: false })) throw badRequest('INVALID_ASSIGNEE', 'QLKV phải là tài khoản QLKV đang hoạt động');

    const today = await this.clock.today();
    const open = isOpenRun(ctx.run.status);
    await this.db.transaction(async (tx) => {
      await tx.update(staff).set({ storeId: store.id }).where(eq(staff.id, staffId));
      if (open && body.chtId && body.chtId !== ctx.people.chtId) await reassign(tx, ctx.run.id, 'cht', body.chtId, today);
      if (open && body.qlkvId && body.qlkvId !== ctx.people.qlkvId) await reassign(tx, ctx.run.id, 'qlkv', body.qlkvId, today);
    });
    await this.notifications.notify(
      [ctx.staff.userId, body.chtId, body.qlkvId],
      { type: 'transfer', title: `${ctx.staff.fullName} chuyển sang ${store.name}`, link: `/nhan-su/${staffId}` },
      user.id,
    );
    return this.manage(user, ctx.run.id);
  }

  /** Ngừng theo dõi (nghỉ việc): lượt chuyển Dừng, dữ liệu giữ nguyên; đang là Buddy của người khác thì phải chuyển giao */
  async stop(user: SessionUser, staffId: number, body: StopStaffBodyT): Promise<RunManageResponse> {
    const { ctx, perm } = await this.staffRun(user, staffId);
    if (!perm.stop) throw forbidden('CANNOT_STOP', 'Bạn không ngừng theo dõi được nhân viên này');
    const today = await this.clock.today();
    const now = await this.clock.now();
    await this.db.transaction(async (tx) => {
      if (ctx.staff.userId) {
        const affected = (await activeAssignmentsOf(tx, ctx.staff.userId)).filter((a) => a.staffId !== staffId);
        await applyHandover(tx, affected, body.handover, today, ctx.staff.userId);
      }
      await tx.update(staff).set({ active: false, stopReason: body.reason, stoppedAt: now, stoppedBy: user.id }).where(eq(staff.id, staffId));
      await tx
        .update(levelRuns)
        .set({ status: 'stopped' })
        .where(and(eq(levelRuns.staffId, staffId), inArray(levelRuns.status, ['active', 'paused', 'review'])));
    });
    return this.manage(user, ctx.run.id);
  }
}
