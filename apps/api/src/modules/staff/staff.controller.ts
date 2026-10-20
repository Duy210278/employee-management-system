import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import {
  CreateStaffBody,
  DeleteStaffBody,
  StopStaffBody,
  TransferBody,
  type CreateStaffBodyT,
  type DeleteStaffBodyT,
  type RunManageResponse,
  type StaffFormOptions,
  type StaffListResponse,
  type StaffProfileResponse,
  type StopStaffBodyT,
  type TransferBodyT,
} from '@lotrinh/shared';
import { CurrentUser, type SessionUser } from '../../common/session';
import { ZodPipe } from '../../common/zod.pipe';
import { RunManageService } from '../runs/run-manage.service';
import { StaffService } from './staff.service';

@Controller('staff')
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly manage: RunManageService,
  ) {}

  @Get()
  list(@CurrentUser() user: SessionUser): Promise<StaffListResponse> {
    return this.staff.list(user);
  }

  @Get('form-options')
  formOptions(@CurrentUser() user: SessionUser): Promise<StaffFormOptions> {
    return this.staff.formOptions(user);
  }

  @Post()
  create(@Body(new ZodPipe(CreateStaffBody)) body: CreateStaffBodyT, @CurrentUser() user: SessionUser) {
    return this.staff.create(user, body);
  }

  @Get(':id')
  profile(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser): Promise<StaffProfileResponse> {
    return this.staff.profile(user, id);
  }

  @Post(':id/transfer')
  @HttpCode(200)
  transfer(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(TransferBody)) body: TransferBodyT, @CurrentUser() user: SessionUser): Promise<RunManageResponse> {
    return this.manage.transfer(user, id, body);
  }

  @Post(':id/stop')
  @HttpCode(200)
  stop(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(StopStaffBody)) body: StopStaffBodyT, @CurrentUser() user: SessionUser): Promise<RunManageResponse> {
    return this.manage.stop(user, id, body);
  }

  /** Chỉ BP Đào tạo: xóa hẳn hồ sơ và mọi lượt Level; tài khoản đăng nhập giữ nguyên */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(DeleteStaffBody)) body: DeleteStaffBodyT, @CurrentUser() user: SessionUser) {
    return this.staff.remove(user, id, body);
  }
}
