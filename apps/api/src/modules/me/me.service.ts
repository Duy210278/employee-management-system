import { Inject, Injectable } from '@nestjs/common';
import {
  fmtDate,
  helpRoles,
  inboxPriority,
  isAssignee,
  pauseLength,
  STAGE_SIGN_LABEL,
  type AreaAlertItem,
  type InboxGroup,
  type InboxItem,
  type InboxResponse,
  type MeResponse,
  type SignatureTodo,
  type TaskView,
  type TodayResponse,
} from '@lotrinh/shared';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { env } from '../../config';
import { toActor, type SessionUser } from '../../common/session';
import { ClockService } from '../../adapters/clock/clock.service';
import { DB } from '../../db/db.provider';
import { AccessService } from '../access/access.service';
import { ReviewsService } from '../reviews/reviews.service';
import { RunContextService, type RunContext } from '../runs/run-context.service';
import { TaskQueryService } from '../runs/task-query.service';
import { buildPath, buildStageSigns, buildTaskViews, currentRunOf, levelSummary, summarizeRun } from '../runs/task-views';
import type { Db } from '../../db/client';
import { levelRuns, runAssignments, runPauses, staff } from '../../db/schema';

@Injectable()
export class MeService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly runs: RunContextService,
    private readonly taskQuery: TaskQueryService,
    private readonly reviews: ReviewsService,
    private readonly access: AccessService,
  ) {}

  /** Ký cuối giai đoạn sẵn sàng ký và đề xuất tạm dừng chờ người dùng duyệt (nhóm "Chữ ký chờ bạn") */
  private async operationTodos(user: SessionUser, contexts: RunContext[], views: Map<number, TaskView[]>, today: string): Promise<SignatureTodo[]> {
    const actor = toActor(user);
    const runIds = contexts.map((c) => c.run.id);
    const [signoffs, pending] = await Promise.all([
      this.taskQuery.loadSignoffs(runIds),
      runIds.length ? this.db.select().from(runPauses).where(and(inArray(runPauses.runId, runIds), eq(runPauses.status, 'pending'))) : [],
    ]);
    const out: SignatureTodo[] = [];
    for (const ctx of contexts) {
      const base = { runId: ctx.run.id, staffId: ctx.staff.id, staffName: ctx.staff.fullName, storeName: ctx.staff.storeName, levelKey: ctx.run.levelKey };
      const signs = buildStageSigns(ctx, views.get(ctx.run.id) ?? [], signoffs.get(ctx.run.id) ?? [], today, actor);
      for (const stage of ctx.level.stages) {
        const sign = signs.get(stage.key);
        const step = sign?.steps.find((s) => s.canSign);
        if (!sign || !step) continue;
        out.push({
          ...base,
          kind: 'stage',
          step: step.step,
          totalSteps: sign.steps.length,
          label: `Ký cuối ${stage.label} · ${STAGE_SIGN_LABEL[step.role]}`,
          detail: stage.name,
          dueOn: sign.dueOn,
          overdue: sign.overdue,
          tab: 'check',
        });
      }
      for (const p of pending.filter((x) => x.runId === ctx.run.id)) {
        if (!(await this.access.can(user, 'approve', AccessService.recordOf(ctx)))) continue;
        out.push({
          ...base,
          kind: 'pause',
          step: 0,
          totalSteps: 1,
          label: 'Duyệt đề xuất tạm dừng',
          detail: `${fmtDate(p.fromDate)} → ${fmtDate(p.toDate)} (${pauseLength({ from: p.fromDate, to: p.toDate })} ngày) · ${p.reason}`,
          dueOn: p.fromDate,
          overdue: false,
          tab: 'manage',
        });
      }
    }
    return out;
  }

  async me(user: SessionUser): Promise<MeResponse> {
    const [own] = await this.db.select({ id: staff.id }).from(staff).where(and(eq(staff.userId, user.id), eq(staff.active, true)));
    const buddyOf = await this.db
      .select({ runId: runAssignments.runId })
      .from(runAssignments)
      .innerJoin(levelRuns, eq(levelRuns.id, runAssignments.runId))
      .where(
        and(eq(runAssignments.userId, user.id), eq(runAssignments.role, 'buddy'), isNull(runAssignments.toDate), eq(levelRuns.status, 'active')),
      )
      .limit(1);
    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        canBuddy: user.canBuddy,
        canApproveVersions: user.canApproveVersions,
      },
      staffId: own?.id ?? null,
      isBuddyNow: buddyOf.length > 0,
      clock: await this.clock.view(),
      demoMode: env().DEMO_MODE,
    };
  }

  /** Màn "Hôm nay" của NV (mục 11.1): lượt Level hiện tại kèm mọi đầu việc đã tính trạng thái */
  async today(user: SessionUser): Promise<TodayResponse> {
    const today = await this.clock.today();
    const empty: TodayResponse = { today, staff: null, run: null, level: null, path: [], tasks: [], reviewToSign: null };
    const [own] = await this.db.select().from(staff).where(and(eq(staff.userId, user.id), eq(staff.active, true)));
    if (!own) return empty;

    const allRuns = await this.db.select().from(levelRuns).where(eq(levelRuns.staffId, own.id)).orderBy(desc(levelRuns.startDate));
    const current = currentRunOf(allRuns);
    if (!current) return empty;

    const ctx = await this.runs.load(current.id);
    const data = (await this.taskQuery.loadForRuns([ctx.run.id])).get(ctx.run.id)!;
    const tasks = buildTaskViews(ctx, data, today, toActor(user));
    return {
      today,
      staff: ctx.staff,
      run: summarizeRun(ctx, tasks, today),
      level: levelSummary(ctx),
      path: buildPath(ctx, allRuns),
      tasks,
      reviewToSign: await this.reviews.pendingForStaffUser(user, own.id),
    };
  }

  /**
   * Hàng đợi "Việc cần xử lý" (mục 10.5): mọi đầu việc người này còn phần chưa xác nhận,
   * xếp theo: NV đã báo xong hoặc cần hỗ trợ → quá hạn → đến hạn trong 7 ngày.
   */
  async inbox(user: SessionUser): Promise<InboxResponse> {
    const today = await this.clock.today();
    const actor = toActor(user);

    let runIds: number[];
    if (user.role === 'bp') {
      runIds = (await this.db.select({ id: levelRuns.id }).from(levelRuns).where(eq(levelRuns.status, 'active'))).map((r) => r.id);
    } else {
      runIds = (
        await this.db
          .selectDistinct({ id: runAssignments.runId })
          .from(runAssignments)
          .innerJoin(levelRuns, eq(levelRuns.id, runAssignments.runId))
          .where(and(eq(runAssignments.userId, user.id), isNull(runAssignments.toDate), inArray(levelRuns.status, ['active'])))
      ).map((r) => r.id);
    }

    // Checklist của chính mình nằm ở màn "Hôm nay", không vào hàng đợi
    const contexts = (await this.runs.loadMany(runIds)).filter((c) => c.staff.userId !== user.id);
    const dataByRun = await this.taskQuery.loadForRuns(contexts.map((c) => c.run.id));
    const groups: InboxGroup[] = [];
    const upcoming: InboxGroup[] = [];
    const viewsByRun = new Map(contexts.map((ctx) => [ctx.run.id, buildTaskViews(ctx, dataByRun.get(ctx.run.id)!, today, actor)]));
    const areaAlerts: AreaAlertItem[] = [];

    for (const ctx of contexts) {
      const views = viewsByRun.get(ctx.run.id)!;
      const summary = summarizeRun(ctx, views, today);
      // QLKV: việc của người khác quá hạn hơn escalateDays (mục 11.3, T-L08)
      if (user.role === 'qlkv' && ctx.people.qlkvId === user.id) {
        for (const v of views) {
          const others = v.actions.missing.filter((r) => r !== 'qlkv');
          if (v.state.overdueDays > ctx.content.scheduleParams.escalateDays && others.length) {
            areaAlerts.push({
              taskId: v.id,
              runId: ctx.run.id,
              staffId: ctx.staff.id,
              staffName: ctx.staff.fullName,
              storeName: ctx.staff.storeName,
              itemKey: v.itemKey,
              content: v.content,
              overdueDays: v.state.overdueDays,
              waitingFor: others,
            });
          }
        }
      }
      const started = summary.dayIndex >= 0;
      const firstStage = ctx.level.stages[0].key;
      const items: InboxItem[] = [];
      for (const v of views) {
        if (!started && v.stageKey !== firstStage) continue;
        // Đầu việc NV tự đánh giá đang cần hỗ trợ: vào hàng đợi người kèm cặp dù họ không có phần xác nhận
        const selfHelp = v.status === 'help' && v.requiredRoles.every((r) => r === 'nv');
        const roles = selfHelp ? [...v.actions.missing, ...helpRoles(v.requiredRoles, v.track)] : v.actions.missing;
        const myMissing = roles.filter((r) => isAssignee(actor, r, ctx.people));
        const priority = inboxPriority(
          { myMissing, confirmed: v.confirmations.map((c) => c.role), status: v.status, dueDate: v.dueDate, runStarted: started },
          today,
        );
        if (priority !== null) items.push({ ...v, priority });
      }
      if (!items.length) continue;
      items.sort((a, b) => a.priority - b.priority || a.dueDate.localeCompare(b.dueDate) || a.id - b.id);
      (started ? groups : upcoming).push({ staff: ctx.staff, run: summary, level: levelSummary(ctx), items });
    }

    const minPriority = (g: InboxGroup) => Math.min(...g.items.map((i) => i.priority));
    groups.sort((a, b) => minPriority(a) - minPriority(b) || a.staff.fullName.localeCompare(b.staff.fullName, 'vi'));
    upcoming.sort((a, b) => a.run.startDate.localeCompare(b.run.startDate));
    const all = groups.flatMap((g) => g.items);
    return {
      today,
      stats: {
        waiting: all.filter((i) => i.priority === 0).length,
        overdue: all.filter((i) => i.priority === 1).length,
        dueSoon: all.filter((i) => i.priority === 2).length,
        staffCount: new Set(contexts.map((c) => c.staff.id)).size,
      },
      groups,
      upcoming,
      signatures: [...(await this.reviews.todosFor(user, contexts, today)), ...(await this.operationTodos(user, contexts, viewsByRun, today))],
      areaAlerts: areaAlerts.sort((a, b) => b.overdueDays - a.overdueDays),
    };
  }
}
