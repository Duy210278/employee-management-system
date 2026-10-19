import { Controller, Get, Res } from '@nestjs/common';
import { countAlerts, fmtDate } from '@lotrinh/shared';
import type { Response } from 'express';
import { ClockService } from '../../adapters/clock/clock.service';
import { CurrentUser, toActor, type SessionUser } from '../../common/session';
import { AccessService } from '../access/access.service';
import { AlertsService } from '../alerts/alerts.service';
import { TaskQueryService } from '../runs/task-query.service';
import { buildTaskViews, summarizeRun } from '../runs/task-views';
import { csvCell } from '../users/csv';

/** Xuất CSV tiến độ (mục 11.4, ma trận 3.3: CHT ◐, QLKV ◐, BP ĐT): đúng phạm vi dữ liệu như bảng Nhân sự */
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly clock: ClockService,
    private readonly access: AccessService,
    private readonly alerts: AlertsService,
    private readonly taskQuery: TaskQueryService,
  ) {}

  @Get('progress.csv')
  async progress(@CurrentUser() user: SessionUser, @Res({ passthrough: true }) res: Response): Promise<string> {
    await this.access.assertCan(user, 'read', 'Report', 'Chỉ CHT, QLKV và BP Đào tạo xuất được báo cáo');
    const today = await this.clock.today();
    const contexts = await this.alerts.currentRunsInScope(user);
    const data = await this.taskQuery.loadForRuns(contexts.map((c) => c.run.id));
    const views = new Map(contexts.map((c) => [c.run.id, buildTaskViews(c, data.get(c.run.id)!, today, toActor(user))]));
    const alerts = await this.alerts.forRuns(contexts, views, today);

    const header = [
      'Mã NV', 'Họ tên', 'Cửa hàng', 'Khu vực', 'Level', 'Ngày bắt đầu', 'Ngày thứ', 'Số ngày Level', 'Kết thúc dự kiến', 'Giai đoạn hiện tại',
      'Mục đã xong', 'Tổng mục', '% hoàn thành', 'Mục trễ hạn', 'Cảnh báo đỏ', 'Cảnh báo vàng', 'Nội dung cảnh báo', 'Buddy', 'CHT', 'QLKV', 'Phiên bản', 'Tạm dừng (ngày)',
    ];
    const lines = [header.map(csvCell).join(',')];
    const rows = contexts
      .map((ctx) => ({ ctx, run: summarizeRun(ctx, views.get(ctx.run.id)!, today), alerts: alerts.get(ctx.run.id) ?? [] }))
      .sort((a, b) => a.ctx.staff.storeName.localeCompare(b.ctx.staff.storeName, 'vi') || a.ctx.staff.fullName.localeCompare(b.ctx.staff.fullName, 'vi'));
    for (const { ctx, run, alerts: a } of rows) {
      const c = countAlerts(a);
      lines.push(
        [
          ctx.staff.employeeCode,
          ctx.staff.fullName,
          ctx.staff.storeName,
          ctx.staff.areaName,
          run.levelKey,
          fmtDate(run.startDate),
          run.dayIndex < 0 ? `Bắt đầu sau ${-run.dayIndex} ngày` : run.dayIndex + 1,
          ctx.level.totalDays,
          fmtDate(run.plannedEnd),
          run.currentStage ? `${run.currentStage.label}: ${run.currentStage.name}` : '',
          run.progress.done,
          run.progress.total,
          Math.round(run.progress.pct * 100),
          run.counts.overdue,
          c.red,
          c.yellow,
          a.map((x) => x.message).join('; '),
          ctx.names.buddy,
          ctx.names.cht,
          ctx.names.qlkv,
          `v${run.versionCode}`,
          run.pausedDays || '',
        ]
          .map(csvCell)
          .join(','),
      );
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tien-do-${today}.csv"`);
    // BOM để Excel đọc đúng tiếng Việt
    return `﻿${lines.join('\r\n')}\r\n`;
  }
}
