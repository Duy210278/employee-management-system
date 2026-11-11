import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { ClockService } from '../../adapters/clock/clock.service';
import { IdentityService, InvalidIdentityError } from '../../adapters/identity/identity.service';
import { unauthorized } from '../../common/errors';
import { IS_PUBLIC, SESSION_COOKIE, type SessionUser } from '../../common/session';
import { env } from '../../config';
import type { Db } from '../../db/client';
import { DB } from '../../db/db.provider';
import { users } from '../../db/schema';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';
import { UserSyncService } from './user-sync.service';

const LAST_SEEN_EVERY_MS = 5 * 60_000;

/** Nội dung phiên của module; hfp: dấu vân tay cookie Web A đã dùng để cấp phiên (chế độ external) */
interface SessionPayload {
  sub: number;
  hfp?: string;
}

/**
 * Bước 1 của phân quyền (mục 14.8): xác định người dùng của request, tài khoản phải đang Hoạt động.
 * local: phiên do module cấp khi đăng nhập bằng email, mật khẩu.
 * external: người dùng do cookie dùng chung của Web A xác nhận. Phiên module (lt_session) chỉ là bộ đệm ngắn hạn,
 * gắn với đúng cookie Web A đã dùng: đổi người ở Web A, đăng xuất Web A hoặc quá HOST_RECHECK_MINUTES thì đọc lại
 * cookie và đồng bộ lại vai trò, phạm vi.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  /** Các request đầu tiên chạy song song của cùng một cookie Web A dùng chung một lần đồng bộ */
  private readonly inflight = new Map<string, Promise<SessionUser>>();

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly identity: IdentityService,
    private readonly userSync: UserSyncService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const user = env().AUTH_MODE === 'external' ? await this.externalUser(req, res) : await this.localUser(req);
    req.user = user;
    // Lần vào cuối theo đồng hồ nghiệp vụ, để cảnh báo "không đăng nhập quá 5 ngày" khớp với "hôm nay" của nghiệp vụ
    const now = await this.clock.now();
    if (!user.lastSeenAt || Math.abs(now.getTime() - user.lastSeenAt.getTime()) > LAST_SEEN_EVERY_MS) {
      await this.db.update(users).set({ lastSeenAt: now }).where(eq(users.id, user.id));
    }
    return true;
  }

  private async session(req: Request): Promise<SessionPayload | null> {
    const token: string | undefined = req.cookies?.[SESSION_COOKIE];
    if (!token) return null;
    try {
      return await this.jwt.verifyAsync<SessionPayload>(token);
    } catch {
      return null;
    }
  }

  private async loadActive(userId: number): Promise<SessionUser | null> {
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
    return user && user.status === 'active' ? user : null;
  }

  private async localUser(req: Request): Promise<SessionUser> {
    if (!req.cookies?.[SESSION_COOKIE]) throw unauthorized('NO_SESSION', 'Chưa đăng nhập');
    const payload = await this.session(req);
    if (!payload) throw unauthorized('SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn. Đăng nhập lại.');
    const user = await this.loadActive(payload.sub);
    if (!user) throw unauthorized('ACCOUNT_INACTIVE', 'Tài khoản không còn hoạt động. Đăng nhập lại.');
    return user;
  }

  private async externalUser(req: Request, res: Response): Promise<SessionUser> {
    const hostToken = this.identity.token(req);
    if (!hostToken) {
      this.auth.endSession(res);
      throw unauthorized('SSO_REQUIRED', 'Chưa đăng nhập hệ thống chính');
    }
    const fp = this.identity.fingerprint(hostToken);
    const payload = await this.session(req);
    if (payload?.hfp === fp) {
      const user = await this.loadActive(payload.sub);
      if (user) return user;
    }
    let pending = this.inflight.get(fp);
    if (!pending) {
      pending = this.signIn(req, res, fp).finally(() => this.inflight.delete(fp));
      this.inflight.set(fp, pending);
      return pending;
    }
    // Request chạy song song: dùng kết quả của lần đồng bộ đang chạy; cookie phiên do request đầu đặt
    const user = await pending;
    await this.auth.startSession(res, user.id, { hfp: fp, minutes: env().HOST_RECHECK_MINUTES });
    return user;
  }

  private async signIn(req: Request, res: Response, fp: string): Promise<SessionUser> {
    let identity;
    try {
      identity = await this.identity.resolve(req);
    } catch (err) {
      if (err instanceof InvalidIdentityError) throw unauthorized('SSO_INVALID', 'Phiên đăng nhập hệ thống chính không hợp lệ hoặc đã hết hạn. Đăng nhập lại.');
      throw err;
    }
    if (!identity) throw unauthorized('SSO_REQUIRED', 'Chưa đăng nhập hệ thống chính');
    const user = await this.userSync.ensure(identity);
    await this.auth.startSession(res, user.id, { hfp: fp, minutes: env().HOST_RECHECK_MINUTES });
    await this.audit.log({ userId: user.id, action: 'auth.sso', entity: 'users', entityId: String(user.id), payload: { employeeCode: identity.employeeCode }, ip: req.ip });
    return user;
  }
}
