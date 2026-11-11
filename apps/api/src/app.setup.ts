import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { apiPrefix } from './config';

/** Cấu hình dùng chung cho main.ts và test */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(apiPrefix());
  app.use(cookieParser());
  // Bản nháp phiên bản gửi cả nội dung (khoảng 100 KB, tiếng Việt UTF-8), vượt giới hạn mặc định 100 KB của Express
  (app as NestExpressApplication).useBodyParser('json', { limit: '5mb' });
}
