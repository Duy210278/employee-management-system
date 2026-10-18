import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Db } from '../../db/client';
import { auditLogs } from '../../db/schema';
import { DB } from '../../db/db.provider';

export interface AuditEntry {
  userId: number | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  payload?: unknown;
  ip?: string | null;
}

/** Nhật ký hệ thống (mục 5.7): chỉ ghi thêm, không sửa, không xóa */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(@Inject(DB) private readonly db: Db) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.db.insert(auditLogs).values({
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        payload: entry.payload ?? null,
        ip: entry.ip ?? null,
      });
    } catch (err) {
      this.logger.error(`Không ghi được nhật ký ${entry.action}: ${(err as Error).message}`);
    }
  }
}
