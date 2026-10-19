import { Inject, Injectable } from '@nestjs/common';
import {
  addDays,
  dayIndex,
  evaluateRubric,
  levelMonthOf,
  rubricOf,
  scoreObservation,
  type ObservationBodyT,
  type ObservationsResponse,
} from '@lotrinh/shared';
import { desc, eq } from 'drizzle-orm';
import { ClockService } from '../../adapters/clock/clock.service';
import { badRequest, forbidden } from '../../common/errors';
import type { SessionUser } from '../../common/session';
import type { Db } from '../../db/client';
import { DB } from '../../db/db.provider';
import { observations, users } from '../../db/schema';
import { AccessService } from '../access/access.service';
import { assertNvbh, RunContextService, type RunContext } from '../runs/run-context.service';

/** Ca quan sát Rubric (mục 11.5 tab Quan sát Rubric, Phụ lục C, R16) */
@Injectable()
export class ObservationsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly runs: RunContextService,
    private readonly access: AccessService,
  ) {}

  /** Ghi ca quan sát: Buddy, CHT, QLKV của lượt (mục 3.3); BP ĐT không ghi */
  private canAdd(user: SessionUser, ctx: RunContext, today: string) {
    const { buddyId, chtId, qlkvId } = ctx.people;
    return ctx.run.status === 'active' && ctx.run.startDate <= today && [buddyId, chtId, qlkvId].includes(user.id);
  }

  async list(user: SessionUser, runId: number): Promise<ObservationsResponse> {
    const ctx = await this.runs.load(runId);
    assertNvbh(ctx, 'quan sát Rubric');
    await this.access.assertCanViewRun(user, ctx);
    const today = await this.clock.today();
    const rubric = rubricOf(ctx.content);
    const rows = await this.db
      .select({ o: observations, observerName: users.fullName })
      .from(observations)
      .innerJoin(users, eq(users.id, observations.observerId))
      .where(eq(observations.runId, runId))
      .orderBy(desc(observations.obsDate), desc(observations.id));
    const month = levelMonthOf(Math.max(0, dayIndex(ctx.run.startDate, today)), ctx.level.months);
    const monthFrom = addDays(ctx.run.startDate, (month - 1) * 30);
    const monthTo = addDays(ctx.run.startDate, month * 30);
    return {
      today,
      runId,
      runStart: ctx.run.startDate,
      rubric,
      items: rows.map(({ o, observerName }) => {
        const s = scoreObservation(rubric, o.scores);
        return { id: o.id, date: o.obsDate, scores: o.scores, total: s.total, max: s.max, passed: s.passed, ones: s.ones, note: o.note, observerName, createdAt: o.createdAt.toISOString() };
      }),
      summary: evaluateRubric(rubric, rows.map(({ o }) => ({ scores: o.scores }))),
      thisMonth: rows.filter(({ o }) => o.obsDate >= monthFrom && o.obsDate < monthTo).length,
      canAdd: this.canAdd(user, ctx, today),
    };
  }

  async add(user: SessionUser, runId: number, body: ObservationBodyT): Promise<ObservationsResponse> {
    const ctx = await this.runs.load(runId);
    assertNvbh(ctx, 'quan sát Rubric');
    await this.access.assertCanViewRun(user, ctx);
    const today = await this.clock.today();
    if (!this.canAdd(user, ctx, today)) throw forbidden('CANNOT_OBSERVE', 'Chỉ Buddy, CHT, QLKV phụ trách lượt đang chạy được ghi ca quan sát');
    if (body.date < ctx.run.startDate || body.date > today) throw badRequest('INVALID_DATE', 'Ngày quan sát phải trong thời gian lượt Level và không sau hôm nay');
    const rubric = rubricOf(ctx.content);
    const scores: Record<string, number> = {};
    for (const c of rubric.criteria) {
      const v = body.scores[c.key];
      if (!Number.isInteger(v) || v < 1 || v > rubric.scaleMax) throw badRequest('INVALID_SCORE', `Chấm "${c.name}" từ 1 đến ${rubric.scaleMax}`);
      scores[c.key] = v;
    }
    await this.db.insert(observations).values({ runId, obsDate: body.date, scores, note: body.note || null, observerId: user.id });
    return this.list(user, runId);
  }
}
