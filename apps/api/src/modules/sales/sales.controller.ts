import { Body, Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { SalesBody, type SalesBodyT, type SalesResponse } from '@lotrinh/shared';
import { CurrentUser, type SessionUser } from '../../common/session';
import { ZodPipe } from '../../common/zod.pipe';
import { SalesService } from './sales.service';

@Controller('runs')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get(':id/sales')
  get(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser): Promise<SalesResponse> {
    return this.sales.get(user, id);
  }

  @Put(':id/sales/:month')
  put(
    @Param('id', ParseIntPipe) id: number,
    @Param('month', ParseIntPipe) month: number,
    @Body(new ZodPipe(SalesBody)) body: SalesBodyT,
    @CurrentUser() user: SessionUser,
  ): Promise<SalesResponse> {
    return this.sales.put(user, id, month, body);
  }
}
