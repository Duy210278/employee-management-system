import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { MarkReadBody, type NotificationsResponse } from '@lotrinh/shared';
import { CurrentUser, type SessionUser } from '../../common/session';
import { ZodPipe } from '../../common/zod.pipe';
import { NotificationsService } from './notifications.service';

@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser): Promise<NotificationsResponse> {
    return this.notifications.list(user);
  }

  @Post('read')
  @HttpCode(200)
  read(@Body(new ZodPipe(MarkReadBody)) body: { ids?: number[]; all?: boolean }, @CurrentUser() user: SessionUser): Promise<NotificationsResponse> {
    return this.notifications.markRead(user, body);
  }
}
