import {
  Body,
  CanActivate,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { addDays, ClockBody, LoginAsBody, type ClockBodyT, type ClockView, type DemoAccount } from '@lotrinh/shared';
import type { Request, Response } from 'express';
import { env } from '../../config';
import { CurrentUser, Public, type SessionUser } from '../../common/session';
import { ZodPipe } from '../../common/zod.pipe';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../../adapters/clock/clock.service';
import { DB } from '../../db/db.provider';
import type { Db } from '../../db/client';
import { users } from '../../db/schema';
import { resetDatabase } from '../../db/seed';
import { SEED_USERS } from '../../db/seed/seed-data';
import { AccessService } from '../access/access.service';
import { AuthService } from '../auth/auth.service';
import { VersionsService } from '../versions/versions.service';

/** Công cụ demo chỉ tồn tại khi DEMO_MODE=true, tắt ở cả API lẫn giao diện (mục 14.7) */
@Injectable()
class DemoModeGuard implements CanActivate {
  canActivate(): boolean {
    if (!env().DEMO_MODE) throw new NotFoundException();
    return true;
  }
}

const ROLE_ORDER = { bp: 0, qlkv: 1, cht: 2, nv: 3 } as const;

@Controller('demo')
@UseGuards(DemoModeGuard)
export class DemoController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly auth: AuthService,
    private readonly clock: ClockService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
    private readonly versions: VersionsService,
  ) {}

  @Public()
  @Get('accounts')
  async accounts(): Promise<DemoAccount[]> {
    const notes = new Map(SEED_USERS.map((u) => [u.email, u.note]));
    const rows = await this.db.select().from(users);
    return rows
      .map((u) => ({ id: u.id, email: u.email, fullName: u.fullName, role: u.role, status: u.status, note: notes.get(u.email) ?? '' }))
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.id - b.id);
  }

  @Public()
  @Post('login-as')
  @HttpCode(200)
  async loginAs(@Body(new ZodPipe(LoginAsBody)) body: { userId: number }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.findActiveUser(body.userId);
    await this.auth.startSession(res, user.id);
    await this.audit.log({ userId: user.id, action: 'auth.login_demo', entity: 'users', entityId: String(user.id), ip: req.ip });
    return { ok: true };
  }

  @Get('clock')
  clockView(): Promise<ClockView> {
    return this.clock.view();
  }

  @Put('clock')
  async setClock(@Body(new ZodPipe(ClockBody)) body: ClockBodyT, @CurrentUser() user: SessionUser): Promise<ClockView> {
    await this.access.assertCan(user, 'manage', 'Clock', 'Chỉ BP Đào tạo được đặt ngày giả lập');
    if (body.shiftDays !== undefined) {
      return this.clock.setFakeToday(addDays(await this.clock.today(), body.shiftDays), user.id);
    }
    return this.clock.setFakeToday(body.date ?? null, user.id);
  }

  /** Xóa sạch, nạp lại bộ mẫu, đặt lại ngày thật (mục 14.7) */
  @Post('reset')
  @HttpCode(200)
  async reset(@CurrentUser() user: SessionUser): Promise<{ ok: true; today: string }> {
    await this.access.assertCan(user, 'manage', 'DemoData', 'Chỉ BP Đào tạo được khôi phục dữ liệu mẫu');
    const today = this.clock.realToday();
    await resetDatabase(this.db, today);
    this.versions.clearCache();
    await this.audit.log({ userId: null, action: 'demo.reset', payload: { by: user.email, today } });
    return { ok: true, today };
  }
}
