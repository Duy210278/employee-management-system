import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateStaffBody, type CreateStaffBodyT, type StaffFormOptions, type StaffListResponse, type StaffProfileResponse } from '@lotrinh/shared';
import { CurrentUser, type SessionUser } from '../../common/session';
import { ZodPipe } from '../../common/zod.pipe';
import { StaffService } from './staff.service';

@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

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
}
