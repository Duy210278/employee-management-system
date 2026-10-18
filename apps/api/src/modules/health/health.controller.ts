import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { env } from '../../config';
import { Public } from '../../common/session';
import { ClockService } from '../../adapters/clock/clock.service';
import { DB } from '../../db/db.provider';
import type { Db } from '../../db/client';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
  ) {}

  @Public()
  @Get()
  async check() {
    let db = false;
    try {
      await this.db.execute(sql`select 1`);
      db = true;
    } catch {
      db = false;
    }
    return { ok: db, db, demoMode: env().DEMO_MODE, clock: db ? await this.clock.view() : null };
  }
}
