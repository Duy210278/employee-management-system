import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { CoreModule } from './core.module';
import { AlertsController } from './modules/alerts/alerts.controller';
import { AlertsService } from './modules/alerts/alerts.service';
import { AuditController } from './modules/audit/audit.controller';
import { AuthModule } from './modules/auth/auth.module';
import { DemoController } from './modules/demo/demo.controller';
import { HealthController } from './modules/health/health.controller';
import { JobsService } from './modules/jobs/jobs.service';
import { MeController } from './modules/me/me.controller';
import { MeService } from './modules/me/me.service';
import { NotificationsController } from './modules/notifications/notifications.controller';
import { ObservationsController } from './modules/observations/observations.controller';
import { ObservationsService } from './modules/observations/observations.service';
import { OrgController } from './modules/org/org.controller';
import { ReportsController } from './modules/reports/reports.controller';
import { ReviewsController } from './modules/reviews/reviews.controller';
import { ReviewsService } from './modules/reviews/reviews.service';
import { RunManageService } from './modules/runs/run-manage.service';
import { RunsController } from './modules/runs/runs.controller';
import { RunsService } from './modules/runs/runs.service';
import { SalesController } from './modules/sales/sales.controller';
import { SalesService } from './modules/sales/sales.service';
import { StaffController } from './modules/staff/staff.controller';
import { StaffService } from './modules/staff/staff.service';
import { TasksController } from './modules/tasks/tasks.controller';
import { TasksService } from './modules/tasks/tasks.service';
import { UsersController } from './modules/users/users.controller';
import { UsersService } from './modules/users/users.service';
import { FrameworkController } from './modules/versions/framework.controller';
import { VersionLifecycleService } from './modules/versions/version-lifecycle.service';
import { VersionsController } from './modules/versions/versions.controller';

@Module({
  imports: [CoreModule, AuthModule],
  controllers: [
    HealthController,
    DemoController,
    MeController,
    NotificationsController,
    StaffController,
    RunsController,
    TasksController,
    SalesController,
    ObservationsController,
    ReviewsController,
    VersionsController,
    FrameworkController,
    UsersController,
    OrgController,
    AlertsController,
    AuditController,
    ReportsController,
  ],
  providers: [
    MeService,
    StaffService,
    RunsService,
    RunManageService,
    TasksService,
    VersionLifecycleService,
    SalesService,
    ObservationsService,
    ReviewsService,
    UsersService,
    AlertsService,
    JobsService,
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
