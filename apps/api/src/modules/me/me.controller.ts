import { Controller, Get } from '@nestjs/common';
import type { InboxResponse, MeResponse, TodayResponse } from '@lotrinh/shared';
import { CurrentUser, type SessionUser } from '../../common/session';
import { MeService } from './me.service';

@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  get(@CurrentUser() user: SessionUser): Promise<MeResponse> {
    return this.me.me(user);
  }

  @Get('today')
  today(@CurrentUser() user: SessionUser): Promise<TodayResponse> {
    return this.me.today(user);
  }

  @Get('inbox')
  inbox(@CurrentUser() user: SessionUser): Promise<InboxResponse> {
    return this.me.inbox(user);
  }
}
