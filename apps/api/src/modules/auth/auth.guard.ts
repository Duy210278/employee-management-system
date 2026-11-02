import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { unauthorized } from '../../common/errors';
import { IS_PUBLIC, SESSION_COOKIE, type SessionUser } from '../../common/session';
import { ClockService } from '../../adapters/clock/clock.service';
import { DB } from '../../db/db.provider';
import type { Db } from '../../db/client';
import { users } from '../../db/schema';

const LAST_SEEN_EVERY_MS = 5 * 60_000;

/** Bước 1 của phân quyền (mục 14.8): kiểm tra phiên, tài khoản phải đang Hoạt động */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token: string | undefined = req.cookies?.[SESSION_COOKIE];
    if (!token) throw unauthorized('NO_SESSION', 'Chưa đăng nhập');

    let userId: number;
    try {
      userId = (await this.jwt.verifyAsync<{ sub: number }>(token)).sub;
    } catch {
      throw unauthorized('SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn. Đăng nhập lại.');
    }

    const [user] = await this.db
      .select({
        id: users.id,
        role: users.role,
        status: users.status,
        fullName: users.fullName,
        email: users.email,
        canBuddy: users.canBuddy,
        lastSeenAt: users.lastSeenAt,
      })
      .from(users)
      .where(eq(users.id, userId));
    if (!user || user.status !== 'active') throw unauthorized('ACCOUNT_INACTIVE', 'Tài khoản không còn hoạt động. Đăng nhập lại.');

    req.user = user satisfies SessionUser;
    // Lần vào cuối theo đồng hồ nghiệp vụ, để cảnh báo "không đăng nhập quá 5 ngày" khớp với ngày giả lập
    const now = await this.clock.now();
    if (!user.lastSeenAt || Math.abs(now.getTime() - user.lastSeenAt.getTime()) > LAST_SEEN_EVERY_MS) {
      await this.db.update(users).set({ lastSeenAt: now }).where(eq(users.id, user.id));
    }
    return true;
  }
}
