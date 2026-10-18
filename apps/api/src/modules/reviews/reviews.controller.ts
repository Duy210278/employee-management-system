import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { SaveReviewBody, SignReviewBody, type ReviewResponse, type SaveReviewBodyT } from '@lotrinh/shared';
import { CurrentUser, type SessionUser } from '../../common/session';
import { ZodPipe } from '../../common/zod.pipe';
import { ReviewsService } from './reviews.service';

@Controller('runs')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get(':id/review')
  get(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser): Promise<ReviewResponse> {
    return this.reviews.get(user, id);
  }

  @Put(':id/review')
  save(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(SaveReviewBody)) body: SaveReviewBodyT, @CurrentUser() user: SessionUser) {
    return this.reviews.save(user, id, body);
  }

  @Post(':id/review/sign')
  @HttpCode(200)
  sign(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(SignReviewBody)) body: { step: number }, @CurrentUser() user: SessionUser) {
    return this.reviews.sign(user, id, body.step);
  }
}
