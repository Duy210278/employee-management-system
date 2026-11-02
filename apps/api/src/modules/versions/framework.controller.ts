import { Controller, Get, Inject } from '@nestjs/common';
import { rubricOf, type FrameworkResponse } from '@lotrinh/shared';
import { ClockService } from '../../adapters/clock/clock.service';
import type { Db } from '../../db/client';
import { DB } from '../../db/db.provider';
import { findVersionForDate } from '../runs/run-factory';

@Controller()
export class FrameworkController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
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
}
