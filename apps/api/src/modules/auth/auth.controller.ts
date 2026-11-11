import { Body, Controller, Get, HttpCode, NotFoundException, Post, Req, Res } from '@nestjs/common';
import { LoginBody, RegisterBody, type AuthConfigResponse, type LoginBodyT, type RegisterBodyT, type RegisterOptions } from '@lotrinh/shared';
import type { Request, Response } from 'express';
import { Public } from '../../common/session';
import { env } from '../../config';
import { ZodPipe } from '../../common/zod.pipe';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  /** Giao diện hỏi cách đăng nhập: local (trang đăng nhập riêng) hay external (về trang đăng nhập Web A) */
  @Public()
  @Get('config')
  config(): AuthConfigResponse {
    const e = env();
    return { authMode: e.AUTH_MODE, loginUrl: e.AUTH_MODE === 'external' ? (e.HOST_LOGIN_URL ?? null) : null, logoutUrl: e.AUTH_MODE === 'external' ? (e.HOST_LOGOUT_URL ?? null) : null };
  }

  /** Đăng nhập, đăng ký riêng chỉ có ở chế độ local; khi lấy người dùng từ Web A thì không tồn tại */
  private localOnly() {
    if (env().AUTH_MODE !== 'local') throw new NotFoundException();
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodPipe(LoginBody)) body: LoginBodyT, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.localOnly();
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
    // Chế độ external: phiên thật nằm ở Web A, giao diện chuyển tiếp sang trang đăng xuất của Web A
    return { ok: true, logoutUrl: env().AUTH_MODE === 'external' ? (env().HOST_LOGOUT_URL ?? null) : null };
  }

  @Public()
  @Get('register-options')
  registerOptions(): Promise<RegisterOptions> {
    this.localOnly();
    return this.auth.registerOptions();
  }

  @Public()
  @Post('register')
  async register(@Body(new ZodPipe(RegisterBody)) body: RegisterBodyT, @Req() req: Request) {
    this.localOnly();
    const { id } = await this.auth.register(body);
    await this.audit.log({ userId: id, action: 'auth.register', entity: 'users', entityId: String(id), payload: { email: body.email, role: body.requestedRole }, ip: req.ip });
    return { ok: true };
  }
}
