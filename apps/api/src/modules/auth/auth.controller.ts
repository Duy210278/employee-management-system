import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { LoginBody, type LoginBodyT } from '@lotrinh/shared';
import type { Request, Response } from 'express';
import { Public } from '../../common/session';
import { ZodPipe } from '../../common/zod.pipe';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodPipe(LoginBody)) body: LoginBodyT, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.verifyPassword(body.email, body.password);
    await this.auth.startSession(res, user.id);
    await this.audit.log({ userId: user.id, action: 'auth.login', entity: 'users', entityId: String(user.id), ip: req.ip });
    return { ok: true };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    this.auth.endSession(res);
    return { ok: true };
  }
}
