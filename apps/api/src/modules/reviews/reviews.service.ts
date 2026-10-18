import { Inject, Injectable } from '@nestjs/common';
import {
  addDays,
  canSignAs,
  evaluateKpi,
  evaluateRubric,
  fmtDate,
  nextSignStep,
  outcomeStep,
  RESULT_LABEL,
  reviewFormOf,
  reviewProblems,
  rubricOf,
  SIGN_STEP_LABEL,
  type CriterionResult,
  type ReviewDraft,
  type ReviewResponse,
  type SaveReviewBodyT,
  type SignatureTodo,
} from '@lotrinh/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { ClockService } from '../../adapters/clock/clock.service';
import { badRequest, conflict, forbidden, staleData } from '../../common/errors';
import { toActor, type SessionUser } from '../../common/session';
import type { Db, Tx } from '../../db/client';
import { DB } from '../../db/db.provider';
import { levelReviews, levelRuns, observations, reviewSignatures, salesMonthly, staff, users } from '../../db/schema';
import { AccessService } from '../access/access.service';
import { createRun, findVersionForDate } from '../runs/run-factory';
import { RunContextService, type RunContext } from '../runs/run-context.service';
import { TaskQueryService } from '../runs/task-query.service';
import { buildTaskViews, levelSummary, summarizeRun } from '../runs/task-views';

type ReviewRow = typeof levelReviews.$inferSelect;
type SignatureRow = typeof reviewSignatures.$inferSelect;

/** Vòng phiếu đang xét: phiếu mới nhất, hoặc vòng mới sau khi gia hạn đã được áp dụng */
function currentRound(reviews: ReviewRow[]): { round: number; row: ReviewRow | null } {
  const latest = reviews.at(-1);
  if (!latest) return { round: 0, row: null };
  if (latest.appliedAt && latest.result === 'extend') return { round: latest.round + 1, row: null };
  return { round: latest.round, row: latest };
}

/**
 * Phiếu đánh giá tổng kết, chuỗi ký và chuyển Level (mục 7.4, 9.3, 11.5, R12–R14).
 */
