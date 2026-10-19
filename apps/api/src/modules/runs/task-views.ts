import {
  activePause,
  canSignAs,
  computeTaskState,
  currentStageIndex,
  dayIndex,
  decideActions,
  levelItems,
  pauseLength,
  requiredRoles,
  STAGE_SIGN_LABEL,
  stageSignState,
  stageWindow,
  type Actor,
  type IsoDate,
  type Item,
  type LevelSummary,
  type PathStep,
  type RunSummary,
  type Stage,
  type StageSignView,
  type StageView,
  type TaskView,
} from '@lotrinh/shared';
import type { runTasks, stageSignoffs, taskConfirmations } from '../../db/schema';
import type { RunContext } from './run-context.service';

export type SignoffRow = typeof stageSignoffs.$inferSelect & { userName: string };

export type RunTaskRow = typeof runTasks.$inferSelect;
export type ConfirmationRow = typeof taskConfirmations.$inferSelect & { userName: string };

export interface RunTaskData {
  tasks: RunTaskRow[];
  /** Chỉ các xác nhận còn hiệu lực */
  confirmations: ConfirmationRow[];
  userNames: Map<number, string>;
}

/** Ghép đầu việc đã lưu với nội dung phiên bản, tính trạng thái hiển thị và nút thao tác cho người xem */
export function buildTaskViews(ctx: RunContext, data: RunTaskData, today: IsoDate, actor: Actor): TaskView[] {
  const items = new Map<string, { item: Item; stage: Stage }>(levelItems(ctx.level).map(({ item, stage }) => [item.key, { item, stage }]));
  const finishedKeys = new Set(data.tasks.filter((t) => t.status === 'done' || t.status === 'na').map((t) => t.itemKey));
  const params = ctx.content.scheduleParams;
  const views: TaskView[] = [];

  for (const task of data.tasks) {
    const found = items.get(task.itemKey);
    if (!found) continue;
    const { item, stage } = found;
    const confirmations = data.confirmations.filter((c) => c.taskId === task.id);
    const required = requiredRoles(item);
    const blockedBy = item.dependsOn.filter((k) => !finishedKeys.has(k));
    const reworkPending = task.reworkNote !== null && task.status !== 'done';

    views.push({
      id: task.id,
      runId: ctx.run.id,
      staffId: ctx.staff.id,
      staffName: ctx.staff.fullName,
      itemKey: item.key,
      stageKey: stage.key,
      stageLabel: stage.label,
      category: item.category,
      content: item.content,
      guidance: item.guidance,
      gpp: item.gpp,
      openDate: task.openDate,
      dueDate: task.dueDate,
      doneDate: task.doneDate,
      status: task.status,
      rowVersion: task.rowVersion,
      requiredRoles: required,
      confirmations: confirmations.map((c) => ({
        role: c.role,
        userId: c.userId,
        userName: c.userName,
        proxyRole: c.proxyRole,
        at: c.at.toISOString(),
        note: c.note,
      })),
      state: computeTaskState(
        { status: task.status, openDate: task.openDate, dueDate: task.dueDate, doneDate: task.doneDate, reworkPending, blockedBy },
        today,
        params,
      ),
      rework:
        reworkPending && task.reworkAt
          ? { note: task.reworkNote!, byName: data.userNames.get(task.reworkBy ?? -1) ?? '(không rõ)', at: task.reworkAt.toISOString() }
          : null,
      naReason: task.naReason,
      blockedBy,
      actions: decideActions(actor, ctx.people, {
        required,
        requireNvFirst: item.requireNvFirst,
        confirmations: confirmations.map((c) => ({ role: c.role, userId: c.userId })),
        status: task.status,
        gpp: item.gpp,
        allowNa: item.allowNa,
        blockedBy,
      }),
    });
  }
  return views;
}

export const OPEN_RUN_STATUSES = ['active', 'paused', 'review'] as const;
export const isOpenRun = (status: string) => (OPEN_RUN_STATUSES as readonly string[]).includes(status);

/** Lượt đang mở của NV, nếu không có thì lượt gần nhất (danh sách đã xếp mới nhất trước) */
export function currentRunOf<T extends { status: string }>(runsNewestFirst: T[]): T | undefined {
  return runsNewestFirst.find((r) => isOpenRun(r.status)) ?? runsNewestFirst[0];
}

/** Thanh "Lộ trình 4 Level" (mục 9.2) */
export function buildPath(ctx: RunContext, allRuns: { levelKey: number; startDate: IsoDate; plannedEnd: IsoDate }[]): PathStep[] {
  return ctx.content.levels.map((l) => {
    const run = allRuns.find((r) => r.levelKey === l.key);
    return {
      levelKey: l.key,
      name: l.name,
      phase: l.phase,
      durationLabel: l.durationLabel,
      state: l.key < ctx.run.levelKey ? 'past' : l.key === ctx.run.levelKey ? 'current' : 'future',
      from: run?.startDate ?? null,
      to: run?.plannedEnd ?? null,
    };
  });
}

