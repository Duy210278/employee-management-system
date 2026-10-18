import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { levelItems, VersionContentSchema } from './version';

// seed/v2.1.json trích từ N3 bằng seed/extract-n3.mjs
const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../seed/v2.1.json'), 'utf8'));

describe('dữ liệu khởi tạo v2.1 (mục 22.4)', () => {
  const content = VersionContentSchema.parse(raw);

  it('hợp lệ theo schema và đúng thống kê: 4 Level, 15 giai đoạn, 138 đầu việc', () => {
    expect(content.levels.map((l) => [l.totalDays, l.stages.length, levelItems(l).length])).toEqual([
      [60, 6, 60],
      [274, 3, 31],
      [365, 3, 24],
      [365, 3, 23],
    ]);
  });

  it('CK-02, CK-04, CK-05: giai đoạn nối liền, không vượt thời gian Level, hạn nằm trong giai đoạn', () => {
    for (const level of content.levels) {
      level.stages.forEach((s, i) => {
        expect(s.offsetEnd).toBeGreaterThan(s.offsetStart);
        if (i > 0) expect(s.offsetStart).toBe(level.stages[i - 1].offsetEnd);
        for (const item of s.items) {
          expect(item.dueOffset).toBeGreaterThanOrEqual(s.offsetStart);
          expect(item.dueOffset).toBeLessThanOrEqual(s.offsetEnd);
        }
      });
      expect(level.stages.at(-1)!.offsetEnd).toBeLessThanOrEqual(level.totalDays);
    }
  });

  it('CK-07: mục GPP bắt buộc và không được N/A', () => {
    const gpp = content.levels.flatMap((l) => levelItems(l)).filter(({ item }) => item.gpp);
    expect(gpp.length).toBeGreaterThan(0);
    for (const { item } of gpp) expect(item).toMatchObject({ required: true, allowNa: false });
  });

  it('đã áp dụng giả định V1, V12 của mục 16', () => {
    const find = (key: string) => content.levels.flatMap((l) => levelItems(l)).find(({ item }) => item.key === key)!.item;
    expect(find('L1-6-3').content).not.toContain('Tháng 3');
    expect(find('L4-1-7').content).toContain('SKU Level 4');
  });
});
