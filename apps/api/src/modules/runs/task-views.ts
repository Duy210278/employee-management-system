import {
  computeTaskState,
  currentStageIndex,
  dayIndex,
  decideActions,
  levelItems,
  requiredRoles,
  stageWindow,
  type Actor,
  type IsoDate,
  type Item,
  type LevelSummary,
  type PathStep,
  type RunSummary,
  type Stage,
  type StageView,
  type TaskView,
} from '@lotrinh/shared';
import type { runTasks, taskConfirmations } from '../../db/schema';
import type { RunContext } from './run-context.service';

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

const OPEN_RUN_STATUSES = ['active', 'paused', 'review'];

/** Lượt đang mở của NV, nếu không có thì lượt gần nhất (danh sách đã xếp mới nhất trước) */
export function currentRunOf<T extends { status: string }>(runsNewestFirst: T[]): T | undefined {
  return runsNewestFirst.find((r) => OPEN_RUN_STATUSES.includes(r.status)) ?? runsNewestFirst[0];
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

export function stageViews(ctx: RunContext): StageView[] {
  return ctx.level.stages.map((s, index) => ({
    key: s.key,
    index,
    label: s.label,
    name: s.name,
    goal: s.goal,
    ...stageWindow(s, ctx.run.startDate),
  }));
}

export function summarizeRun(ctx: RunContext, views: TaskView[], today: IsoDate): RunSummary {
  const counted = views.filter((v) => v.status !== 'na' && v.status !== 'void');
  const done = counted.filter((v) => v.status === 'done').length;
  const stageIdx = currentStageIndex(ctx.level, ctx.run.startDate, today);
  const stage = stageIdx >= 0 ? ctx.level.stages[stageIdx] : null;
  return {
    id: ctx.run.id,
    levelKey: ctx.run.levelKey,
    versionCode: ctx.versionCode,
    startDate: ctx.run.startDate,
    plannedEnd: ctx.run.plannedEnd,
    status: ctx.run.status,
    dayIndex: dayIndex(ctx.run.startDate, today),
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
