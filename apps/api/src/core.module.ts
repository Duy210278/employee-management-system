import { Global, Module } from '@nestjs/common';
import { AccessService } from './modules/access/access.service';
import { AuditService } from './modules/audit/audit.service';
import { ClockService } from './adapters/clock/clock.service';
import { DB, dbProviders, PoolShutdown } from './db/db.provider';
import { RunContextService } from './modules/runs/run-context.service';
import { TaskQueryService } from './modules/runs/task-query.service';
import { VersionsService } from './modules/versions/versions.service';
import { NotificationsService } from './modules/notifications/notifications.service';

/** Dịch vụ dùng chung cho mọi module: DB, đồng hồ nghiệp vụ, nhật ký, thông báo, phạm vi dữ liệu, ngữ cảnh lượt Level */
@Global()
@Module({
  providers: [...dbProviders, PoolShutdown, ClockService, AuditService, AccessService, VersionsService, RunContextService, TaskQueryService, NotificationsService],
  exports: [DB, ClockService, AuditService, AccessService, VersionsService, RunContextService, TaskQueryService, NotificationsService],
})
export class CoreModule {}
