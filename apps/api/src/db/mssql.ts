import { sql, type InferInsertModel, type InferSelectModel, type SQL } from 'drizzle-orm';
import type { MsSqlTable } from 'drizzle-orm/mssql-core';
import type { DbLike } from './client';

/**
 * Các mẫu thay cho tính năng PostgreSQL mà SQL Server không có (xem docs/thiet-ke/sqlserver/KET_QUA_THU_DRIZZLE.md).
 */

/** Số dòng bị ảnh hưởng của lệnh sửa, xóa (kết quả của node-mssql) */
export const affected = (result: unknown): number => (result as { rowsAffected?: number[] })?.rowsAffected?.[0] ?? 0;

/** Lỗi trùng khóa unique: 2601 (unique index), 2627 (unique constraint) */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { number?: number; cause?: { number?: number } };
  const n = e?.cause?.number ?? e?.number;
  return n === 2601 || n === 2627;
}

/**
 * Thay SELECT ... FOR UPDATE: lệnh sửa giả (gán cột bằng chính nó) giữ khóa ghi các dòng tới hết giao dịch,
 * giao dịch khác muốn ghi cùng dòng phải chờ. Gọi đầu giao dịch rồi mới đọc. Bảng versions có trigger UPDATE
 * nhưng chỉ chặn khi đổi content hoặc status nên không bị ảnh hưởng.
 */
export async function lockRows<T extends MsSqlTable>(tx: DbLike, table: T, column: keyof InferInsertModel<T> & string, where: SQL | undefined): Promise<void> {
  const col = (table as unknown as Record<string, unknown>)[column];
  await (tx as any).update(table).set({ [column]: sql`${col}` }).where(where);
}

/** Thay ON CONFLICT DO NOTHING: thêm, trùng khóa unique thì bỏ qua. Trả về kết quả lệnh thêm, hoặc null nếu trùng */
export async function insertIgnore<R>(insert: () => Promise<R>): Promise<R | null> {
  try {
    return await insert();
  } catch (err) {
    if (isUniqueViolation(err)) return null;
    throw err;
  }
}

/**
 * Thay ON CONFLICT DO UPDATE: sửa theo khóa trước, không có dòng nào thì thêm. Hai người cùng thêm một lúc thì
 * người sau gặp lỗi trùng khóa và sửa lại (lỗi trùng khóa chỉ hủy câu lệnh, không hủy giao dịch).
 */
export async function upsert(update: () => Promise<unknown>, insert: () => Promise<unknown>): Promise<void> {
  if (affected(await update())) return;
  try {
    await insert();
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    await update();
  }
}

/** SQL Server nhận tối đa 2100 tham số mỗi câu lệnh; để dư cho tham số khác */
const MAX_PARAMS = 2000;

function chunks<V>(rows: V[]): V[][] {
  const cols = Math.max(1, ...rows.map((r) => Object.keys(r as object).length));
  const size = Math.max(1, Math.floor(MAX_PARAMS / cols));
  const out: V[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/** Thêm nhiều dòng, chia lô để không vượt giới hạn tham số */
export async function insertChunked<T extends MsSqlTable>(db: DbLike, table: T, rows: InferInsertModel<T>[]): Promise<void> {
  for (const part of chunks(rows)) await (db as any).insert(table).values(part);
}

/** Như insertChunked nhưng trả về các dòng vừa thêm (OUTPUT); không dùng cho bảng có trigger */
export async function insertChunkedOutput<T extends MsSqlTable>(db: DbLike, table: T, rows: InferInsertModel<T>[]): Promise<InferSelectModel<T>[]> {
  const out: InferSelectModel<T>[] = [];
  for (const part of chunks(rows)) out.push(...((await (db as any).insert(table).output().values(part)) as InferSelectModel<T>[]));
  return out;
}
