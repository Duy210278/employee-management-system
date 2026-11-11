import path from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle, type NodeMsSqlDatabase } from 'drizzle-orm/node-mssql';
import { migrate } from 'drizzle-orm/node-mssql/migrator';
import { env } from '../config';

/**
 * Kết nối SQL Server qua Drizzle (node-mssql). Chuỗi kết nối dạng
 * "Server=localhost,1433;Database=lotrinh;User Id=...;Password=...;Encrypt=true;TrustServerCertificate=true".
 * Cột DATE đọc về chuỗi YYYY-MM-DD nhờ mode 'string' khai báo trong schema.
 */
export type Db = NodeMsSqlDatabase;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbLike = Db | Tx;

export function createDb(url: string): { db: Db; close: () => Promise<void> } {
  const db = drizzle(url);
  return {
    db,
    close: async () => {
      await (await db.$client.$instance()).close();
    },
  };
}

/** Thư mục migration nằm cạnh file này ở cả src (tsx) lẫn dist (nest build sao chép sang) */
export async function runMigrations(db: Db): Promise<void> {
  // Bảng lịch sử migration nằm trong schema lotrinh để không dùng chung bảng mặc định drizzle.__drizzle_migrations
  // với dự án khác trên cùng CSDL
  await migrate(db, { migrationsFolder: path.join(__dirname, 'migrations'), migrationsSchema: 'lotrinh', migrationsTable: '__migrations' });
}

/** Chỉ được xóa sạch CSDL tên *_test, hoặc khi bật ALLOW_RESET (máy dev) */
export const canReset = (dbName: string, allowReset: boolean): boolean => allowReset || dbName.endsWith('_test');

/** Tên CSDL đang kết nối */
export async function databaseName(db: Db): Promise<string> {
  const res = (await db.execute(sql`SELECT DB_NAME() AS name`)) as unknown as { recordset: { name: string }[] };
  return res.recordset[0]?.name ?? '';
}

/**
 * Xóa sạch dữ liệu: bỏ khóa ngoại, mọi bảng trong schema lotrinh (gồm bảng lịch sử migration).
 * Chốt chặn: chỉ chạy trên CSDL tên *_test, hoặc khi bật ALLOW_RESET (máy dev), để không lỡ xóa CSDL thật.
 */
export async function dropAll(db: Db): Promise<void> {
  const name = await databaseName(db);
  if (!canReset(name, env().ALLOW_RESET)) {
    throw new Error(`Từ chối xóa sạch CSDL "${name}": chỉ xóa được CSDL tên *_test, hoặc đặt ALLOW_RESET=true trên máy dev`);
  }
  await db.execute(
    sql.raw(`
      DECLARE @s NVARCHAR(MAX) = N'';
      SELECT @s += N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id))
                 + N' DROP CONSTRAINT ' + QUOTENAME(name) + N';'
      FROM sys.foreign_keys WHERE SCHEMA_NAME(schema_id) = N'lotrinh';
      EXEC sp_executesql @s;
      SET @s = N'';
      SELECT @s += N'DROP TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N';'
      FROM sys.tables WHERE SCHEMA_NAME(schema_id) = N'lotrinh';
      EXEC sp_executesql @s;
      IF SCHEMA_ID(N'lotrinh') IS NOT NULL EXEC(N'DROP SCHEMA lotrinh');
    `),
  );
}
