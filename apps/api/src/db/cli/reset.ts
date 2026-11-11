import { todayIn } from '@lotrinh/shared';
import { env } from '../../config';
import { createDb } from '../client';
import { resetDatabase } from '../seed';

async function main() {
  const { db, close } = createDb(env().DATABASE_URL);
  try {
    const today = todayIn(env().TZ);
    await resetDatabase(db, today);
    console.log(`Đã xóa sạch và nạp lại dữ liệu mẫu (mốc ngày ${today}).`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error('Khôi phục dữ liệu mẫu thất bại:', err.message ?? err);
  process.exit(1);
});
