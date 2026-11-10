import path from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle, type NodeMsSqlDatabase } from 'drizzle-orm/node-mssql';
import { migrate } from 'drizzle-orm/node-mssql/migrator';

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
  await migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') });
}

/** Xóa sạch dữ liệu: bỏ khóa ngoại, mọi bảng trong schema lotrinh và bảng theo dõi migration */
export async function dropAll(db: Db): Promise<void> {
  await db.execute(
    sql.raw(`
      DECLARE @s NVARCHAR(MAX) = N'';
      SELECT @s += N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id))
                 + N' DROP CONSTRAINT ' + QUOTENAME(name) + N';'
      FROM sys.foreign_keys WHERE SCHEMA_NAME(schema_id) = N'lotrinh';
      EXEC sp_executesql @s;
      SET @s = N'';
      SELECT @s += N'DROP TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N';'
      FROM sys.tables WHERE SCHEMA_NAME(schema_id) IN (N'lotrinh', N'drizzle');
      EXEC sp_executesql @s;
      IF SCHEMA_ID(N'lotrinh') IS NOT NULL EXEC(N'DROP SCHEMA lotrinh');
      IF SCHEMA_ID(N'drizzle') IS NOT NULL EXEC(N'DROP SCHEMA drizzle');
    `),
  );
}
