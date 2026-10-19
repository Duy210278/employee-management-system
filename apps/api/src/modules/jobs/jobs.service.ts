import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { addDays, countAlerts, diffDays, fmtDate, isAssignee, type IsoDate, type JobName, type JobResult, type TaskRole, type TaskView } from '@lotrinh/shared';
import { and, eq, inArray } from 'drizzle-orm';
import { ClockService } from '../../adapters/clock/clock.service';
import type { Db } from '../../db/client';
import { DB } from '../../db/db.provider';
import { levelRuns, versions } from '../../db/schema';
import { AlertsService } from '../alerts/alerts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PUBLISHED } from '../runs/run-factory';
import { RunContextService, type RunContext } from '../runs/run-context.service';
import { TaskQueryService } from '../runs/task-query.service';
import { buildTaskViews, OPEN_RUN_STATUSES } from '../runs/task-views';

export const JOB_LABEL: Record<JobName, string> = {
  'version-activate': 'Kích hoạt phiên bản theo ngày hiệu lực',
  'daily-digest': 'Bản tin sáng',
  escalation: 'Báo QLKV việc quá hạn lâu',
  'alerts-refresh': 'Tính lại cảnh báo',
  'run-start-reminder': 'Nhắc lượt Level sắp bắt đầu',
};
export const JOB_NAMES = Object.keys(JOB_LABEL) as JobName[];

/** Người dùng kiểm tra việc mới mỗi 15 phút; qua ngày thật mới (không giả lập) thì chạy lại các job */
const TICK_MS = 15 * 60_000;
const NEUTRAL = { userId: -1, role: 'nv' as const };

