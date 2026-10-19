import { Inject, Injectable } from '@nestjs/common';
import { dayIndex, evaluateKpi, kpiRule, levelMonthOf, type SalesBodyT, type SalesResponse } from '@lotrinh/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { ClockService } from '../../adapters/clock/clock.service';
import { badRequest, forbidden } from '../../common/errors';
import type { SessionUser } from '../../common/session';
import type { Db } from '../../db/client';
import { DB } from '../../db/db.provider';
import { salesMonthly, users } from '../../db/schema';
import { AccessService } from '../access/access.service';
import { assertNvbh, RunContextService, type RunContext } from '../runs/run-context.service';

/** Doanh số tháng của lượt Level (mục 11.5 tab Doanh số, R15). Nhập tay, POS ghi vào cùng bảng khi tích hợp */
@Injectable()
export class SalesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly runs: RunContextService,
    private readonly access: AccessService,
  ) {}

  /** Nhập doanh số tháng: CHT ◐, QLKV ◐, BP ĐT ✔ (mục 3.3) — CHT/QLKV trong phạm vi, lượt còn mở */
  private async canEdit(user: SessionUser, ctx: RunContext) {
    return ctx.run.status === 'active' && user.role !== 'nv' && (await this.access.can(user, 'update', AccessService.recordOf(ctx)));
  }

  async get(user: SessionUser, runId: number): Promise<SalesResponse> {
    const ctx = await this.runs.load(runId);
    assertNvbh(ctx, 'doanh số theo Level');
    await this.access.assertCanViewRun(user, ctx);
    const today = await this.clock.today();
    const rows = await this.db
      .select({ s: salesMonthly, name: users.fullName })
      .from(salesMonthly)
      .leftJoin(users, eq(users.id, salesMonthly.enteredBy))
      .where(eq(salesMonthly.runId, runId))
      .orderBy(asc(salesMonthly.monthIndex));
    const rule = kpiRule(ctx.level);
    const months = rows.map(({ s }) => ({ month: s.monthIndex, total: s.total, coef1: s.coef1 }));
    return {
      today,
      runId,
      levelKey: ctx.level.key,
      months: ctx.level.months,
      currentMonth: levelMonthOf(dayIndex(ctx.run.startDate, today), ctx.level.months),
      rows: Array.from({ length: ctx.level.months }, (_, i) => {
        const month = i + 1;
        const r = rows.find(({ s }) => s.monthIndex === month);
        return {
          month,
          total: r?.s.total ?? null,
          coef1: r?.s.coef1 ?? null,
          inWindow: month >= rule.windowFrom && month <= rule.windowTo,
          enteredByName: r?.name ?? null,
          at: r?.s.at.toISOString() ?? null,
        };
      }),
      kpi: evaluateKpi(ctx.level, months),
      canEdit: await this.canEdit(user, ctx),
    };
  }

  async put(user: SessionUser, runId: number, month: number, body: SalesBodyT): Promise<SalesResponse> {
    const ctx = await this.runs.load(runId);
    assertNvbh(ctx, 'doanh số theo Level');
    await this.access.assertCanViewRun(user, ctx);
    if (!(await this.canEdit(user, ctx))) throw forbidden('CANNOT_EDIT_SALES', 'Chỉ CHT, QLKV phụ trách hoặc BP Đào tạo nhập doanh số cho lượt đang chạy');
    if (month < 1 || month > ctx.level.months) throw badRequest('INVALID_MONTH', `Level ${ctx.level.key} có ${ctx.level.months} tháng`);

    const where = and(eq(salesMonthly.runId, runId), eq(salesMonthly.monthIndex, month));
    const [existing] = await this.db.select().from(salesMonthly).where(where);
    const total = body.total !== undefined ? body.total : (existing?.total ?? null);
    const coef1 = body.coef1 !== undefined ? body.coef1 : (existing?.coef1 ?? null);
    if (total !== null && coef1 !== null && coef1 > total) throw badRequest('INVALID_SALES', 'DS hệ số 1 không được lớn hơn DS tổng');

    // Chỉ ghi ô được gửi: hai lần lưu liên tiếp (DS tổng rồi HS1) đến theo thứ tự nào cũng không ghi đè nhau
    const provided = {
      ...(body.total !== undefined ? { total: body.total } : {}),
      ...(body.coef1 !== undefined ? { coef1: body.coef1 } : {}),
      source: 'manual' as const,
      enteredBy: user.id,
      at: new Date(),
    };
    await this.db
      .insert(salesMonthly)
      .values({ runId, monthIndex: month, ...provided })
      .onConflictDoUpdate({ target: [salesMonthly.runId, salesMonthly.monthIndex], set: provided });
    await this.db.delete(salesMonthly).where(and(where, isNull(salesMonthly.total), isNull(salesMonthly.coef1)));
    return this.get(user, runId);
  }
}
