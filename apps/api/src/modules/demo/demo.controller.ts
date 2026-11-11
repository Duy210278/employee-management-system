import {
  Body,
  CanActivate,
  Controller,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { type JobName, type JobResult } from '@lotrinh/shared';
import { env } from '../../config';
import { CurrentUser, type SessionUser } from '../../common/session';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../../adapters/clock/clock.service';
import { DB } from '../../db/db.provider';
import type { Db } from '../../db/client';
import { resetDatabase } from '../../db/seed';
import { AccessService } from '../access/access.service';
import { JOB_NAMES, JobsService } from '../jobs/jobs.service';
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

@Controller('demo')
@UseGuards(DemoModeGuard)
export class DemoController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
    private readonly versions: VersionsService,
    private readonly jobs: JobsService,
  ) {}

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
