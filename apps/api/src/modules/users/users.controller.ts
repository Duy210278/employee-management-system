import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import {
  ApproveUserBody,
  CreateUserBody,
  ImportUsersBody,
  RejectUserBody,
  UpdateUserBody,
  type ApproveUserBodyT,
  type CreateUserBodyT,
  type ImportUsersResponse,
  type UpdateUserBodyT,
  type UserDetailResponse,
  type UserListResponse,
} from '@lotrinh/shared';
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

  @Post()
  create(@Body(new ZodPipe(CreateUserBody)) body: CreateUserBodyT, @CurrentUser() user: SessionUser) {
    return this.users.create(user, body);
  }

  @Post('import')
  @HttpCode(200)
  import(@Body(new ZodPipe(ImportUsersBody)) body: { csv: string; commit: boolean }, @CurrentUser() user: SessionUser): Promise<ImportUsersResponse> {
    return this.users.importCsv(user, body.csv, body.commit);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser): Promise<UserDetailResponse> {
    return this.users.detail(user, id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(UpdateUserBody)) body: UpdateUserBodyT, @CurrentUser() user: SessionUser): Promise<UserDetailResponse> {
    return this.users.update(user, id, body);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(ApproveUserBody)) body: ApproveUserBodyT, @CurrentUser() user: SessionUser): Promise<UserDetailResponse> {
    return this.users.approve(user, id, body);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(RejectUserBody)) body: { note: string }, @CurrentUser() user: SessionUser): Promise<UserDetailResponse> {
    return this.users.reject(user, id, body.note);
  }
}
