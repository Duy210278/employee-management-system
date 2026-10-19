import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import {
  ChtConfirmBody,
  ChtEvaluationBody,
  ChtJournalBody,
  ChtMetaBody,
  CreateChtRunBody,
  type ChtEvaluationBodyT,
  type ChtFormOptions,
  type ChtJournalBodyT,
  type ChtOnboardingResponse,
  type CreateChtRunBodyT,
} from '@lotrinh/shared';
import { CurrentUser, type SessionUser } from '../../common/session';
import { ZodPipe } from '../../common/zod.pipe';
import { ChtService } from './cht.service';

@Controller()
export class ChtController {
  constructor(private readonly cht: ChtService) {}

  @Get('cht/form-options/:userId')
  formOptions(@Param('userId', ParseIntPipe) userId: number, @CurrentUser() user: SessionUser): Promise<ChtFormOptions> {
    return this.cht.formOptions(user, userId);
  }

  @Post('cht/runs')
  create(@Body(new ZodPipe(CreateChtRunBody)) body: CreateChtRunBodyT, @CurrentUser() user: SessionUser) {
    return this.cht.create(user, body);
  }

  @Get('runs/:id/cht')
  get(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser): Promise<ChtOnboardingResponse> {
    return this.cht.get(user, id);
  }

  @Put('runs/:id/cht/journal/:day')
  journal(
    @Param('id', ParseIntPipe) id: number,
    @Param('day', ParseIntPipe) day: number,
    @Body(new ZodPipe(ChtJournalBody)) body: ChtJournalBodyT,
    @CurrentUser() user: SessionUser,
  ): Promise<ChtOnboardingResponse> {
    return this.cht.saveJournal(user, id, day, body);
  }

  @Put('runs/:id/cht/evaluation')
  evaluation(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(ChtEvaluationBody)) body: ChtEvaluationBodyT, @CurrentUser() user: SessionUser): Promise<ChtOnboardingResponse> {
    return this.cht.saveEvaluation(user, id, body);
  }

  @Post('runs/:id/cht/evaluation/confirm')
  @HttpCode(200)
  confirm(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(ChtConfirmBody)) body: { note: string }, @CurrentUser() user: SessionUser): Promise<ChtOnboardingResponse> {
    return this.cht.confirm(user, id, body.note);
  }

  @Put('runs/:id/cht/meta')
  meta(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(ChtMetaBody)) body: { managerNote: string }, @CurrentUser() user: SessionUser): Promise<ChtOnboardingResponse> {
    return this.cht.saveManagerNote(user, id, body.managerNote);
  }
}
