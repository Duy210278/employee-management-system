import {
  Body,
  CanActivate,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { LoginAsBody, runTitle, type DemoAccount, type JobName, type JobResult } from '@lotrinh/shared';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { env } from '../../config';
import { CurrentUser, Public, type SessionUser } from '../../common/session';
import { ZodPipe } from '../../common/zod.pipe';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../../adapters/clock/clock.service';
import { DB } from '../../db/db.provider';
import type { Db } from '../../db/client';
import { levelRuns, staff, users } from '../../db/schema';
import { resetDatabase } from '../../db/seed';
import { SEED_USERS } from '../../db/seed/seed-data';
import { AccessService } from '../access/access.service';
import { AuthService } from '../auth/auth.service';
import { JOB_NAMES, JobsService } from '../jobs/jobs.service';
import { OPEN_RUN_STATUSES } from '../runs/task-views';
import { VersionsService } from '../versions/versions.service';
import { badRequest } from '../../common/errors';

/** Công cụ demo chỉ tồn tại khi DEMO_MODE=true, tắt ở cả API lẫn giao diện (mục 14.7) */
@Injectable()
class DemoModeGuard implements CanActivate {
  canActivate(): boolean {
    if (!env().DEMO_MODE) throw new NotFoundException();
    return true;
  }
}

const ROLE_ORDER = { bp: 0, qlkv: 1, cht: 2, nv: 3 } as const;

@Controller('demo')
@UseGuards(DemoModeGuard)
export class DemoController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly auth: AuthService,
    private readonly clock: ClockService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
    private readonly versions: VersionsService,
    private readonly jobs: JobsService,
  ) {}

  @Public()
  @Get('accounts')
  async accounts(): Promise<DemoAccount[]> {
    const notes = new Map(SEED_USERS.map((u) => [u.email, u.note]));
    const rows = await this.db.select().from(users);
    // Lượt đang mở mới nhất của từng tài khoản: Level của NV, checklist của CHT đang onboarding
    const open = await this.db
      .select({ userId: staff.userId, track: levelRuns.track, levelKey: levelRuns.levelKey })
      .from(levelRuns)
      .innerJoin(staff, eq(staff.id, levelRuns.staffId))
      .where(and(isNotNull(staff.userId), inArray(levelRuns.status, [...OPEN_RUN_STATUSES])))
      .orderBy(desc(levelRuns.id));
    const runLabel = new Map<number, string>();
    for (const r of open) if (r.userId !== null && !runLabel.has(r.userId)) runLabel.set(r.userId, runTitle(r));
    return rows
      .map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        status: u.status,
        note: notes.get(u.email) ?? '',
        runLabel: runLabel.get(u.id) ?? null,
      }))
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.id - b.id);
  }

  @Public()
  @Post('login-as')
  @HttpCode(200)
  async loginAs(@Body(new ZodPipe(LoginAsBody)) body: { userId: number }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.findActiveUser(body.userId);
    await this.auth.startSession(res, user.id);
    await this.audit.log({ userId: user.id, action: 'auth.login_demo', entity: 'users', entityId: String(user.id), ip: req.ip });
    return { ok: true };
  }

  /** Nút "Chạy ngay" của từng job (mục 14.11) */
  @Post('jobs/:name/run')
  @HttpCode(200)
  async runJob(@Param('name') name: string, @CurrentUser() user: SessionUser): Promise<JobResult> {
    await this.access.assertCan(user, 'manage', 'Clock', 'Chỉ BP Đào tạo được chạy job');
    if (!JOB_NAMES.includes(name as JobName)) throw badRequest('UNKNOWN_JOB', `Không có job ${name}`);
    return this.jobs.run(name as JobName);
  }

  /** Xóa sạch, nạp lại bộ mẫu theo ngày hôm nay (mục 14.7) */
  @Post('reset')
  @HttpCode(200)
  async reset(@CurrentUser() user: SessionUser): Promise<{ ok: true; today: string }> {
    await this.access.assertCan(user, 'manage', 'DemoData', 'Chỉ BP Đào tạo được khôi phục dữ liệu mẫu');
    const today = await this.clock.today();
    await resetDatabase(this.db, today);
    this.versions.clearCache();
    // Có sẵn bản tin, nhắc việc của ngày hôm nay sau khi khôi phục
    await this.jobs.runAll(today);
    await this.audit.log({ userId: null, action: 'demo.reset', payload: { by: user.email, today } });
    return { ok: true, today };
  }
}
