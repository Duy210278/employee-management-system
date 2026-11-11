import { isIsoDate } from '@lotrinh/shared';
import { env } from '../../config';
import { createDb, runMigrations } from '../client';
import { seedMinimal } from '../seed';

/**
 * Nạp tối thiểu cho CSDL thật (không có nhân viên mẫu): pnpm db:seed:minimal
 * Biến môi trường tùy chọn: SEED_EFFECTIVE_FROM (mặc định 2025-01-01, ngày hiệu lực v2.1),
 * SEED_BP_CODE, SEED_BP_NAME, SEED_BP_EMAIL (tài khoản BP Đào tạo ban đầu để liên kết khi SSO).
 */
async function main() {
  const effectiveFrom = process.env.SEED_EFFECTIVE_FROM || '2025-01-01';
  if (!isIsoDate(effectiveFrom)) throw new Error('SEED_EFFECTIVE_FROM phải có dạng YYYY-MM-DD');
  const code = process.env.SEED_BP_CODE;
  const bp = code
    ? { employeeCode: code, fullName: process.env.SEED_BP_NAME || code, email: process.env.SEED_BP_EMAIL || `${code.toLowerCase()}@lotrinh.local` }
    : undefined;
  const { db, close } = createDb(env().DATABASE_URL);
  try {
    await runMigrations(db);
    const res = await seedMinimal(db, { effectiveFrom, bp });
    console.log(res.created ? `Đã nạp phiên bản v2.1 (hiệu lực từ ${effectiveFrom})${res.bpId ? `, tài khoản BP id ${res.bpId}` : ''}.` : 'Đã có phiên bản, bỏ qua.');
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error('Nạp tối thiểu thất bại:', err.message ?? err);
  process.exit(1);
});
