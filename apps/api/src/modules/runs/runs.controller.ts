import { Controller, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import type { OverviewResponse, RunTasksResponse } from '@lotrinh/shared';
import { CurrentUser, type SessionUser } from '../../common/session';
import { RunsService } from './runs.service';

@Controller('runs')
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Get(':id/tasks')
  tasks(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser): Promise<RunTasksResponse> {
    return this.runs.tasks(user, id);
  }

  @Get(':id/overview')
  overview(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser): Promise<OverviewResponse> {
    return this.runs.overview(user, id);
  }

  @Post(':id/ack')
  @HttpCode(200)
  ack(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser) {
    return this.runs.acknowledge(user, id);
  }
}
