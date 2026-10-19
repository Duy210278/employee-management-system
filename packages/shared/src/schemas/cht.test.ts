import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeAlerts, type AlertInput } from '../alerts/rules';
import { classifyChanges } from '../change-kind/classify';
import { DEFAULT_CHT_TRACKS } from '../defaults/cht-tracks';
import { isAssignee } from '../rules/assignee';
import { planRunTasks } from '../schedule/run';
import { validateChecklist } from '../validation/checklist';
import { levelForTrack, levelItems, VersionContentSchema, type VersionContent } from './version';

const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../seed/v2.1.json'), 'utf8'));
const withCht = (): VersionContent => VersionContentSchema.parse({ ...raw, chtTracks: structuredClone(DEFAULT_CHT_TRACKS) });

describe('checklist onboarding CHT (docs/nguon/Onboarding_CHT_*.xlsx)', () => {
  it('mẫu trích từ Excel hợp lệ: mới tuyển 26 việc, thăng tiến 25 việc, đều 5 ngày D → D+4', () => {
    const content = withCht();
    expect(content.chtTracks!.map((t) => [t.key, t.code, t.totalDays, t.stages.length, t.stages.reduce((a, s) => a + s.items.length, 0)])).toEqual([
      ['cht_moi_tuyen', 'CM', 5, 5, 26],
      ['cht_thang_tien', 'CT', 5, 5, 25],
    ]);
    expect(content.chtTracks![1].ratings.map((r) => r.key)).toEqual(['van_hanh', 'tinh_huong', 'doi_nhom', 'chuyen_doi_tu_duy', 'dong_nghiep_cu']);
    expect(validateChecklist(content).filter((i) => i.at.trackKey && i.level === 'error')).toEqual([]);
  });

  it('check-in cuối ngày là việc của Đào tạo (CHT không cần báo trước); việc QLKV hỗ trợ do QLKV xác nhận', () => {
    const t = withCht().chtTracks![0];
    const items = t.stages.flatMap((s) => s.items);
    const checkin = items.find((i) => i.key === 'CM-1-6')!;
    expect(checkin).toMatchObject({ category: 'Check-in', session: 'cuoi_ngay', requireNvFirst: false, verifiers: ['bp'] });
    expect(items.find((i) => i.key === 'CM-1-3')).toMatchObject({ supporter: 'QLKV / CHT bàn giao', verifiers: ['qlkv'], requireNvFirst: true });
  });

  it('lượt CHT chạy như một Level: mỗi ngày một giai đoạn, việc mở và đến hạn đúng ngày của nó', () => {
    const level = levelForTrack(withCht(), 'cht_moi_tuyen', 1);
    expect(level).toMatchObject({ key: 1, totalDays: 5, name: 'CHT mới tuyển' });
    const plan = planRunTasks(level, '2026-10-20');
    expect(plan).toHaveLength(26);
    expect(plan.find((p) => p.itemKey === 'CM-3-2')).toMatchObject({ openDate: '2026-10-22', dueDate: '2026-10-22' });
    expect(levelItems(level)).toHaveLength(26);
    expect(() => levelForTrack(VersionContentSchema.parse(raw), 'cht_moi_tuyen', 1)).toThrow('Phiên bản không có checklist CHT mới tuyển');
  });

  it('kiểm tra hợp lệ: sai tiền tố mã, thiếu tiêu chí tổng kết, link sai dạng', () => {
    const content = withCht();
    const t = content.chtTracks![0];
    t.stages[0].items[0].key = 'L1-1-1';
    t.stages[0].items[1].link = 'drive.google.com/abc';
    t.ratings = [];
    const issues = validateChecklist(content).filter((i) => i.at.trackKey === 'cht_moi_tuyen');
    expect(issues.map((i) => i.code).sort()).toEqual(['CK-06', 'CK-06', 'CK-16', 'CK-17']);
    // Sai dạng, và trùng mã đầu việc L1-1-1 của lộ trình NVBH
    expect(issues.filter((i) => i.code === 'CK-06').map((i) => i.message)).toEqual(['Mã "L1-1-1" không đúng dạng CM-<ngày>-<thứ tự>', 'Mã đầu việc L1-1-1 bị trùng']);
  });

  it('phân loại thay đổi: sửa người hỗ trợ là diễn đạt; đổi người xác nhận, thêm checklist CHT là tiêu chí', () => {
    const base = withCht();
    const textOnly = structuredClone(base);
    textOnly.chtTracks![0].stages[0].items[0].supporter = 'HR';
    expect(classifyChanges(base, textOnly)).toMatchObject({ kind: 'text', text: 1 });

    const crit = structuredClone(base);
    crit.chtTracks![0].stages[0].items[0].verifiers = ['bp', 'qlkv'];
    expect(classifyChanges(base, crit).changes.map((c) => c.label)).toEqual(['CM-1-1: đổi người xác nhận']);

    const noCht = VersionContentSchema.parse(raw);
    expect(classifyChanges(noCht, base).changes.map((c) => c.label)).toEqual(['Thêm checklist CHT mới tuyển', 'Thêm checklist CHT thăng tiến từ NVBH']);
  });

  it('việc của BP ĐT trên lượt CHT về đúng người phụ trách Đào tạo; lượt không có người phụ trách thì mọi BP ĐT', () => {
    const people = { staffUserId: 9, buddyId: null, chtId: null, qlkvId: 2, trainerId: 1, acknowledged: true };
    expect(isAssignee({ userId: 1, role: 'bp' }, 'bp', people)).toBe(true);
    expect(isAssignee({ userId: 5, role: 'bp' }, 'bp', people)).toBe(false);
    expect(isAssignee({ userId: 5, role: 'bp' }, 'bp', { ...people, trainerId: null })).toBe(true);
  });

  it('cảnh báo lượt CHT: không đòi CHT, Buddy; nguy cơ nghỉ việc cao là đỏ', () => {
    const base: AlertInput = {
      today: '2026-10-22',
      levelKey: 1,
      dayIndex: 2,
      open: true,
      plannedEnd: '2026-10-25',
      hasBuddy: false,
      hasCht: false,
      overdue: [],
      escalateDays: 7,
      sales: [],
      salesReference: 0,
      rubric: { count: 0, rate: null, meetsTarget: null, target: 80 },
      safetyErrors: 0,
      hasAccount: true,
      lastSeen: '2026-10-21',
      lateStageSigns: 0,
      track: 'cht_moi_tuyen',
    };
    expect(computeAlerts(base)).toEqual([]);
    expect(computeAlerts({ ...base, attritionRisk: 'high' }).map((a) => [a.key, a.severity])).toEqual([['attrition_high', 'red']]);
    expect(computeAlerts({ ...base, track: 'nvbh' }).map((a) => a.key)).toEqual(['no_buddy', 'no_cht']);
  });
});
