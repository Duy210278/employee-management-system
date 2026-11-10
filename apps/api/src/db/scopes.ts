import { eq } from 'drizzle-orm';
import type { DbLike, Tx } from './client';
import { areas, stores, userScopes } from './schema';

/**
 * Phạm vi dữ liệu của tài khoản nằm chung bảng user_scopes: dòng có store_id là cửa hàng (CHT),
 * dòng có area_id là khu vực (QLKV). Hai truy vấn dưới nối sang cửa hàng, khu vực nên chỉ lấy đúng loại
 * và id luôn có giá trị. Gọi thêm .where(...) để lọc theo tài khoản.
 */
export const storeScopeRows = (db: DbLike) =>
  db.select({ userId: userScopes.userId, storeId: stores.id }).from(userScopes).innerJoin(stores, eq(stores.id, userScopes.storeId));

export const areaScopeRows = (db: DbLike) =>
  db.select({ userId: userScopes.userId, areaId: areas.id }).from(userScopes).innerJoin(areas, eq(areas.id, userScopes.areaId));

/** Thay toàn bộ phạm vi của một tài khoản */
export async function replaceScopes(tx: Tx, userId: number, storeIds: number[], areaIds: number[]): Promise<void> {
  await tx.delete(userScopes).where(eq(userScopes.userId, userId));
  const rows = [...storeIds.map((storeId) => ({ userId, storeId })), ...areaIds.map((areaId) => ({ userId, areaId }))];
  if (rows.length) await tx.insert(userScopes).values(rows);
}
