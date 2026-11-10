import { env } from '../../config';
import { createDb, runMigrations } from '../client';

async function main() {
  const { db, close } = createDb(env().DATABASE_URL);
  try {
    await runMigrations(db);
    console.log('Đã chạy migration.');
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error('Chạy migration thất bại:', err.message ?? err);
  process.exit(1);
});
