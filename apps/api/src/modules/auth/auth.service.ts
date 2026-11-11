import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { SESSION_COOKIE, SESSION_HOURS } from '../../common/session';
import { env } from '../../config';

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  /** Cookie phiên của module: chỉ cho đường dẫn của module, không đặt Domain để không đè cookie của Web A */
  private cookieOptions() {
    const e = env();
    return { httpOnly: true, sameSite: 'lax' as const, path: e.BASE_PATH ? `${e.BASE_PATH}/` : '/', secure: !!e.PUBLIC_URL?.startsWith('https://') };
  }

  /** opts.hfp: dấu vân tay cookie Web A (chế độ external); opts.minutes: thời hạn phiên, mặc định SESSION_HOURS */
  async startSession(res: Response, userId: number, opts: { hfp?: string; minutes?: number } = {}): Promise<void> {
    const minutes = opts.minutes ?? SESSION_HOURS * 60;
    const token = await this.jwt.signAsync(opts.hfp ? { sub: userId, hfp: opts.hfp } : { sub: userId }, { expiresIn: `${minutes}m` });
    res.cookie(SESSION_COOKIE, token, { ...this.cookieOptions(), maxAge: minutes * 60_000 });
  }

  endSession(res: Response): void {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }
}
