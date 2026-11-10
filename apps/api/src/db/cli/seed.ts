import { todayIn } from '@lotrinh/shared';
import { env } from '../../config';
import { createDb } from '../client';
import { isDatabaseEmpty, seedDatabase } from '../seed';

async function main() {
  const { db, close } = createDb(env().DATABASE_URL);
  try {
    if (!(await isDatabaseEmpty(db))) {
      console.log('Cơ sở dữ liệu đã có dữ liệu, bỏ qua. Dùng "pnpm db:reset" để xóa sạch và nạp lại dữ liệu mẫu.');
      return;
    }
    const today = todayIn(env().TZ);
    await seedDatabase(db, today);
    console.log(`Đã nạp dữ liệu mẫu (mốc ngày ${today}). Mật khẩu chung: Demo@123`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error('Nạp dữ liệu mẫu thất bại:', err.message ?? err);
  process.exit(1);
});
