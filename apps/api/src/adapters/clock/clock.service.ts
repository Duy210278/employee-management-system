import { Inject, Injectable } from '@nestjs/common';
import { diffDays, todayIn, type ClockView, type IsoDate } from '@lotrinh/shared';
import { eq } from 'drizzle-orm';
import { env } from '../../config';
import type { Db } from '../../db/client';
import { systemSettings } from '../../db/schema';
import { DB } from '../../db/db.provider';

const FAKE_TODAY_KEY = 'fake_today';

/**
 * Nguồn "hôm nay" duy nhất của nghiệp vụ (mục 14.7, 14.9). Không gọi new Date() trực tiếp trong nghiệp vụ.
 * Ở DEMO_MODE có thể đặt ngày giả lập; ngày lưu trong system_settings và áp dụng cho mọi người dùng.
 */
@Injectable()
export class ClockService {
  constructor(@Inject(DB) private readonly db: Db) {}

  realToday(): IsoDate {
    return todayIn(env().TZ);
  }

  async fakeToday(): Promise<IsoDate | null> {
    if (!env().DEMO_MODE) return null;
    const [row] = await this.db.select().from(systemSettings).where(eq(systemSettings.key, FAKE_TODAY_KEY));
    return typeof row?.value === 'string' ? row.value : null;
  }

  async today(): Promise<IsoDate> {
    return (await this.fakeToday()) ?? this.realToday();
  }

  /** Thời điểm hiện tại, dời theo số ngày giả lập để lịch sử thao tác khớp với "hôm nay" */
  async now(): Promise<Date> {
    const fake = await this.fakeToday();
    if (!fake) return new Date();
    return new Date(Date.now() + diffDays(fake, this.realToday()) * 86_400_000);
  }

  async view(): Promise<ClockView> {
    const fake = await this.fakeToday();
    const realToday = this.realToday();
    return { today: fake ?? realToday, realToday, simulated: fake !== null };
  }

  async setFakeToday(date: IsoDate | null, by: number): Promise<ClockView> {
    if (date === null || date === this.realToday()) {
      await this.db.delete(systemSettings).where(eq(systemSettings.key, FAKE_TODAY_KEY));
    } else {
      await this.db
        .insert(systemSettings)
        .values({ key: FAKE_TODAY_KEY, value: date, updatedBy: by })
        .onConflictDoUpdate({ target: systemSettings.key, set: { value: date, updatedBy: by, updatedAt: new Date() } });
    }
    return this.view();
  }
}
