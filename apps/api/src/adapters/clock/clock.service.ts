import { Injectable } from '@nestjs/common';
import { todayIn, type ClockView, type IsoDate } from '@lotrinh/shared';
import { env } from '../../config';

/**
 * Nguồn "hôm nay" duy nhất của nghiệp vụ (mục 14.7, 14.9). Không gọi new Date() trực tiếp trong nghiệp vụ.
 * Luôn là ngày thật theo múi giờ TZ. Test thay bằng đồng hồ giả (overrideProvider trong test/helpers.ts),
 * nên các hàm giữ dạng async để nơi gọi không phải đổi.
 */
@Injectable()
export class ClockService {
  async today(): Promise<IsoDate> {
    return todayIn(env().TZ);
  }

  async now(): Promise<Date> {
    return new Date();
  }

  async view(): Promise<ClockView> {
    return { today: await this.today() };
  }
}
