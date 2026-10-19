import { Body, Controller, Get, Inject, Put } from '@nestjs/common';
import { PublishingBody, rubricOf, type FrameworkResponse, type PublishingSettings } from '@lotrinh/shared';
import { eq } from 'drizzle-orm';
import { ClockService } from '../../adapters/clock/clock.service';
import { CurrentUser, type SessionUser } from '../../common/session';
import { ZodPipe } from '../../common/zod.pipe';
import type { Db } from '../../db/client';
import { DB } from '../../db/db.provider';
import { systemSettings } from '../../db/schema';
import { AccessService, BP_SELF_PUBLISH_KEY } from '../access/access.service';
import { findVersionForDate } from '../runs/run-factory';

@Controller()
export class FrameworkController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly access: AccessService,
  ) {}

  /** Khung năng lực của phiên bản đang hiệu lực, chỉ xem (mục 4.3); ai đăng nhập cũng xem được */
  @Get('framework')
  async current(): Promise<FrameworkResponse> {
    const today = await this.clock.today();
    const v = await findVersionForDate(this.db, today);
    return {
      today,
      versionCode: v.code ?? '',
      effectiveFrom: v.effectiveFrom,
      framework: v.content.framework ?? null,
      rubric: rubricOf(v.content),
      levels: v.content.levels.map(({ stages, ...level }) => ({
        ...level,
        stageCount: stages.length,
        itemCount: stages.reduce((a, s) => a + s.items.length, 0),
      })),
    };
  }

  /** V20: ai được duyệt và ban hành phiên bản */
  @Get('settings/publishing')
  async publishing(@CurrentUser() user: SessionUser): Promise<PublishingSettings> {
    await this.access.assertCan(user, 'manage', 'Settings', 'Chỉ BP Đào tạo xem được cấu hình này');
    const [row] = await this.db.select().from(systemSettings).where(eq(systemSettings.key, BP_SELF_PUBLISH_KEY));
    return { bpSelfPublish: row?.value === true };
  }

  @Put('settings/publishing')
  async setPublishing(@Body(new ZodPipe(PublishingBody)) body: PublishingSettings, @CurrentUser() user: SessionUser): Promise<PublishingSettings> {
    await this.access.assertCan(user, 'manage', 'Settings', 'Chỉ BP Đào tạo đổi được cấu hình này');
    await this.db
      .insert(systemSettings)
      .values({ key: BP_SELF_PUBLISH_KEY, value: body.bpSelfPublish, updatedBy: user.id })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: body.bpSelfPublish, updatedBy: user.id, updatedAt: new Date() } });
    return { bpSelfPublish: body.bpSelfPublish };
  }
}
