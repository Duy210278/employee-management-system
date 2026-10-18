import { env } from '../../config';
import { createDb, runMigrations } from '../client';

async function main() {
  const { pool, db } = createDb(env().DATABASE_URL);
  try {
    await runMigrations(db);
    console.log('Đã chạy migration.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Chạy migration thất bại:', err.message ?? err);
  process.exit(1);
});
