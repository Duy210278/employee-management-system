import { Controller, Get } from '@nestjs/common';
import type { AlertsResponse } from '@lotrinh/shared';
import { forbidden } from '../../common/errors';
import { CurrentUser, type SessionUser } from '../../common/session';
import { AccessService } from '../access/access.service';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly alerts: AlertsService,
    private readonly access: AccessService,
  ) {}

  /** Trang Cảnh báo (mục 11.6): CHT, QLKV trong phạm vi, BP ĐT toàn chuỗi */
  @Get()
  async list(@CurrentUser() user: SessionUser): Promise<AlertsResponse> {
    if (!(await this.access.can(user, 'read', 'StaffList'))) throw forbidden('FORBIDDEN', 'Trang Cảnh báo dành cho CHT, QLKV và BP Đào tạo');
    return this.alerts.list(user);
  }
}
