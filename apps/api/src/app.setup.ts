import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { apiPrefix, env } from './config';

/** Cấu hình dùng chung cho main.ts và test */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(apiPrefix());
  app.use(cookieParser());
  // Bản nháp phiên bản gửi cả nội dung (khoảng 100 KB, tiếng Việt UTF-8), vượt giới hạn mặc định 100 KB của Express
  (app as NestExpressApplication).useBodyParser('json', { limit: '5mb' });
  app.use(sameOriginWrites);
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Chống CSRF khi lấy người dùng từ cookie dùng chung của Web A: trình duyệt tự gửi cookie Web A kèm mọi request,
 * nên lệnh ghi phải đến từ chính trang của mình (Origin, hoặc Referer khi thiếu Origin, trùng PUBLIC_URL hoặc Host).
 */
export function sameOriginWrites(req: Request, res: Response, next: NextFunction): void {
  if (env().AUTH_MODE !== 'external' || SAFE_METHODS.has(req.method)) return next();
  let origin = req.headers.origin;
  if (!origin && req.headers.referer) {
    try {
      origin = new URL(req.headers.referer).origin;
    } catch {
      origin = undefined;
    }
  }
  const expected = env().PUBLIC_URL ? new URL(env().PUBLIC_URL!).origin : `${req.protocol}://${req.get('host')}`;
  if (origin === expected) return next();
  res.status(403).json({ code: 'CSRF', message: 'Yêu cầu không đến từ trang Lộ trình, đã bị chặn' });
}
