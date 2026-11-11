import { describe, expect, it } from 'vitest';
import { canReset, createDb, dropAll, runMigrations } from '../src/db/client';
import { seedMinimal } from '../src/db/seed';
import { staff, users, versions } from '../src/db/schema';

describe('an toàn CSDL', () => {
  it('chốt chặn xóa sạch: chỉ CSDL *_test, hoặc khi bật ALLOW_RESET', () => {
    expect(canReset('lotrinh_test', false)).toBe(true);
    expect(canReset('lotrinh', false)).toBe(false);
    expect(canReset('HeThongLon', false)).toBe(false);
    expect(canReset('lotrinh', true)).toBe(true);
  });

  it('nạp tối thiểu: chỉ phiên bản v2.1 và tài khoản BP, chạy lại không làm gì', async () => {
    const { db, close } = createDb(process.env.DATABASE_URL!);
    try {
      await dropAll(db);
      await runMigrations(db);
      const first = await seedMinimal(db, { effectiveFrom: '2025-01-01', bp: { employeeCode: 'BP001', fullName: 'Ngô Quốc Bảo', email: 'bp@x.local' } });
      expect(first.created).toBe(true);
      expect((await seedMinimal(db, { effectiveFrom: '2025-01-01' })).created).toBe(false);
      const [v] = await db.select().from(versions);
      expect(v).toMatchObject({ code: '2.1', status: 'active', approvedBy: first.bpId });
      expect(v!.content.levels).toHaveLength(4);
      expect(v!.content.chtTracks).toHaveLength(2);
      expect(await db.select().from(users)).toMatchObject([{ role: 'bp', employeeCode: 'BP001' }]);
      expect(await db.select().from(staff)).toHaveLength(0);
    } finally {
      await close();
    }
  });
});
