import { and, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mssql-core';
import type { DbLike } from '../../db/client';
import { auditLogs, users } from '../../db/schema';

/** Lịch sử thay đổi tài khoản (mục 5.3) nằm trong nhật ký hệ thống: action = user.change, entity = users */
export const USER_CHANGE_ACTION = 'user.change';

export interface UserChange {
  /** Tài khoản bị thay đổi */
  userId: number;
  /** Người thực hiện (null khi hệ thống tự đổi) */
  changedBy: number | null;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
  at: Date;
}

interface UserChangePayload {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

/** Ghi trong cùng giao dịch với thay đổi tài khoản để lịch sử không lệch dữ liệu */
export async function logUserChanges(tx: DbLike, changes: UserChange[]): Promise<void> {
  if (!changes.length) return;
  await tx.insert(auditLogs).values(
    changes.map((c) => ({
      userId: c.changedBy,
      action: USER_CHANGE_ACTION,
      entity: 'users',
      entityId: String(c.userId),
      payload: { field: c.field, oldValue: c.oldValue ?? null, newValue: c.newValue ?? null } satisfies UserChangePayload,
      at: c.at,
    })),
  );
}

/** Lịch sử của một tài khoản, mới nhất trước */
export async function userChangeHistory(db: DbLike, userId: number) {
  const by = alias(users, 'by');
  const rows = await db
    .select({ id: auditLogs.id, at: auditLogs.at, payload: auditLogs.payload, byName: by.fullName })
    .from(auditLogs)
    .leftJoin(by, eq(by.id, auditLogs.userId))
    .where(and(eq(auditLogs.action, USER_CHANGE_ACTION), eq(auditLogs.entity, 'users'), eq(auditLogs.entityId, String(userId))))
    .orderBy(desc(auditLogs.at), desc(auditLogs.id));
  return rows.map((r) => ({ id: r.id, at: r.at, byName: r.byName, ...(r.payload as UserChangePayload) }));
}
