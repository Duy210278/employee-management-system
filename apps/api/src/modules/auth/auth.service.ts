import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { Response } from 'express';
import { forbidden, unauthorized } from '../../common/errors';
import { SESSION_COOKIE, SESSION_HOURS } from '../../common/session';
import { DB } from '../../db/db.provider';
import type { Db } from '../../db/client';
import { credentials, users } from '../../db/schema';

const INACTIVE_MESSAGE: Record<string, string> = {
  pending: 'Tài khoản đang chờ BP Đào tạo duyệt',
  locked: 'Tài khoản đang bị tạm khóa. Liên hệ BP Đào tạo',
  left: 'Tài khoản đã ngừng hoạt động',
  rejected: 'Đăng ký tài khoản đã bị từ chối. Liên hệ BP Đào tạo',
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
  ) {}

  async verifyPassword(email: string, password: string) {
    const [row] = await this.db
      .select({ user: users, hash: credentials.passwordHash })
      .from(users)
      .leftJoin(credentials, eq(credentials.userId, users.id))
      .where(eq(users.email, email));
    if (!row?.hash || !(await bcrypt.compare(password, row.hash))) {
      throw unauthorized('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
    }
    this.assertActive(row.user.status);
    return row.user;
  }

  async findActiveUser(userId: number) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw unauthorized('INVALID_CREDENTIALS', 'Không tìm thấy tài khoản');
    this.assertActive(user.status);
    return user;
  }

  assertActive(status: string): void {
    if (status !== 'active') throw forbidden('ACCOUNT_INACTIVE', INACTIVE_MESSAGE[status] ?? 'Tài khoản không hoạt động');
  }

  async startSession(res: Response, userId: number): Promise<void> {
    const token = await this.jwt.signAsync({ sub: userId });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_HOURS * 3600 * 1000,
    });
  }

  endSession(res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}
