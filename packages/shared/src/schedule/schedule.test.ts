import { describe, expect, it } from 'vitest';
import { addDays, diffDays, fmtDate, isIsoDate, todayIn } from '../dates';
import type { Level } from '../schemas/version';
import { currentStageIndex, dayIndex, planRunTasks, plannedEnd, stageWindow } from './run';
import { computeTaskState } from './state';

// Cấu hình L1 theo N3 như giả định ở mục 20.1: giai đoạn 1 [0, 7], 4 [21, 30], 6 [45, 60]
const stage = (n: number, a: number, b: number, items: { key: string; d: number }[] = []) => ({
  key: `L1-S${n}`,
  order: n,
  name: `Giai đoạn ${n}`,
  label: `GĐ ${n}`,
  offsetStart: a,
  offsetEnd: b,
  goal: '',
  signers: ['cht' as const],
  items: items.map((it, i) => ({
    key: it.key,
    order: i + 1,
    category: 'Hành chính',
    content: it.key,
    guidance: '',
    verifiers: ['buddy' as const],
    requireNvFirst: true,
    dueOffset: it.d,
    gpp: false,
    required: true,
    allowNa: true,
    dataSource: 'manual' as const,
    evidence: 'none' as const,
    dependsOn: [],
  })),
});

const L1 = {
  key: 1,
  totalDays: 60,
  stages: [
    stage(1, 0, 7, [{ key: 'L1-1-1', d: 1 }, { key: 'L1-1-2', d: 7 }]),
    stage(2, 7, 14),
    stage(3, 14, 21),
    stage(4, 21, 30, [{ key: 'L1-4-1', d: 25 }]),
    stage(5, 30, 45),
    stage(6, 45, 60),
  ],
} as unknown as Level;

describe('ngày nghiệp vụ', () => {
  it('cộng trừ ngày qua tháng, năm và năm nhuận', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(diffDays('2026-10-17', '2026-09-21')).toBe(26);
  });

  it('"hôm nay" theo múi giờ Asia/Ho_Chi_Minh, không theo UTC', () => {
    // 18:00 UTC ngày 16/10 là 01:00 sáng 17/10 giờ Việt Nam
    expect(todayIn('Asia/Ho_Chi_Minh', new Date('2026-10-16T18:00:00Z'))).toBe('2026-10-17');
  });

  it('kiểm tra và định dạng ngày', () => {
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-10-17')).toBe(true);
    expect(fmtDate('2026-10-09', 2026)).toBe('09/10');
    expect(fmtDate('2027-01-02', 2026)).toBe('02/01/2027');
  });
});

describe('bộ tính lịch (mục 20.1)', () => {
  it('T-L01: NV bắt đầu L1 ngày 08/10/2026, đầu việc d = 1 có hạn 09/10/2026', () => {
    const tasks = planRunTasks(L1, '2026-10-08');
    expect(tasks.find((t) => t.itemKey === 'L1-1-1')?.dueDate).toBe('2026-10-09');
  });

  it('T-L02: giai đoạn 1 hiển thị 08/10 → 15/10', () => {
    expect(stageWindow(L1.stages[0], '2026-10-08')).toEqual({ from: '2026-10-08', to: '2026-10-15' });
  });

  it('đầu việc mở cùng ngày mở giai đoạn', () => {
    const tasks = planRunTasks(L1, '2026-10-08');
    expect(tasks.find((t) => t.itemKey === 'L1-4-1')).toMatchObject({ openDate: '2026-10-29', dueDate: '2026-11-02' });
  });

  it('T-L03: bắt đầu 21/09, hôm nay 17/10 → ngày thứ 27/60, đang ở giai đoạn 4 (ngày 21–30)', () => {
    expect(dayIndex('2026-09-21', '2026-10-17') + 1).toBe(27);
    expect(currentStageIndex(L1, '2026-09-21', '2026-10-17')).toBe(3);
  });

  it('T-L04: bắt đầu 19/10, hôm nay 17/10 → chưa bắt đầu, còn 2 ngày', () => {
    expect(dayIndex('2026-10-19', '2026-10-17')).toBe(-2);
    expect(currentStageIndex(L1, '2026-10-19', '2026-10-17')).toBe(-1);
  });

  it('hai NV vào cách nhau 3 ngày có lịch lệch nhau đúng 3 ngày', () => {
    const a = planRunTasks(L1, '2026-10-08');
    const b = planRunTasks(L1, '2026-10-11');
    a.forEach((t, i) => expect(diffDays(b[i].dueDate, t.dueDate)).toBe(3));
  });

  it('qua hết thời gian Level vẫn ở giai đoạn cuối; kết thúc dự kiến = S + số ngày Level', () => {
    expect(currentStageIndex(L1, '2026-08-01', '2026-10-17')).toBe(5);
    expect(plannedEnd(L1, '2026-10-08')).toBe('2026-12-07');
  });
});

describe('trạng thái đầu việc (mục 10.3)', () => {
  const params = { remindDays: 3 };
  const base = { status: 'todo' as const, openDate: '2026-10-01', dueDate: '2026-10-20' };

  it('T-L07: hôm nay = hạn − 3 → "Còn 3 ngày", màu cảnh báo', () => {
    expect(computeTaskState(base, '2026-10-17', params)).toMatchObject({ code: 'due_soon', label: 'Còn 3 ngày', tone: 'warn' });
  });

  it('hạn hôm nay, quá hạn, còn xa', () => {
    expect(computeTaskState(base, '2026-10-20', params).label).toBe('Hạn hôm nay');
    expect(computeTaskState(base, '2026-10-28', params)).toMatchObject({ code: 'overdue', label: 'Trễ 8 ngày', overdueDays: 8 });
    expect(computeTaskState(base, '2026-10-05', params)).toMatchObject({ code: 'scheduled', label: 'Hạn 20/10' });
  });

  it('chưa tới ngày mở → "Sắp mở"', () => {
    expect(computeTaskState({ ...base, openDate: '2026-10-19' }, '2026-10-17', params)).toMatchObject({
      code: 'upcoming',
      label: 'Sắp mở (19/10)',
    });
  });

  it('thứ tự ưu tiên: xong > N/A > sắp mở > chờ phụ thuộc > làm lại > cần hỗ trợ > trễ', () => {
    const today = '2026-10-25';
    expect(computeTaskState({ ...base, status: 'done', doneDate: '2026-10-21' }, today, params).label).toBe('Xong 21/10');
    expect(computeTaskState({ ...base, status: 'na' }, today, params).code).toBe('na');
    expect(computeTaskState({ ...base, blockedBy: ['L1-2-9'], reworkPending: true }, today, params).label).toBe('Chờ L1-2-9');
    const rework = computeTaskState({ ...base, status: 'help', reworkPending: true }, today, params);
    expect(rework).toMatchObject({ code: 'rework', overdueDays: 5 });
    expect(computeTaskState({ ...base, status: 'help' }, today, params).code).toBe('help');
  });

  it('T-L06: đầu việc nguồn POS chờ số liệu tới ngày chốt', () => {
    const pos = { ...base, dueDate: '2026-11-07', posDataDate: '2026-12-05' };
    expect(computeTaskState(pos, '2026-11-20', params).code).toBe('pos_wait');
    expect(computeTaskState(pos, '2026-12-05', params).code).toBe('overdue');
  });
});
