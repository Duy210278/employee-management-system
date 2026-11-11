import { Body, Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { UpdateUserBody, type UpdateUserBodyT, type UserDetailResponse, type UserListResponse } from '@lotrinh/shared';
import { CurrentUser, type SessionUser } from '../../common/session';
import { ZodPipe } from '../../common/zod.pipe';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() user: SessionUser): Promise<UserListResponse> {
    return this.users.list(user);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser): Promise<UserDetailResponse> {
    return this.users.detail(user, id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(UpdateUserBody)) body: UpdateUserBodyT, @CurrentUser() user: SessionUser): Promise<UserDetailResponse> {
    return this.users.update(user, id, body);
  }
}
