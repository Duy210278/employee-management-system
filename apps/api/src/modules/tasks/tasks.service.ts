import { HttpException, Inject, Injectable } from '@nestjs/common';
import {
  decideActions,
  fillableSlots,
  helpRoles,
  isRunManager,
  levelItems,
  requiredRoles,
  ROLE_SHORT,
  statusAfterConfirmations,
  type ConfirmBodyT,
  type ConfirmManyBodyT,
  type ConfirmManyResult,
  type Item,
  type ReworkBodyT,
  type StatusBodyT,
  type TaskActions,
  type TaskEventView,
  type TaskRole,
  type TaskStatus,
  type TaskView,
  type UndoBodyT,
} from '@lotrinh/shared';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { badRequest, forbidden, notFound, staleData } from '../../common/errors';
import { toActor, type SessionUser } from '../../common/session';
import { AccessService } from '../access/access.service';
import { ClockService } from '../../adapters/clock/clock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DB } from '../../db/db.provider';
import { RunContextService, type RunContext } from '../runs/run-context.service';
import { TaskQueryService } from '../runs/task-query.service';
import { buildTaskViews } from '../runs/task-views';
import type { Db, Tx } from '../../db/client';
import { runTasks, taskConfirmations, taskEvents, users } from '../../db/schema';

interface Locked {
  task: typeof runTasks.$inferSelect;
  ctx: RunContext;
  required: TaskRole[];
  confirmations: (typeof taskConfirmations.$inferSelect)[];
  actions: TaskActions;
  gpp: boolean;
  blockedBy: string[];
  requireNvFirst: boolean;
}

const shortContent = (s: string) => (s.length > 80 ? `${s.slice(0, 77)}…` : s);

/** Câu báo lỗi tiếng Việt của một mục trong lượt duyệt nhanh */
function messageOf(err: unknown): string {
  if (err instanceof HttpException) {
    const res = err.getResponse();
    if (typeof res === 'object' && res && 'message' in res && typeof res.message === 'string') return res.message;
  }
  return 'Không xác nhận được, thử lại sau';
}

/** Nhãn lịch sử thao tác hiển thị cho người dùng */
export function eventLabel(action: string, role: TaskRole | null, proxyRole: TaskRole | null): string {
  const r = role ? ROLE_SHORT[role] : '';
  switch (action) {
    case 'report_done':
      return proxyRole ? `${ROLE_SHORT[proxyRole]} báo hoàn thành thay NV` : 'Báo hoàn thành';
    case 'confirm':
      return proxyRole ? `${ROLE_SHORT[proxyRole]} xác nhận thay ${r}` : `Xác nhận đạt (${r})`;
    case 'undo':
      return 'Hủy xác nhận';
    case 'rework':
      return 'Yêu cầu làm lại';
    case 'help':
      return 'Báo cần hỗ trợ';
    case 'clear_help':
      return 'Đã được hỗ trợ';
    case 'na':
      return 'Đánh dấu Bỏ qua / N-A';
    case 'set_doing':
      return 'Đặt trạng thái: Đang thực hiện';
    case 'set_todo':
      return 'Đặt trạng thái: Chưa bắt đầu';
    default:
      return action;
  }
}

