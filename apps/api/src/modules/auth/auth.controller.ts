import { Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public, SESSION_COOKIE } from '../../common/session';
import { env } from '../../config';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get('config')
  config() {
    const e = env();
    return { loginUrl: e.HOST_LOGIN_URL ?? null, logoutUrl: e.HOST_LOGOUT_URL ?? null };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    this.auth.endSession(res);
    return { ok: true, logoutUrl: env().HOST_LOGOUT_URL ?? null };
  }
}
