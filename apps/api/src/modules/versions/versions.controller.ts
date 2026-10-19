import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Res } from '@nestjs/common';
import {
  ApproveBody,
  CreateDraftBody,
  RescheduleBody,
  ReturnBody,
  SaveDraftBody,
  SubmitBody,
  type ApproveBodyT,
  type SaveDraftBodyT,
  type VersionDetailResponse,
  type VersionListResponse,
} from '@lotrinh/shared';
import type { Response } from 'express';
import { CurrentUser, type SessionUser } from '../../common/session';
import { ZodPipe } from '../../common/zod.pipe';
import { VersionLifecycleService } from './version-lifecycle.service';

@Controller('versions')
export class VersionsController {
  constructor(private readonly versions: VersionLifecycleService) {}

  @Get()
  list(@CurrentUser() user: SessionUser): Promise<VersionListResponse> {
    return this.versions.list(user);
  }

  @Post()
  createDraft(@Body(new ZodPipe(CreateDraftBody)) body: { fromId: number }, @CurrentUser() user: SessionUser) {
    return this.versions.createDraft(user, body.fromId);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser): Promise<VersionDetailResponse> {
    return this.versions.detail(user, id);
  }

  @Put(':id/content')
  save(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(SaveDraftBody)) body: SaveDraftBodyT, @CurrentUser() user: SessionUser) {
    return this.versions.saveDraft(user, id, body);
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(SubmitBody)) body: { changeNote?: string }, @CurrentUser() user: SessionUser) {
    return this.versions.submit(user, id, body.changeNote);
  }

  @Post(':id/withdraw')
  @HttpCode(200)
  withdraw(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser) {
    return this.versions.withdraw(user, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(ReturnBody)) body: { note: string }, @CurrentUser() user: SessionUser) {
    return this.versions.reject(user, id, body.note);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(ApproveBody)) body: ApproveBodyT, @CurrentUser() user: SessionUser) {
    return this.versions.approve(user, id, body);
  }

  @Put(':id/effective')
  reschedule(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(RescheduleBody)) body: ApproveBodyT, @CurrentUser() user: SessionUser) {
    return this.versions.reschedule(user, id, body.effectiveFrom);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser) {
    return this.versions.remove(user, id);
  }

  /** Xuất JSON để lưu trữ, chuyển môi trường (mục 7.3) */
  @Get(':id/export')
  async export(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser, @Res() res: Response) {
    const { filename, content } = await this.versions.exportJson(user, id);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(content);
  }
}