/**
 * Job hằng ngày (mục 14.11). Trên máy demo thường không bật qua đêm nên job chạy khi: khởi động, sang ngày mới,
 * đổi ngày giả lập, hoặc bấm "Chạy ngay". Mỗi thông báo có khóa chống trùng nên chạy lại không tạo trùng (mục 14.9).
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Jobs');
  private timer: NodeJS.Timeout | null = null;
  private lastDate: IsoDate | null = null;
  private running: Promise<unknown> = Promise.resolve();

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly runs: RunContextService,
    private readonly taskQuery: TaskQueryService,
    private readonly notifications: NotificationsService,
    private readonly alerts: AlertsService,
  ) {}

  onApplicationBootstrap() {
    // Test tự gọi job khi cần; không chạy nền để kết quả không phụ thuộc thời điểm
    if (process.env.VITEST) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    try {
      const today = await this.clock.today();
      if (today !== this.lastDate) await this.runAll(today);
    } catch (err) {
      this.logger.error(`Không chạy được job: ${(err as Error).message}`);
    }
  }

  /** Chạy mọi job cho một ngày, lần lượt (không chạy chồng) */
  async runAll(today?: IsoDate): Promise<JobResult[]> {
    const date = today ?? (await this.clock.today());
    const work = this.running.then(async () => {
      const out: JobResult[] = [];
      for (const name of JOB_NAMES) out.push(await this.execute(name, date));
      this.lastDate = date;
      return out;
    });
    this.running = work.catch(() => undefined);
    return work;
  }

  async run(name: JobName): Promise<JobResult> {
    const date = await this.clock.today();
    const work = this.running.then(() => this.execute(name, date));
    this.running = work.catch(() => undefined);
    return work;
  }

  private async execute(name: JobName, today: IsoDate): Promise<JobResult> {
    const done = (created: number, message: string): JobResult => ({ name, label: JOB_LABEL[name], date: today, created, message });
    switch (name) {
      case 'version-activate':
        return this.versionActivate(today, done);
      case 'daily-digest':
        return this.dailyDigest(today, done);
      case 'escalation':
        return this.escalation(today, done);
      case 'alerts-refresh':
        return this.alertsRefresh(today, done);
      case 'run-start-reminder':
        return this.runStartReminder(today, done);
    }
  }

  private async openRuns(today: IsoDate): Promise<{ contexts: RunContext[]; views: Map<number, TaskView[]> }> {
    const ids = (await this.db.select({ id: levelRuns.id }).from(levelRuns).where(inArray(levelRuns.status, [...OPEN_RUN_STATUSES]))).map((r) => r.id);
    const contexts = (await this.runs.loadMany(ids)).filter((c) => c.staff.active);
    const data = await this.taskQuery.loadForRuns(contexts.map((c) => c.run.id));
    return { contexts, views: new Map(contexts.map((c) => [c.run.id, buildTaskViews(c, data.get(c.run.id)!, today, NEUTRAL)])) };
  }

  /** Người phải làm phần `role` của đầu việc hôm nay: phần người xác nhận chỉ tính khi NV đã báo xong (nếu cần báo trước) */
  private async holders(ctx: RunContext, v: TaskView, bpIds: number[]): Promise<number[]> {
    const out: number[] = [];
    const nvDone = v.confirmations.some((c) => c.role === 'nv');
    for (const role of v.actions.missing) {
      if (role !== 'nv' && v.requiredRoles.includes('nv') && !nvDone) continue;
      const ids = role === 'bp' ? bpIds : [ctx.people.staffUserId, ctx.people.buddyId, ctx.people.chtId, ctx.people.qlkvId].filter((id): id is number => id !== null);
      for (const id of ids) {
        const actor = { userId: id, role: role === 'bp' ? ('bp' as const) : ('nv' as const) };
        if (isAssignee(actor, role as TaskRole, ctx.people) && !out.includes(id)) out.push(id);
      }
    }
    return out;
  }

  /** Bản tin sáng (mục 10.6): việc mới mở, sắp đến hạn (≤ remindDays, T-L07), quá hạn của từng người */
  private async dailyDigest(today: IsoDate, done: (n: number, m: string) => JobResult): Promise<JobResult> {
    const { contexts, views } = await this.openRuns(today);
    const bpIds = await this.notifications.activeIds({ role: 'bp' });
    const tally = new Map<number, { opened: number; soon: number; overdue: number; self: boolean }>();
    for (const ctx of contexts) {
      for (const v of views.get(ctx.run.id) ?? []) {
        if (['done', 'na', 'void'].includes(v.status) || v.openDate > today) continue;
        const until = diffDays(v.dueDate, today);
        const kind = v.state.overdueDays > 0 ? 'overdue' : until <= ctx.content.scheduleParams.remindDays ? 'soon' : v.openDate === today ? 'opened' : null;
        if (!kind) continue;
        for (const id of await this.holders(ctx, v, bpIds)) {
          const t = tally.get(id) ?? { opened: 0, soon: 0, overdue: 0, self: false };
          t[kind]++;
          if (id === ctx.people.staffUserId) t.self = true;
          tally.set(id, t);
        }
      }
    }
    let created = 0;
    for (const [userId, t] of tally) {
      const parts = [t.overdue && `${t.overdue} việc quá hạn`, t.soon && `${t.soon} việc sắp đến hạn`, t.opened && `${t.opened} việc mới mở`].filter(Boolean);
      created += await this.notifications.notify([userId], {
        type: 'digest',
        title: `Bản tin ${fmtDate(today)}: ${parts.join(', ')}`,
        body: t.self ? 'Mở "Hôm nay" để xem chi tiết' : 'Mở "Việc cần xử lý" để xem chi tiết',
        link: t.self ? '/hom-nay' : '/viec-can-xu-ly',
        dedupeKey: `digest:${today}`,
      });
    }
    return done(created, `${created} bản tin cho ${tally.size} người`);
  }

  /** Việc quá hạn hơn escalateDays gửi QLKV của lượt (mục 10.6, F.2) */
  private async escalation(today: IsoDate, done: (n: number, m: string) => JobResult): Promise<JobResult> {
    const { contexts, views } = await this.openRuns(today);
    const byQlkv = new Map<number, { count: number; names: Set<string> }>();
    for (const ctx of contexts) {
      if (!ctx.people.qlkvId) continue;
      const late = (views.get(ctx.run.id) ?? []).filter((v) => v.state.overdueDays > ctx.content.scheduleParams.escalateDays);
      if (!late.length) continue;
      const e = byQlkv.get(ctx.people.qlkvId) ?? { count: 0, names: new Set<string>() };
      e.count += late.length;
      e.names.add(ctx.staff.fullName);
      byQlkv.set(ctx.people.qlkvId, e);
    }
    let created = 0;
    for (const [userId, e] of byQlkv) {
      created += await this.notifications.notify([userId], {
        type: 'escalation',
        title: `${e.count} việc quá hạn lâu trong khu vực`,
        body: [...e.names].join(', '),
        link: '/viec-can-xu-ly',
        dedupeKey: `escalation:${today}`,
      });
    }
    return done(created, byQlkv.size ? `Báo ${byQlkv.size} QLKV` : 'Không có việc quá hạn lâu');
  }

  /** Báo trước 1 ngày cho NV, Buddy, CHT khi lượt Level sắp bắt đầu (mục 10.6) */
  private async runStartReminder(today: IsoDate, done: (n: number, m: string) => JobResult): Promise<JobResult> {
    const tomorrow = addDays(today, 1);
    const ids = (
      await this.db
        .select({ id: levelRuns.id })
        .from(levelRuns)
        .where(and(eq(levelRuns.startDate, tomorrow), eq(levelRuns.status, 'active')))
    ).map((r) => r.id);
    let created = 0;
    for (const ctx of await this.runs.loadMany(ids)) {
      created += await this.notifications.notify([ctx.people.staffUserId, ctx.people.buddyId, ctx.people.chtId], {
        type: 'run_start',
        title: `Lộ trình Level ${ctx.run.levelKey} của ${ctx.staff.fullName} bắt đầu ngày mai ${fmtDate(tomorrow)}`,
        link: `/nhan-su/${ctx.staff.id}`,
        dedupeKey: `run-start:${ctx.run.id}`,
      });
    }
    return done(created, ids.length ? `${ids.length} lượt bắt đầu ngày mai` : 'Không có lượt nào bắt đầu ngày mai');
  }

  /**
   * Phiên bản có hiệu lực từ hôm nay. Trạng thái "Đang hiệu lực / Hết hiệu lực" tính theo ngày hiệu lực khi đọc,
   * nên job chỉ báo cho BP ĐT và người duyệt.
   */
  private async versionActivate(today: IsoDate, done: (n: number, m: string) => JobResult): Promise<JobResult> {
    const rows = await this.db
      .select({ id: versions.id, code: versions.code })
      .from(versions)
      .where(and(PUBLISHED, eq(versions.effectiveFrom, today)));
    const recipients = [...new Set([...(await this.notifications.activeIds({ role: 'bp' })), ...(await this.notifications.activeIds({ canApproveVersions: true }))])];
    let created = 0;
    for (const v of rows) {
      created += await this.notifications.notify(recipients, {
        type: 'version_active',
        title: `Bộ lộ trình v${v.code} có hiệu lực từ hôm nay`,
        link: `/thiet-ke/${v.id}`,
        dedupeKey: `version-active:${v.id}`,
      });
    }
    return done(created, rows.length ? `Kích hoạt ${rows.map((r) => `v${r.code}`).join(', ')}` : 'Không có phiên bản nào bắt đầu hiệu lực hôm nay');
  }

  /** Cảnh báo tính trực tiếp khi đọc; job đếm lại để báo kết quả */
  private async alertsRefresh(today: IsoDate, done: (n: number, m: string) => JobResult): Promise<JobResult> {
    const { contexts, views } = await this.openRuns(today);
    const all = [...(await this.alerts.forRuns(contexts, views, today)).values()];
    const red = all.filter((a) => countAlerts(a).red > 0).length;
    const yellow = all.filter((a) => countAlerts(a).red === 0 && countAlerts(a).yellow > 0).length;
    return done(0, `${red} nhân viên có cảnh báo đỏ, ${yellow} chỉ có cảnh báo vàng`);
  }
}
