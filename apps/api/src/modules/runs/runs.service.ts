import { Inject, Injectable } from '@nestjs/common';
import { canSignAs, STAGE_SIGN_LABEL, type OverviewResponse, type RunTasksResponse } from '@lotrinh/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors';
import { toActor, type SessionUser } from '../../common/session';
import { AccessService } from '../access/access.service';
import { ClockService } from '../../adapters/clock/clock.service';
import { DB } from '../../db/db.provider';
import { NotificationsService } from '../notifications/notifications.service';
import { RunContextService, type RunContext } from './run-context.service';
import { TaskQueryService } from './task-query.service';
import { buildStageSigns, buildTaskViews, isOpenRun, levelSummary, stageViews, summarizeRun } from './task-views';
import type { Db } from '../../db/client';
import { levelRuns, signoffs as signoffTable, users } from '../../db/schema';

@Injectable()
export class RunsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly runs: RunContextService,
    private readonly taskQuery: TaskQueryService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  private async viewable(user: SessionUser, runId: number): Promise<RunContext> {
    const ctx = await this.runs.load(runId);
    await this.access.assertCanViewRun(user, ctx);
    return ctx;
  }

  /** NV tự xác nhận; NV chưa có tài khoản thì Buddy hoặc CHT xác nhận thay (mục 9.4) */
  private ackRole(user: SessionUser, ctx: RunContext): 'self' | 'behalf' | null {
    if (ctx.staff.userId !== null) return ctx.staff.userId === user.id ? 'self' : null;
    return user.id === ctx.people.buddyId || user.id === ctx.people.chtId ? 'behalf' : null;
  }

  async tasks(user: SessionUser, runId: number): Promise<RunTasksResponse> {
    const ctx = await this.viewable(user, runId);
    const today = await this.clock.today();
    const data = (await this.taskQuery.loadForRuns([runId])).get(runId)!;
    const actor = toActor(user);
    const tasks = buildTaskViews(ctx, data, today, actor);
    const signoffs = (await this.taskQuery.loadSignoffs([runId])).get(runId)!;
    const signs = buildStageSigns(ctx, tasks, signoffs, today, actor);
    return { today, staff: ctx.staff, level: levelSummary(ctx), run: summarizeRun(ctx, tasks, today), stages: stageViews(ctx, signs), tasks };
  }

  /** Ký cuối giai đoạn (mục 10.2): đúng thứ tự (R12), chỉ khi mọi mục bắt buộc đã xong hoặc N/A (R11) */
  async signStage(user: SessionUser, runId: number, stageKey: string, step: number): Promise<RunTasksResponse> {
    const ctx = await this.viewable(user, runId);
    const stage = ctx.level.stages.find((s) => s.key === stageKey);
    if (!stage) throw notFound('STAGE_NOT_FOUND', 'Không tìm thấy giai đoạn');
    if (!isOpenRun(ctx.run.status)) throw conflict('RUN_CLOSED', 'Lượt Level đã đóng');
    const today = await this.clock.today();
    const actor = toActor(user);
    const tasks = buildTaskViews(ctx, (await this.taskQuery.loadForRuns([runId])).get(runId)!, today, actor);
    const signoffs = (await this.taskQuery.loadSignoffs([runId])).get(runId)!;
    const sign = buildStageSigns(ctx, tasks, signoffs, today, actor).get(stageKey);
    if (!sign) throw badRequest('NO_SIGNERS', 'Giai đoạn này không cấu hình chuỗi ký');
    if (sign.complete) throw conflict('STAGE_SIGNED', 'Giai đoạn đã ký đủ');
    const next = sign.steps.find((s) => s.state === 'next')!;
    if (step !== next.step) throw conflict('NOT_YOUR_TURN', step < next.step ? 'Bước này đã ký' : 'Chưa đến lượt bước này: các bước trước phải ký trước');
    if (sign.blocked) throw badRequest('STAGE_NOT_READY', `Chưa ký được: ${sign.blocked.charAt(0).toLowerCase()}${sign.blocked.slice(1)}`);
    if (!canSignAs(actor, ctx.people, next.role)) throw forbidden('CANNOT_SIGN', `Bước "${STAGE_SIGN_LABEL[next.role]}" không phải của bạn`);

    const inserted = await this.db
      .insert(signoffTable)
      .values({ runId, stageKey, step, role: next.role, userId: user.id, at: await this.clock.now() })
      .onConflictDoNothing()
      .returning({ id: signoffTable.id });
    if (!inserted.length) throw conflict('STALE', 'Bước này vừa được người khác ký, tải lại trang');

    // Báo người ký bước sau (mục 10.6: "Có phiếu chờ ký → người ký kế tiếp")
    const following = stage.signers[step + 1];
    if (following) {
      const p = ctx.people;
      const who = following === 'cht' ? [p.chtId] : following === 'qlkv' ? [p.qlkvId] : following === 'buddy' ? [p.buddyId] : following === 'nv' ? [p.staffUserId ?? p.buddyId] : await this.notifications.activeIds({ role: 'bp' });
      await this.notifications.notify(who, {
        type: 'stage_sign',
        title: `Chờ bạn ký ${stage.label} của ${ctx.staff.fullName}`,
        body: `${STAGE_SIGN_LABEL[following]} · Level ${ctx.level.key}`,
        link: `/nhan-su/${ctx.staff.id}?tab=check&run=${runId}`,
        dedupeKey: `stage-sign:${runId}:${stageKey}:${step + 1}`,
      });
    }
    return this.tasks(user, runId);
  }

  async overview(user: SessionUser, runId: number): Promise<OverviewResponse> {
    const ctx = await this.viewable(user, runId);
    const today = await this.clock.today();
    const data = (await this.taskQuery.loadForRuns([runId])).get(runId)!;
    const tasks = buildTaskViews(ctx, data, today, toActor(user));
    const bp = await this.db
      .select({ name: users.fullName })
      .from(users)
      .where(and(eq(users.role, 'bp'), eq(users.status, 'active')));
    const ack = this.ackRole(user, ctx);
    return {
      run: summarizeRun(ctx, tasks, today),
      staff: ctx.staff,
      level: { ...levelSummary(ctx), kpi: ctx.level.kpi },
      overview: ctx.level.overview,
      people: { buddy: ctx.names.buddy, cht: ctx.names.cht, qlkv: ctx.names.qlkv, bp: bp.map((b) => b.name) },
      canAck: ack !== null && ctx.run.ackAt === null,
      ackOnBehalf: ack === 'behalf',
    };
  }

  async acknowledge(user: SessionUser, runId: number): Promise<{ ok: true }> {
    const ctx = await this.viewable(user, runId);
    if (ctx.run.ackAt) return { ok: true };
    if (!this.ackRole(user, ctx)) {
      throw forbidden('CANNOT_ACK', 'Chỉ nhân viên (hoặc Buddy, CHT khi nhân viên chưa có tài khoản) được xác nhận đã đọc');
    }
    await this.db
      .update(levelRuns)
      .set({ ackBy: user.id, ackAt: await this.clock.now() })
      .where(and(eq(levelRuns.id, runId), isNull(levelRuns.ackAt)));
    return { ok: true };
  }
}