/** Đầu việc của lượt: xác nhận hai phía, hủy, yêu cầu làm lại, cần hỗ trợ, N/A (R04–R10) */
@Injectable()
export class TasksService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly runs: RunContextService,
    private readonly taskQuery: TaskQueryService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Đầu việc kèm ngữ cảnh lượt để soạn thông báo */
  private async target(taskId: number) {
    const [task] = await this.db.select().from(runTasks).where(eq(runTasks.id, taskId));
    const ctx = await this.runs.load(task.runId);
    const item = levelItems(ctx.level).find((x) => x.item.key === task.itemKey)?.item;
    if (!item) return null;
    return { ctx, item, link: `/nhan-su/${ctx.staff.id}?tab=check&run=${ctx.run.id}`, short: shortContent(item.content) };
  }

  /** Người nhận thông báo NV báo xong / cần hỗ trợ: người đầu tiên còn thiếu xác nhận */
  private async nextConfirmers(taskId: number, ctx: RunContext, item: Item, kind: 'report_done' | 'help'): Promise<number[]> {
    const confirmed = await this.db
      .select({ role: taskConfirmations.role })
      .from(taskConfirmations)
      .where(and(eq(taskConfirmations.taskId, taskId), isNull(taskConfirmations.revokedAt)));
    // Đầu việc NV tự đánh giá: báo xong không cần ai xác nhận, cần hỗ trợ thì về người kèm cặp
    const roles = kind === 'help' ? helpRoles(requiredRoles(item), ctx.track) : requiredRoles(item);
    const missing = roles.filter((r) => r !== 'nv' && !confirmed.some((c) => c.role === r));
    return this.notifications.recipientsOf(missing.slice(0, 1), ctx.people);
  }

  /** Thông báo ngay (mục 10.6): NV báo xong / cần hỗ trợ → người xác nhận kế tiếp; yêu cầu làm lại → NV */
  private async announce(user: SessionUser, taskId: number, kind: 'report_done' | 'help' | 'rework', note: string | null) {
    const t = await this.target(taskId);
    if (!t) return;
    const { ctx, link, short } = t;
    if (kind === 'rework') {
      await this.notifications.notify(await this.notifications.recipientsOf(['nv'], ctx.people), {
        type: 'rework',
        title: `Yêu cầu làm lại: ${short}`,
        body: note,
        link: ctx.staff.userId ? '/hom-nay' : link,
      }, user.id);
      return;
    }
    await this.notifications.notify(await this.nextConfirmers(taskId, ctx, t.item, kind), {
      type: kind,
      title: kind === 'help' ? `${ctx.staff.fullName} cần hỗ trợ: ${short}` : `${ctx.staff.fullName} đã báo xong, chờ bạn xác nhận: ${short}`,
      body: note,
      link,
    }, user.id);
  }

  /** NV báo xong nhiều mục một lần: mỗi người xác nhận nhận một thông báo gom các mục của cùng nhân viên */
  private async announceMany(user: SessionUser, taskIds: number[], note: string | null) {
    const groups = new Map<number, { name: string; link: string; byUser: Map<number, string[]> }>();
    for (const id of taskIds) {
      const t = await this.target(id);
      if (!t) continue;
      const g = groups.get(t.ctx.run.id) ?? { name: t.ctx.staff.fullName, link: t.link, byUser: new Map() };
      groups.set(t.ctx.run.id, g);
      for (const uid of await this.nextConfirmers(id, t.ctx, t.item, 'report_done')) g.byUser.set(uid, [...(g.byUser.get(uid) ?? []), t.short]);
    }
    for (const g of groups.values()) {
      for (const [uid, items] of g.byUser) {
        await this.notifications.notify([uid], {
          type: 'report_done',
          title: items.length === 1 ? `${g.name} đã báo xong, chờ bạn xác nhận: ${items[0]}` : `${g.name} đã báo xong ${items.length} mục, chờ bạn xác nhận`,
          body: [items.length > 1 ? items.map((x) => `• ${x}`).join('\n') : '', note ?? ''].filter(Boolean).join('\n') || null,
          link: g.link,
        }, user.id);
      }
    }
  }

  /** Khóa đầu việc, kiểm tra phạm vi và rowVersion, tính quyền của người gọi bằng cùng hàm với giao diện */
  private async lock(tx: Tx, user: SessionUser, taskId: number, rowVersion: number): Promise<Locked> {
    const [task] = await tx.select().from(runTasks).where(eq(runTasks.id, taskId)).for('update');
    if (!task) throw notFound('TASK_NOT_FOUND', 'Không tìm thấy đầu việc');
    const ctx = await this.runs.load(task.runId);
    await this.access.assertCanViewRun(user, ctx);
    if (task.rowVersion !== rowVersion) throw staleData();

    const item = levelItems(ctx.level).find((x) => x.item.key === task.itemKey)?.item;
    if (!item) throw notFound('ITEM_NOT_FOUND', `Phiên bản không còn đầu việc ${task.itemKey}`);
    const confirmations = await tx
      .select()
      .from(taskConfirmations)
      .where(and(eq(taskConfirmations.taskId, taskId), isNull(taskConfirmations.revokedAt)));

    let blockedBy: string[] = [];
    if (item.dependsOn.length) {
      const deps = await tx
        .select({ key: runTasks.itemKey, status: runTasks.status })
        .from(runTasks)
        .where(and(eq(runTasks.runId, task.runId), inArray(runTasks.itemKey, item.dependsOn)));
      const finished = new Set(deps.filter((d) => d.status === 'done' || d.status === 'na').map((d) => d.key));
      blockedBy = item.dependsOn.filter((k) => !finished.has(k));
    }

    const required = requiredRoles(item);
    const actions = decideActions(toActor(user), ctx.people, {
      required,
      requireNvFirst: item.requireNvFirst,
      confirmations: confirmations.map((c) => ({ role: c.role, userId: c.userId })),
      status: task.status,
      gpp: item.gpp,
      allowNa: item.allowNa,
      blockedBy,
    });
    return { task, ctx, required, confirmations, actions, gpp: item.gpp, blockedBy, requireNvFirst: item.requireNvFirst };
  }

  private async save(tx: Tx, taskId: number, patch: Partial<typeof runTasks.$inferInsert>): Promise<void> {
    await tx
      .update(runTasks)
      .set({ ...patch, rowVersion: sql`${runTasks.rowVersion} + 1`, updatedAt: new Date() })
      .where(eq(runTasks.id, taskId));
  }

  private cannotConfirmReason(l: Locked, user: SessionUser): string {
    if (l.task.status === 'done') return 'Đầu việc đã hoàn thành';
    if (l.task.status === 'na' || l.task.status === 'void') return 'Đầu việc không còn áp dụng';
    if (l.blockedBy.length) return `Chưa xác nhận được: còn chờ ${l.blockedBy.join(', ')}`;
    const mySlots = fillableSlots(toActor(user), l.ctx.people).map((s) => s.role);
    const myMissing = l.actions.missing.filter((r) => mySlots.includes(r));
    if (myMissing.includes('nv') && !l.ctx.people.acknowledged) return 'Đọc và xác nhận Tổng quan Level trước khi báo hoàn thành';
    if (myMissing.length && l.requireNvFirst && l.actions.missing.includes('nv')) return 'Chờ nhân viên báo hoàn thành trước khi xác nhận';
    return 'Bạn không có phần xác nhận nào còn thiếu ở đầu việc này';
  }

  async confirm(user: SessionUser, taskId: number, body: ConfirmBodyT): Promise<TaskView> {
    if (await this.confirmOne(user, taskId, body)) await this.announce(user, taskId, 'report_done', body.note || null);
    return this.view(user, taskId);
  }

  /** Duyệt nhanh: mỗi đầu việc một transaction riêng, mục lỗi không chặn các mục còn lại */
  async confirmMany(user: SessionUser, body: ConfirmManyBodyT): Promise<ConfirmManyResult> {
    const tasks = [...new Map(body.tasks.map((t) => [t.id, t])).values()];
    const reported: number[] = [];
    const failed: ConfirmManyResult['failed'] = [];
    for (const t of tasks) {
      try {
        if (await this.confirmOne(user, t.id, { rowVersion: t.rowVersion, note: body.note })) reported.push(t.id);
      } catch (err) {
        const [row] = await this.db.select({ itemKey: runTasks.itemKey }).from(runTasks).where(eq(runTasks.id, t.id));
        failed.push({ id: t.id, itemKey: row?.itemKey ?? null, message: messageOf(err) });
      }
    }
    if (reported.length === 1) await this.announce(user, reported[0], 'report_done', body.note || null);
    else if (reported.length > 1) await this.announceMany(user, reported, body.note || null);
    return { confirmed: tasks.length - failed.length, failed };
  }

  /** Điền ô xác nhận của người gọi; trả về true khi đó là phần NV báo hoàn thành */
  private confirmOne(user: SessionUser, taskId: number, body: ConfirmBodyT): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const l = await this.lock(tx, user, taskId, body.rowVersion);
      const slot = l.actions.confirmAs;
      if (!slot) throw forbidden('CANNOT_CONFIRM', this.cannotConfirmReason(l, user));
      if (body.role && body.role !== slot.role) throw forbidden('CANNOT_CONFIRM', `Bạn không xác nhận được vai trò ${ROLE_SHORT[body.role]} lúc này`);

      const now = await this.clock.now();
      const note = body.note || null;
      await tx.insert(taskConfirmations).values({ taskId, role: slot.role, userId: user.id, proxyRole: slot.proxyRole, at: now, note });
      const status = statusAfterConfirmations(l.required, [...l.confirmations.map((c) => c.role), slot.role], l.task.status);
      await this.save(tx, taskId, {
        status,
        doneDate: status === 'done' ? await this.clock.today() : null,
        reworkNote: null,
        reworkBy: null,
        reworkAt: null,
      });
      await tx.insert(taskEvents).values({
        taskId,
        userId: user.id,
        role: slot.role,
        proxyRole: slot.proxyRole,
        action: slot.role === 'nv' ? 'report_done' : 'confirm',
        note,
        at: now,
      });
      return slot.role === 'nv';
    });
  }

  /** R08: mỗi người chỉ hủy được xác nhận của chính mình */
  async undo(user: SessionUser, taskId: number, body: UndoBodyT): Promise<TaskView> {
    await this.db.transaction(async (tx) => {
      const l = await this.lock(tx, user, taskId, body.rowVersion);
      if (!l.actions.canUndo) throw forbidden('CANNOT_UNDO', 'Bạn chưa có xác nhận nào ở đầu việc này');
      const mine = l.confirmations.filter((c) => c.userId === user.id);
      const now = await this.clock.now();
      await tx
        .update(taskConfirmations)
        .set({ revokedAt: now, revokedBy: user.id })
        .where(inArray(taskConfirmations.id, mine.map((c) => c.id)));
      const remaining = l.confirmations.filter((c) => c.userId !== user.id).map((c) => c.role);
      await this.save(tx, taskId, { status: statusAfterConfirmations(l.required, remaining, l.task.status), doneDate: null });
      await tx.insert(taskEvents).values({ taskId, userId: user.id, role: mine[0].role, proxyRole: mine[0].proxyRole, action: 'undo', at: now });
    });
    return this.view(user, taskId);
  }

  /** R07: bắt buộc có lý do, xóa mọi xác nhận hiện có */
  async rework(user: SessionUser, taskId: number, body: ReworkBodyT): Promise<TaskView> {
    await this.db.transaction(async (tx) => {
      const l = await this.lock(tx, user, taskId, body.rowVersion);
      if (!l.actions.canRework) {
        throw forbidden(
          'CANNOT_REWORK',
          l.confirmations.length
            ? 'Chỉ CHT, QLKV phụ trách hoặc BP Đào tạo được yêu cầu làm lại'
            : 'Đầu việc chưa có xác nhận nào để yêu cầu làm lại',
        );
      }
      const now = await this.clock.now();
      if (l.confirmations.length) {
        await tx
          .update(taskConfirmations)
          .set({ revokedAt: now, revokedBy: user.id })
          .where(inArray(taskConfirmations.id, l.confirmations.map((c) => c.id)));
      }
      await this.save(tx, taskId, { status: 'todo', doneDate: null, reworkNote: body.note, reworkBy: user.id, reworkAt: now });
      await tx.insert(taskEvents).values({ taskId, userId: user.id, role: user.role, action: 'rework', note: body.note, at: now });
    });
    await this.announce(user, taskId, 'rework', body.note);
    return this.view(user, taskId);
  }

  /** Đổi trạng thái tay: Cần hỗ trợ, Bỏ qua/N-A (R09), Đang thực hiện, Chưa bắt đầu */
  async setStatus(user: SessionUser, taskId: number, body: StatusBodyT): Promise<TaskView> {
    const action = await this.db.transaction(async (tx) => {
      const l = await this.lock(tx, user, taskId, body.rowVersion);
      const now = await this.clock.now();
      const note = body.note?.trim() || null;
      let status: TaskStatus;
      let action: string;
      const patch: Partial<typeof runTasks.$inferInsert> = {};

      switch (body.status) {
        case 'help':
          if (!l.actions.canHelp) throw forbidden('CANNOT_HELP', 'Chỉ nhân viên (hoặc người báo thay) được báo cần hỗ trợ cho mục chưa báo xong');
          if (!note) throw badRequest('NOTE_REQUIRED', 'Ghi rõ bạn cần hỗ trợ gì vào ô ghi chú');
          status = 'help';
          action = 'help';
          break;
        case 'na':
          if (!l.actions.canNa) {
            throw forbidden('CANNOT_NA', l.gpp ? 'Mục GPP bắt buộc, không được bỏ qua' : 'Chỉ CHT, QLKV phụ trách hoặc BP Đào tạo được đánh N/A');
          }
          if (!note) throw badRequest('NOTE_REQUIRED', 'Nhập lý do bỏ qua vào ô ghi chú');
          status = 'na';
          action = 'na';
          patch.naReason = note;
          break;
        case 'todo':
        case 'doing': {
          const actor = toActor(user);
          const canSet = fillableSlots(actor, l.ctx.people).some((s) => s.role === 'nv') || isRunManager(actor, l.ctx.people);
          if (l.task.status === 'help' && body.status === 'todo') {
            if (!l.actions.canClearHelp) throw forbidden('CANNOT_SET_STATUS', 'Bạn không đổi được trạng thái mục này');
            status = statusAfterConfirmations(l.required, l.confirmations.map((c) => c.role), 'todo');
            action = 'clear_help';
          } else if (canSet && l.confirmations.length === 0 && (l.task.status === 'todo' || l.task.status === 'doing')) {
            status = body.status;
            action = body.status === 'doing' ? 'set_doing' : 'set_todo';
          } else {
            throw forbidden('CANNOT_SET_STATUS', 'Bạn không đổi được trạng thái mục này');
          }
          break;
        }
      }
      await this.save(tx, taskId, { ...patch, status });
      await tx.insert(taskEvents).values({ taskId, userId: user.id, role: user.role, action, note, at: now });
      return action;
    });
    if (action === 'help') await this.announce(user, taskId, 'help', body.note?.trim() || null);
    return this.view(user, taskId);
  }

  async events(user: SessionUser, taskId: number): Promise<TaskEventView[]> {
    const [task] = await this.db.select({ runId: runTasks.runId }).from(runTasks).where(eq(runTasks.id, taskId));
    if (!task) throw notFound('TASK_NOT_FOUND', 'Không tìm thấy đầu việc');
    await this.access.assertCanViewRun(user, await this.runs.load(task.runId));
    const rows = await this.db
      .select({ e: taskEvents, userName: users.fullName })
      .from(taskEvents)
      .innerJoin(users, eq(users.id, taskEvents.userId))
      .where(eq(taskEvents.taskId, taskId))
      .orderBy(desc(taskEvents.at), desc(taskEvents.id));
    return rows.map(({ e, userName }) => ({
      id: e.id,
      at: e.at.toISOString(),
      userName,
      role: e.role,
      action: e.action,
      actionLabel: eventLabel(e.action, e.role, e.proxyRole),
      note: e.note,
    }));
  }

  /** Trạng thái mới của đầu việc sau thao tác, tính cho người vừa thao tác */
  async view(user: SessionUser, taskId: number): Promise<TaskView> {
    const [task] = await this.db.select({ runId: runTasks.runId }).from(runTasks).where(eq(runTasks.id, taskId));
    const ctx = await this.runs.load(task.runId);
    const data = (await this.taskQuery.loadForRuns([task.runId])).get(task.runId)!;
    const view = buildTaskViews(ctx, data, await this.clock.today(), toActor(user)).find((v) => v.id === taskId);
    if (!view) throw notFound('TASK_NOT_FOUND', 'Không tìm thấy đầu việc');
    return view;
  }
}