export function levelSummary(ctx: RunContext): LevelSummary {
  const l = ctx.level;
  return {
    key: l.key,
    name: l.name,
    phase: l.phase,
    motto: l.motto,
    durationLabel: l.durationLabel,
    rangeLabel: l.rangeLabel,
    totalDays: l.totalDays,
    checklistName: l.checklistName,
  };
}

const FINISHED = new Set(['done', 'na', 'void']);

/**
 * Ký cuối giai đoạn (mục 10.2, R11, R12) của từng giai đoạn: cửa sổ ký, số mục bắt buộc còn dở, ai ký bước kế tiếp.
 * Dùng cho tab Checklist, nhóm "Chữ ký chờ bạn", cảnh báo trễ ký và kiểm tra khi ký.
 */
export function buildStageSigns(ctx: RunContext, views: TaskView[], signoffs: SignoffRow[], today: IsoDate, actor: Actor | null): Map<string, StageSignView> {
  const out = new Map<string, StageSignView>();
  const open = isOpenRun(ctx.run.status);
  for (const stage of ctx.level.stages) {
    if (!stage.signers.length) continue;
    const required = new Set(stage.items.filter((i) => i.required).map((i) => i.key));
    const requiredLeft = views.filter((v) => v.stageKey === stage.key && required.has(v.itemKey) && !FINISHED.has(v.status)).length;
    const signed = signoffs.filter((s) => s.stageKey === stage.key);
    const st = stageSignState(
      {
        signers: stage.signers,
        signedSteps: signed.map((s) => s.step),
        window: stageWindow(stage, ctx.run.startDate, ctx.pauses),
        params: ctx.content.scheduleParams,
        requiredLeft,
      },
      today,
    );
    out.set(stage.key, {
      opensOn: st.opensOn,
      dueOn: st.dueOn,
      complete: st.complete,
      ready: st.ready && open,
      overdue: st.overdue && open,
      blocked: open ? st.blocked : st.complete ? null : 'Lượt Level đã đóng',
      steps: stage.signers.map((role, step) => {
        const s = signed.find((x) => x.step === step);
        const isNext = step === st.next;
        return {
          step,
          role,
          label: STAGE_SIGN_LABEL[role],
          signedByName: s?.userName ?? null,
          at: s?.at.toISOString() ?? null,
          state: s ? 'signed' : isNext ? 'next' : 'waiting',
          canSign: open && isNext && st.ready && actor !== null && canSignAs(actor, ctx.people, role),
        };
      }),
    });
  }
  return out;
}

export function stageViews(ctx: RunContext, signs: Map<string, StageSignView> = new Map()): StageView[] {
  return ctx.level.stages.map((s, index) => ({
    key: s.key,
    index,
    label: s.label,
    name: s.name,
    goal: s.goal,
    ...stageWindow(s, ctx.run.startDate, ctx.pauses),
    sign: signs.get(s.key) ?? null,
  }));
}

/** Ngày thứ mấy của lượt, đã trừ ngày tạm dừng */
export const dayIndexOf = (ctx: RunContext, today: IsoDate) => dayIndex(ctx.run.startDate, today, ctx.pauses);

export function summarizeRun(ctx: RunContext, views: TaskView[], today: IsoDate): RunSummary {
  const counted = views.filter((v) => v.status !== 'na' && v.status !== 'void');
  const done = counted.filter((v) => v.status === 'done').length;
  const stageIdx = currentStageIndex(ctx.level, ctx.run.startDate, today, ctx.pauses);
  const stage = stageIdx >= 0 ? ctx.level.stages[stageIdx] : null;
  return {
    id: ctx.run.id,
    levelKey: ctx.run.levelKey,
    versionCode: ctx.versionCode,
    startDate: ctx.run.startDate,
    plannedEnd: ctx.run.plannedEnd,
    status: ctx.run.status,
    pause: isOpenRun(ctx.run.status) ? activePause(today, ctx.pauses) : null,
    pausedDays: ctx.pauses.reduce((a, p) => a + pauseLength(p), 0),
    dayIndex: dayIndex(ctx.run.startDate, today, ctx.pauses),
    acknowledged: ctx.run.ackAt !== null,
    ackAt: ctx.run.ackAt?.toISOString() ?? null,
    ackByName: ctx.names.ackBy,
    currentStage: stage ? { key: stage.key, label: stage.label, name: stage.name, index: stageIdx } : null,
    progress: { done, total: counted.length, pct: counted.length ? done / counted.length : 0 },
    counts: {
      overdue: views.filter((v) => v.state.overdueDays > 0).length,
      rework: views.filter((v) => v.rework !== null).length,
      waiting: views.filter((v) => v.status === 'doing' && v.confirmations.some((c) => c.role === 'nv')).length,
    },
  };
}