@Injectable()
export class ReviewsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly runs: RunContextService,
    private readonly taskQuery: TaskQueryService,
    private readonly access: AccessService,
  ) {}

  private async reviewsOf(runIds: number[]) {
    if (!runIds.length) return { reviews: [] as ReviewRow[], signatures: [] as (SignatureRow & { name: string })[] };
    const reviews = await this.db.select().from(levelReviews).where(inArray(levelReviews.runId, runIds)).orderBy(asc(levelReviews.round));
    const signatures = reviews.length
      ? (
          await this.db
            .select({ s: reviewSignatures, name: users.fullName })
            .from(reviewSignatures)
            .innerJoin(users, eq(users.id, reviewSignatures.userId))
            .where(
              inArray(
                reviewSignatures.reviewId,
                reviews.map((r) => r.id),
              ),
            )
        ).map(({ s, name }) => ({ ...s, name }))
      : [];
    return { reviews, signatures };
  }

  /** Phiếu mở từ ngày mở giai đoạn cuối (mục 10.2); vòng sau gia hạn mở ngay */
  private opensOn(ctx: RunContext) {
    const last = ctx.level.stages.at(-1);
    return addDays(ctx.run.startDate, last?.offsetStart ?? 0);
  }

  /** Điền phiếu: Buddy (Level 1), CHT, BP ĐT (mục 3.3) */
  private canFill(user: SessionUser, ctx: RunContext) {
    if (user.role === 'bp') return true;
    if (user.id === ctx.people.chtId) return true;
    return ctx.level.key === 1 && user.id === ctx.people.buddyId;
  }

  async get(user: SessionUser, runId: number): Promise<ReviewResponse> {
    const ctx = await this.runs.load(runId);
    await this.access.assertCanViewRun(user, ctx);
    const today = await this.clock.today();
    const actor = toActor(user);
    const form = reviewFormOf(ctx.level);
    const { reviews, signatures } = await this.reviewsOf([runId]);
    const { round, row } = currentRound(reviews);
    const signed = row ? signatures.filter((s) => s.reviewId === row.id) : [];
    const next = nextSignStep(
      form.signers,
      signed.map((s) => s.step),
    );

    const views = buildTaskViews(ctx, (await this.taskQuery.loadForRuns([runId])).get(runId)!, today, actor);
    const summary = summarizeRun(ctx, views, today);
    const sales = await this.db.select().from(salesMonthly).where(eq(salesMonthly.runId, runId));
    const kpi = evaluateKpi(
      ctx.level,
      sales.map((s) => ({ month: s.monthIndex, total: s.total, coef1: s.coef1 })),
    );
    const obs = await this.db.select({ scores: observations.scores }).from(observations).where(eq(observations.runId, runId));
    const rubric = evaluateRubric(rubricOf(ctx.content), obs);

    const opensOn = this.opensOn(ctx);
    const isOpen = round > 0 || today >= opensOn;
    const draft: ReviewDraft = {
      criteria: ctx.level.reviewCriteria.map((_, i) => row?.criteriaResults[i] ?? ''),
      notes: row?.notes ?? {},
      result: row?.result ?? null,
      goals: row?.extGoals ?? '',
    };
    const editable = ctx.run.status === 'active' && isOpen && signed.length === 0 && this.canFill(user, ctx);
    const savedBy = row?.savedBy ? (await this.db.select({ n: users.fullName }).from(users).where(eq(users.id, row.savedBy)))[0]?.n : null;

    return {
      today,
      run: summary,
      staff: ctx.staff,
      level: levelSummary(ctx),
      form,
      criteria: ctx.level.reviewCriteria,
      resultLabels: RESULT_LABEL(form),
      round,
      extCount: ctx.run.extCount,
      review: {
        id: row?.id ?? null,
        criteria: draft.criteria,
        notes: draft.notes,
        result: draft.result,
        goals: draft.goals,
        status: row?.status ?? 'draft',
        rowVersion: row?.rowVersion ?? null,
        savedByName: savedBy ?? null,
        savedAt: row?.savedAt?.toISOString() ?? null,
        appliedAt: row?.appliedAt?.toISOString() ?? null,
      },
      opensOn,
      isOpen,
      auto: { checklist: summary.progress, overdue: summary.counts.overdue, rubric, kpi },
      suggestions: ctx.level.reviewCriteria.map((c) => {
        const text = `${c.name} ${c.source}`.toLowerCase();
        if (/pos|doanh số/.test(text) && kpi.state !== 'missing') return { value: kpi.state === 'pass' ? 'pass' : 'fail', reason: `Doanh số: ${kpi.label}` };
        if (/rubric|quan sát/.test(text) && rubric.meetsTarget !== null) return { value: rubric.meetsTarget ? 'pass' : 'fail', reason: `Rubric: ${rubric.label}` };
        return null;
      }),
      steps: form.signers.map((role, step) => {
        const s = signed.find((x) => x.step === step);
        const isNext = step === next && !!row && isOpen;
        return {
          step,
          role,
          label: SIGN_STEP_LABEL[role],
          signedByName: s?.name ?? null,
          at: s?.at.toISOString() ?? null,
          state: s ? 'signed' : isNext ? 'next' : 'waiting',
          canSign: isNext && canSignAs(actor, ctx.people, role) && (step > 0 || ctx.run.status === 'active'),
        };
      }),
      problems: reviewProblems(form, draft, ctx.run.extCount),
      canEdit: editable,
      outcome: row?.appliedAt ? await this.outcomeText(ctx, row) : null,
      history: reviews.filter((r) => r.appliedAt && r.round < round).map((r) => ({ round: r.round, result: r.result, goals: r.extGoals, appliedAt: r.appliedAt!.toISOString() })),
    };
  }

  private async outcomeText(ctx: RunContext, row: ReviewRow) {
    const applied = row.appliedAt!.toISOString();
    if (row.result === 'pass') {
      if (ctx.level.key >= 4) return 'Đã đạt chuẩn Level 4';
      const [next] = await this.db
        .select({ startDate: levelRuns.startDate })
        .from(levelRuns)
        .where(and(eq(levelRuns.staffId, ctx.staff.id), eq(levelRuns.levelKey, ctx.level.key + 1)))
        .limit(1);
      return `Đã chuyển lên Level ${ctx.level.key + 1}${next ? ` từ ${fmtDate(next.startDate)}` : ''}`;
    }
    if (row.result === 'extend') return `Đã gia hạn lần ${row.round + 1}; kết thúc dự kiến mới ${fmtDate(ctx.run.plannedEnd)}`;
    return `Đã đóng lượt: Không đạt (${fmtDate(applied.slice(0, 10))})`;
  }

  async save(user: SessionUser, runId: number, body: SaveReviewBodyT): Promise<ReviewResponse> {
    const ctx = await this.runs.load(runId);
    await this.access.assertCanViewRun(user, ctx);
    const today = await this.clock.today();
    if (ctx.run.status !== 'active') throw conflict('RUN_CLOSED', 'Lượt Level đã đóng, không sửa được phiếu');
    if (!this.canFill(user, ctx)) {
      throw forbidden('CANNOT_FILL_REVIEW', ctx.level.key === 1 ? 'Chỉ Buddy, CHT phụ trách hoặc BP Đào tạo điền phiếu' : 'Chỉ CHT phụ trách hoặc BP Đào tạo điền phiếu');
    }
    const { reviews, signatures } = await this.reviewsOf([runId]);
    const { round, row } = currentRound(reviews);
    if (round === 0 && today < this.opensOn(ctx)) throw badRequest('REVIEW_NOT_OPEN', `Phiếu đánh giá mở từ ${fmtDate(this.opensOn(ctx))} (ngày mở giai đoạn cuối)`);
    if (row && signatures.some((s) => s.reviewId === row.id)) throw conflict('REVIEW_SIGNED', 'Phiếu đã có chữ ký, không sửa được nữa');

    const values = {
      criteriaResults: ctx.level.reviewCriteria.map((_, i) => (body.criteria[i] ?? '') as CriterionResult),
      notes: body.notes,
      result: body.result,
      extGoals: body.goals,
      savedBy: user.id,
      savedAt: await this.clock.now(),
    };
    if (row) {
      if (body.rowVersion !== row.rowVersion) throw staleData();
      const updated = await this.db
        .update(levelReviews)
        .set({ ...values, rowVersion: sql`${levelReviews.rowVersion} + 1` })
        .where(and(eq(levelReviews.id, row.id), eq(levelReviews.rowVersion, row.rowVersion)))
        .returning({ id: levelReviews.id });
      if (!updated.length) throw staleData();
    } else {
      await this.db.insert(levelReviews).values({ runId, round, ...values }).onConflictDoNothing();
    }
    return this.get(user, runId);
  }

  async sign(user: SessionUser, runId: number, step: number): Promise<ReviewResponse> {
    const ctx = await this.runs.load(runId);
    await this.access.assertCanViewRun(user, ctx);
    const actor = toActor(user);
    const form = reviewFormOf(ctx.level);
    const today = await this.clock.today();
    const now = await this.clock.now();

    await this.db.transaction(async (tx) => {
      const reviews = await tx.select().from(levelReviews).where(eq(levelReviews.runId, runId)).orderBy(asc(levelReviews.round)).for('update');
      const { round, row } = currentRound(reviews);
      if (!row) throw badRequest('REVIEW_NOT_SAVED', 'Lưu phiếu trước khi ký');
      const signed = await tx.select().from(reviewSignatures).where(eq(reviewSignatures.reviewId, row.id));
      const next = nextSignStep(
        form.signers,
        signed.map((s) => s.step),
      );
      if (next === null) throw conflict('REVIEW_COMPLETE', 'Phiếu đã ký đủ');
      if (step !== next) throw conflict('NOT_YOUR_TURN', signed.some((s) => s.step === step) ? 'Bước này đã ký' : 'Chưa đến lượt bước này: các bước trước phải ký trước');
      const role = form.signers[step];
      if (!canSignAs(actor, ctx.people, role)) throw forbidden('CANNOT_SIGN', `Bước "${SIGN_STEP_LABEL[role]}" không phải của bạn`);
      if (step === 0) {
        if (ctx.run.status !== 'active') throw conflict('RUN_CLOSED', 'Lượt Level đã đóng');
        if (round === 0 && today < this.opensOn(ctx)) throw badRequest('REVIEW_NOT_OPEN', `Phiếu đánh giá mở từ ${fmtDate(this.opensOn(ctx))}`);
        const problems = reviewProblems(form, { criteria: row.criteriaResults, notes: row.notes, result: row.result, goals: row.extGoals }, ctx.run.extCount);
        if (problems.length) throw badRequest('REVIEW_INCOMPLETE', `${problems[0]} trước khi ký`);
      }

      await tx.insert(reviewSignatures).values({ reviewId: row.id, step, role, userId: user.id, at: now });
      const patch: Partial<typeof levelReviews.$inferInsert> = { status: step === form.signers.length - 1 ? 'done' : 'signing' };
      if (step === outcomeStep(form.signers)) {
        await this.applyOutcome(tx, ctx, row, user.id, today, form.extension.months);
        patch.appliedAt = now;
      }
      await tx.update(levelReviews).set(patch).where(eq(levelReviews.id, row.id));
    });
    return this.get(user, runId);
  }

  /** Áp dụng kết quả khi bước BP ĐT ký (mục 9.3): lên Level, gia hạn, hoặc đóng lượt Không đạt */
  private async applyOutcome(tx: Tx, ctx: RunContext, row: ReviewRow, userId: number, today: string, extMonths: number) {
    const L = ctx.level.key;
    if (row.result === 'pass') {
      await tx.update(levelRuns).set({ status: 'passed' }).where(eq(levelRuns.id, ctx.run.id));
      if (L < 4) {
        // V9: Level mới bắt đầu từ ngày BP ĐT ký; R01: gắn phiên bản hiệu lực tại ngày đó
        const version = await findVersionForDate(tx, today);
        await createRun(tx, {
          staffId: ctx.staff.id,
          levelKey: L + 1,
          startDate: today,
          version: { id: version.id, criteriaLine: version.criteriaLine, content: version.content },
          people: { buddy: L + 1 <= 2 ? ctx.people.buddyId : null, cht: ctx.people.chtId, qlkv: ctx.people.qlkvId },
          createdBy: userId,
        });
        await tx.update(staff).set({ currentLevel: L + 1 }).where(eq(staff.id, ctx.staff.id));
      }
    } else if (row.result === 'extend') {
      // Gia hạn không tạo lượt mới, không đổi phiên bản; kéo dài ngày kết thúc dự kiến
      await tx
        .update(levelRuns)
        .set({ extCount: sql`${levelRuns.extCount} + 1`, plannedEnd: addDays(ctx.run.plannedEnd, extMonths * 30) })
        .where(eq(levelRuns.id, ctx.run.id));
    } else if (row.result === 'fail') {
      await tx.update(levelRuns).set({ status: 'failed' }).where(eq(levelRuns.id, ctx.run.id));
    }
  }

  /** "Chữ ký chờ bạn" (mục 11.3): phiếu đã mở mà bước kế tiếp thuộc về người dùng */
  async todosFor(user: SessionUser, contexts: RunContext[], today: string): Promise<SignatureTodo[]> {
    const actor = toActor(user);
    const { reviews, signatures } = await this.reviewsOf(contexts.map((c) => c.run.id));
    const out: SignatureTodo[] = [];
    for (const ctx of contexts) {
      const form = reviewFormOf(ctx.level);
      const { round, row } = currentRound(reviews.filter((r) => r.runId === ctx.run.id));
      if (round === 0 && today < this.opensOn(ctx)) continue;
      const next = nextSignStep(
        form.signers,
        row ? signatures.filter((s) => s.reviewId === row.id).map((s) => s.step) : [],
      );
      if (next === null) continue;
      const role = form.signers[next];
      const fillFirst = next === 0 && (!row || reviewProblems(form, { criteria: row.criteriaResults, notes: row.notes, result: row.result, goals: row.extGoals }, ctx.run.extCount).length > 0);
      const mine = canSignAs(actor, ctx.people, role) || (fillFirst && this.canFill(user, ctx) && user.role !== 'bp');
      if (!mine) continue;
      out.push({
        runId: ctx.run.id,
        staffId: ctx.staff.id,
        staffName: ctx.staff.fullName,
        storeName: ctx.staff.storeName,
        levelKey: ctx.level.key,
        step: next,
        totalSteps: form.signers.length,
        label: fillFirst ? `Điền phiếu đánh giá Level ${ctx.level.key}${round ? ` (vòng gia hạn ${round})` : ''}` : SIGN_STEP_LABEL[role],
      });
    }
    return out;
  }

  /** Phiếu chờ chính NV ký nhận kết quả (kể cả lượt cũ vừa đóng khi lên Level) */
  async pendingForStaffUser(user: SessionUser, staffId: number): Promise<{ runId: number; levelKey: number } | null> {
    const runRows = await this.db.select({ id: levelRuns.id }).from(levelRuns).where(eq(levelRuns.staffId, staffId));
    const contexts = await this.runs.loadMany(runRows.map((r) => r.id));
    const { reviews, signatures } = await this.reviewsOf(contexts.map((c) => c.run.id));
    for (const ctx of contexts) {
      const form = reviewFormOf(ctx.level);
      for (const r of reviews.filter((x) => x.runId === ctx.run.id && x.status === 'signing')) {
        const next = nextSignStep(
          form.signers,
          signatures.filter((s) => s.reviewId === r.id).map((s) => s.step),
        );
        if (next !== null && form.signers[next] === 'nv' && canSignAs(toActor(user), ctx.people, 'nv')) return { runId: ctx.run.id, levelKey: ctx.level.key };
      }
    }
    return null;
  }
}
