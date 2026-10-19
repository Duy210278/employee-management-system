import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import {
  AssignmentBody,
  PauseBody,
  PauseDecisionBody,
  StageSignBody,
  type AssignmentRole,
  type OverviewResponse,
  type PauseBodyT,
  type RunManageResponse,
  type RunTasksResponse,
} from '@lotrinh/shared';
import { CurrentUser, type SessionUser } from '../../common/session';
import { ZodPipe } from '../../common/zod.pipe';
import { RunManageService } from './run-manage.service';
import { RunsService } from './runs.service';

@Controller('runs')
export class RunsController {
  constructor(
    private readonly runs: RunsService,
    private readonly manageService: RunManageService,
  ) {}

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

  @Post(':id/stages/:stageKey/sign')
  @HttpCode(200)
  signStage(
    @Param('id', ParseIntPipe) id: number,
    @Param('stageKey') stageKey: string,
    @Body(new ZodPipe(StageSignBody)) body: { step: number },
    @CurrentUser() user: SessionUser,
  ): Promise<RunTasksResponse> {
    return this.runs.signStage(user, id, stageKey, body.step);
  }

  @Get(':id/manage')
  manage(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser): Promise<RunManageResponse> {
    return this.manageService.manage(user, id);
  }

  @Post(':id/pauses')
  @HttpCode(200)
  pause(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(PauseBody)) body: PauseBodyT, @CurrentUser() user: SessionUser): Promise<RunManageResponse> {
    return this.manageService.requestPause(user, id, body);
  }

  @Post(':id/pauses/:pauseId/decision')
  @HttpCode(200)
  decide(
    @Param('id', ParseIntPipe) id: number,
    @Param('pauseId', ParseIntPipe) pauseId: number,
    @Body(new ZodPipe(PauseDecisionBody)) body: { approve: boolean; note: string },
    @CurrentUser() user: SessionUser,
  ): Promise<RunManageResponse> {
    return this.manageService.decidePause(user, id, pauseId, body);
  }

  @Post(':id/assignments')
  @HttpCode(200)
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodPipe(AssignmentBody)) body: { role: AssignmentRole; userId: number },
    @CurrentUser() user: SessionUser,
  ): Promise<RunManageResponse> {
    return this.manageService.assign(user, id, body);
  }
}
