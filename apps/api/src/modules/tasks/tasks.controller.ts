import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import {
  ConfirmBody,
  ConfirmManyBody,
  ReworkBody,
  StatusBody,
  UndoBody,
  type ConfirmBodyT,
  type ConfirmManyBodyT,
  type ConfirmManyResult,
  type ReworkBodyT,
  type StatusBodyT,
  type TaskEventView,
  type TaskView,
  type UndoBodyT,
} from '@lotrinh/shared';
import { CurrentUser, type SessionUser } from '../../common/session';
import { ZodPipe } from '../../common/zod.pipe';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post('confirm-many')
  @HttpCode(200)
  confirmMany(@Body(new ZodPipe(ConfirmManyBody)) body: ConfirmManyBodyT, @CurrentUser() user: SessionUser): Promise<ConfirmManyResult> {
    return this.tasks.confirmMany(user, body);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  confirm(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(ConfirmBody)) body: ConfirmBodyT, @CurrentUser() user: SessionUser): Promise<TaskView> {
    return this.tasks.confirm(user, id, body);
  }

  @Post(':id/undo')
  @HttpCode(200)
  undo(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(UndoBody)) body: UndoBodyT, @CurrentUser() user: SessionUser): Promise<TaskView> {
    return this.tasks.undo(user, id, body);
  }

  @Post(':id/rework')
  @HttpCode(200)
  rework(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(ReworkBody)) body: ReworkBodyT, @CurrentUser() user: SessionUser): Promise<TaskView> {
    return this.tasks.rework(user, id, body);
  }

  @Post(':id/status')
  @HttpCode(200)
  status(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(StatusBody)) body: StatusBodyT, @CurrentUser() user: SessionUser): Promise<TaskView> {
    return this.tasks.setStatus(user, id, body);
  }

  @Get(':id/events')
  events(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser): Promise<TaskEventView[]> {
    return this.tasks.events(user, id);
  }
}
