import path from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from './schema';

// Kiểu date (OID 1082) trả về nguyên chuỗi YYYY-MM-DD, không đổi sang Date theo múi giờ máy
pg.types.setTypeParser(1082, (v) => v);

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbLike = Db | Tx;

export function createDb(url: string): { pool: pg.Pool; db: Db } {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  return { pool, db: drizzle(pool, { schema }) };
}

/** Thư mục migration nằm cạnh file này ở cả src (tsx) lẫn dist (nest build sao chép sang) */
export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') });
}

/** Xóa sạch dữ liệu: bỏ schema public và bảng theo dõi migration */
export async function dropAll(db: Db): Promise<void> {
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
}
