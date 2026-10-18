import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { CoreModule } from './core.module';
import { AuthModule } from './modules/auth/auth.module';
import { DemoController } from './modules/demo/demo.controller';
import { HealthController } from './modules/health/health.controller';
import { MeController } from './modules/me/me.controller';
import { MeService } from './modules/me/me.service';
import { ObservationsController } from './modules/observations/observations.controller';
import { ObservationsService } from './modules/observations/observations.service';
import { ReviewsController } from './modules/reviews/reviews.controller';
import { ReviewsService } from './modules/reviews/reviews.service';
import { RunsController } from './modules/runs/runs.controller';
import { RunsService } from './modules/runs/runs.service';
import { SalesController } from './modules/sales/sales.controller';
import { SalesService } from './modules/sales/sales.service';
import { StaffController } from './modules/staff/staff.controller';
import { StaffService } from './modules/staff/staff.service';
import { TasksController } from './modules/tasks/tasks.controller';
import { TasksService } from './modules/tasks/tasks.service';
import { VersionLifecycleService } from './modules/versions/version-lifecycle.service';
import { VersionsController } from './modules/versions/versions.controller';

@Module({
  imports: [CoreModule, AuthModule],
  controllers: [
    HealthController,
    DemoController,
    MeController,
    StaffController,
    RunsController,
    TasksController,
    SalesController,
    ObservationsController,
    ReviewsController,
    VersionsController,
  ],
  providers: [
    MeService,
    StaffService,
    RunsService,
    TasksService,
    VersionLifecycleService,
    SalesService,
    ObservationsService,
    ReviewsService,
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
