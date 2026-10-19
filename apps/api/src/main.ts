import 'reflect-metadata';
import fs from 'node:fs';
import path from 'node:path';
import { todayIn } from '@lotrinh/shared';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { setupApiDocs } from './api-docs';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { env } from './config';
import { createDb, runMigrations } from './db/client';
import { isDatabaseEmpty, seedDatabase } from './db/seed';

const log = new Logger('Bootstrap');

/** Lần chạy đầu: tự chạy migration và nạp dữ liệu mẫu nếu cơ sở dữ liệu còn trống (mục 14.6) */
async function prepareDatabase(): Promise<void> {
  const { pool, db } = createDb(env().DATABASE_URL);
  try {
    await runMigrations(db);
    if (env().DEMO_MODE && (await isDatabaseEmpty(db))) {
      const today = todayIn(env().TZ);
      await seedDatabase(db, today);
      log.log(`Cơ sở dữ liệu còn trống: đã nạp dữ liệu mẫu (mốc ngày ${today})`);
    }
  } finally {
    await pool.end();
  }
}

/** API phục vụ luôn giao diện Vue đã build, người dùng chỉ cần mở một địa chỉ (mục 14.1) */
function serveWeb(app: NestExpressApplication): void {
  const dir = path.resolve(__dirname, '../../web/dist');
  const index = path.join(dir, 'index.html');
  if (!fs.existsSync(index)) {
    log.warn('Chưa có giao diện đã build (apps/web/dist). Chạy "pnpm build", hoặc dùng "pnpm dev" và mở http://localhost:5173');
    return;
  }
  app.useStaticAssets(dir);
  // Đường dẫn của giao diện (vd. /hom-nay) không phải file: trả index.html để Vue Router xử lý
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(index);
  });
}

async function bootstrap() {
  await prepareDatabase();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  if (env().API_DOCS) setupApiDocs(app);
  serveWeb(app);
  app.enableShutdownHooks();
  // Khi chạy sau proxy (Render), lấy IP thật của người dùng cho nhật ký hệ thống
  app.set('trust proxy', 1);
  const { PORT, DEMO_MODE } = env();
  await app.listen(PORT);
  log.log(`Mở http://localhost:${PORT} (API: /api/v1${env().API_DOCS ? `, tài liệu API: http://localhost:${PORT}/api/docs` : ''}, DEMO_MODE=${DEMO_MODE})`);
}

bootstrap().catch((err) => {
  log.error(err instanceof Error ? err.message : String(err));
  if (String(err).includes('ECONNREFUSED')) log.error('Không kết nối được PostgreSQL. Kiểm tra dịch vụ PostgreSQL đã chạy và DATABASE_URL trong .env');
  process.exit(1);
});
