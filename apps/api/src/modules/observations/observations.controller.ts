import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ObservationBody, type ObservationBodyT, type ObservationsResponse } from '@lotrinh/shared';
import { CurrentUser, type SessionUser } from '../../common/session';
import { ZodPipe } from '../../common/zod.pipe';
import { ObservationsService } from './observations.service';

@Controller('runs')
export class ObservationsController {
  constructor(private readonly observations: ObservationsService) {}

  @Get(':id/observations')
  list(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser): Promise<ObservationsResponse> {
    return this.observations.list(user, id);
  }

  @Post(':id/observations')
  add(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(ObservationBody)) body: ObservationBodyT, @CurrentUser() user: SessionUser) {
    return this.observations.add(user, id, body);
  }
}
