import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AccountRole, Actor, UserStatus } from '@lotrinh/shared';

export const SESSION_COOKIE = 'lt_session';
export const SESSION_HOURS = 12;

/** Người dùng của request, nạp lại từ DB mỗi lần để đổi vai trò có hiệu lực ngay (mục 5.4) */
export interface SessionUser {
  id: number;
  role: AccountRole;
  status: UserStatus;
  fullName: string;
  email: string;
  canBuddy: boolean;
  lastSeenAt: Date | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export const IS_PUBLIC = 'isPublic';
/** Endpoint không cần đăng nhập */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): SessionUser => {
  return ctx.switchToHttp().getRequest().user;
});

export const toActor = (u: SessionUser): Actor => ({ userId: u.id, role: u.role });
