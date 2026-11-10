import { Inject, Injectable } from '@nestjs/common';
import {
  computeAlerts,
  countAlerts,
  evaluateRubric,
  rubricOf,
  todayIn,
  type Alert,
  type AlertRow,
  type AlertsResponse,
  type IsoDate,
  type TaskView,
} from '@lotrinh/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { ClockService } from '../../adapters/clock/clock.service';
import { env } from '../../config';
import { toActor, type SessionUser } from '../../common/session';
import type { Db } from '../../db/client';
import { DB } from '../../db/db.provider';
import { levelRuns, observations, runEvaluations, salesMonthly, staff, stores, users } from '../../db/schema';
import { AccessService } from '../access/access.service';
import { RunContextService, type RunContext } from '../runs/run-context.service';
import { TaskQueryService } from '../runs/task-query.service';
import { buildStageSigns, buildTaskViews, currentRunOf, dayIndexOf, isOpenRun } from '../runs/task-views';

/**
 * Cảnh báo (mục 11.6): tính trực tiếp từ dữ liệu mỗi lần đọc nên luôn khớp với ngày hôm nay.
 * Job "alerts-refresh" vì vậy không cần lưu bảng riêng.
 */
@Injectable()
export class AlertsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly runs: RunContextService,
    private readonly taskQuery: TaskQueryService,
    private readonly access: AccessService,
  ) {}

  async forRuns(contexts: RunContext[], viewsByRun: Map<number, TaskView[]>, today: IsoDate): Promise<Map<number, Alert[]>> {
    const out = new Map<number, Alert[]>();
    const runIds = contexts.map((c) => c.run.id);
    if (!runIds.length) return out;
    const userIds = contexts.map((c) => c.staff.userId).filter((id): id is number => id !== null);
    const [sales, obs, seen, signoffs, evaluations] = await Promise.all([
      this.db.select().from(salesMonthly).where(inArray(salesMonthly.runId, runIds)),
      this.db.select({ runId: observations.runId, scores: observations.scores }).from(observations).where(inArray(observations.runId, runIds)),
      userIds.length ? this.db.select({ id: users.id, at: users.lastSeenAt }).from(users).where(inArray(users.id, userIds)) : [],
      this.taskQuery.loadSignoffs(runIds),
      this.db.select({ runId: runEvaluations.runId, risk: runEvaluations.risk }).from(runEvaluations).where(inArray(runEvaluations.runId, runIds)),
    ]);
    const lastSeen = new Map(seen.map((u) => [u.id, u.at ? todayIn(env().TZ, u.at) : null]));

    for (const ctx of contexts) {
      if (!isOpenRun(ctx.run.status)) {
        out.set(ctx.run.id, []);
        continue;
      }
      const views = viewsByRun.get(ctx.run.id) ?? [];
      const rubric = rubricOf(ctx.content);
      const runObs = obs.filter((o) => o.runId === ctx.run.id);
      const rubricEval = evaluateRubric(rubric, runObs);
      const critical = rubric.criteria.filter((c) => c.critical).map((c) => c.key);
      const signs = buildStageSigns(ctx, views, signoffs.get(ctx.run.id) ?? [], today, null);
      out.set(
        ctx.run.id,
        computeAlerts({
          today,
          levelKey: ctx.run.levelKey,
          dayIndex: dayIndexOf(ctx, today),
          open: true,
          plannedEnd: ctx.run.plannedEnd,
          hasBuddy: ctx.people.buddyId !== null,
          hasCht: ctx.people.chtId !== null,
          overdue: views.filter((v) => v.state.overdueDays > 0).map((v) => ({ gpp: v.gpp, days: v.state.overdueDays })),
          escalateDays: ctx.content.scheduleParams.escalateDays,
          sales: sales.filter((s) => s.runId === ctx.run.id).map((s) => ({ month: s.monthIndex, total: s.total })),
          salesReference: ctx.level.kpi.total,
          rubric: { count: rubricEval.count, rate: rubricEval.rate, meetsTarget: rubricEval.meetsTarget, target: rubric.targetRate },
          safetyErrors: runObs.filter((o) => critical.some((k) => o.scores[k] === 1)).length,
          hasAccount: ctx.staff.userId !== null,
          lastSeen: ctx.staff.userId ? (lastSeen.get(ctx.staff.userId) ?? null) : null,
          lateStageSigns: [...signs.values()].filter((s) => s.overdue).length,
          track: ctx.track,
          attritionRisk: evaluations.find((e) => e.runId === ctx.run.id)?.risk ?? null,
        }),
      );
    }
    return out;
  }

  /** Lượt hiện tại của mọi NV đang theo dõi trong phạm vi (cùng phạm vi với danh sách Nhân sự) */
  async currentRunsInScope(user: SessionUser): Promise<RunContext[]> {
    const scope = await this.access.staffScope(user);
    const rows = await this.db
      .select({ id: staff.id })
      .from(staff)
      .innerJoin(stores, eq(stores.id, staff.storeId))
      .where(scope ? and(eq(staff.active, true), scope) : eq(staff.active, true));
    const staffIds = rows.map((r) => r.id);
    const runRows = staffIds.length ? await this.db.select().from(levelRuns).where(inArray(levelRuns.staffId, staffIds)).orderBy(desc(levelRuns.startDate)) : [];
    const currentIds = staffIds.map((id) => currentRunOf(runRows.filter((r) => r.staffId === id))?.id).filter((id): id is number => id !== undefined);
    return this.runs.loadMany(currentIds);
  }

  async list(user: SessionUser): Promise<AlertsResponse> {
    const today = await this.clock.today();
    const contexts = await this.currentRunsInScope(user);
    const data = await this.taskQuery.loadForRuns(contexts.map((c) => c.run.id));
    const actor = toActor(user);
    const views = new Map(contexts.map((c) => [c.run.id, buildTaskViews(c, data.get(c.run.id)!, today, actor)]));
    const alerts = await this.forRuns(contexts, views, today);
    const items: AlertRow[] = contexts.flatMap((c) =>
      (alerts.get(c.run.id) ?? []).map((a) => ({
        ...a,
        track: c.track,
        staffId: c.staff.id,
        staffName: c.staff.fullName,
        employeeCode: c.staff.employeeCode,
        storeName: c.staff.storeName,
        levelKey: c.run.levelKey,
        runId: c.run.id,
      })),
    );
    items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'red' ? -1 : 1) || a.staffName.localeCompare(b.staffName, 'vi'));
    return { today, items, counts: { ...countAlerts(items), staff: new Set(items.map((i) => i.staffId)).size } };
  }
}
