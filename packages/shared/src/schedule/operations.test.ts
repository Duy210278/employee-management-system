import { describe, expect, it } from 'vitest';
import { computeAlerts, countAlerts, type AlertInput } from '../alerts/rules';
import { stageSignState } from '../rules/stage-sign';
import { activePause, currentStageIndex, dayIndex, shiftByPauses, stageWindow } from './run';

describe('tạm dừng lượt Level (mục 9.3, 10.2, T-L05)', () => {
  const pause = { from: '2026-11-01', to: '2026-11-10' };

  it('mọi mốc từ ngày bắt đầu tạm dừng lùi đúng số ngày nghỉ (10 ngày)', () => {
    expect(shiftByPauses('2026-10-31', [pause])).toBe('2026-10-31');
    expect(shiftByPauses('2026-11-01', [pause])).toBe('2026-11-11');
    expect(shiftByPauses('2026-11-20', [pause])).toBe('2026-11-30');
  });

  it('nhiều lần tạm dừng: mốc đã lùi rơi vào lần sau thì lùi tiếp', () => {
    const second = { from: '2026-11-25', to: '2026-11-26' };
    expect(shiftByPauses('2026-11-20', [second, pause])).toBe('2026-12-02');
  });

  it('ngày thứ N không tính ngày tạm dừng; trong lúc dừng số ngày đứng yên', () => {
    const start = '2026-10-08';
    expect(dayIndex(start, '2026-10-31', [pause])).toBe(23);
    expect(dayIndex(start, '2026-11-01', [pause])).toBe(24);
    expect(dayIndex(start, '2026-11-05', [pause])).toBe(24);
    expect(dayIndex(start, '2026-11-11', [pause])).toBe(24);
    expect(dayIndex(start, '2026-11-12', [pause])).toBe(25);
    expect(activePause('2026-11-05', [pause])).toEqual(pause);
    expect(activePause('2026-11-11', [pause])).toBeNull();
  });

  it('khoảng ngày giai đoạn và giai đoạn hiện tại khớp với mốc đã lùi', () => {
    const start = '2026-10-08';
    const stages = [
      { offsetStart: 0, offsetEnd: 21 },
      { offsetStart: 21, offsetEnd: 30 },
      { offsetStart: 30, offsetEnd: 45 },
    ];
    // Giai đoạn 2 [21, 30] = 29/10 → 07/11, phần sau 01/11 lùi 10 ngày
    expect(stageWindow(stages[1], start, [pause])).toEqual({ from: '2026-10-29', to: '2026-11-17' });
    expect(currentStageIndex({ stages } as never, start, '2026-11-16', [pause])).toBe(1);
    expect(currentStageIndex({ stages } as never, start, '2026-11-17', [pause])).toBe(2);
  });
});

describe('ký cuối giai đoạn (mục 10.2, R11, T-X09)', () => {
  const base = { signers: ['cht'] as const, signedSteps: [], window: { from: '2026-10-08', to: '2026-10-15' }, params: { signOpenBefore: 3, signDueAfter: 3 } };

  it('chưa tới cửa sổ ký thì chưa ký được', () => {
    const s = stageSignState({ ...base, requiredLeft: 0 }, '2026-10-11');
    expect(s).toMatchObject({ opensOn: '2026-10-12', dueOn: '2026-10-18', isOpen: false, ready: false, next: 0 });
    expect(s.blocked).toBe('Mở ký từ 12/10/2026');
  });

  it('T-X09: còn mục bắt buộc chưa xong thì không ký được', () => {
    const s = stageSignState({ ...base, requiredLeft: 2 }, '2026-10-13');
    expect(s.ready).toBe(false);
    expect(s.blocked).toBe('Còn 2 mục bắt buộc chưa xong');
  });

  it('đủ điều kiện thì ký được; quá hạn ký thì báo trễ; ký đủ thì hoàn tất', () => {
    expect(stageSignState({ ...base, requiredLeft: 0 }, '2026-10-13').ready).toBe(true);
    expect(stageSignState({ ...base, requiredLeft: 0 }, '2026-10-19').overdue).toBe(true);
    expect(stageSignState({ ...base, signedSteps: [0], requiredLeft: 0 }, '2026-10-19')).toMatchObject({ complete: true, overdue: false, ready: false, next: null });
  });
});

describe('quy tắc cảnh báo (mục 11.6)', () => {
  const base: AlertInput = {
    today: '2026-10-19',
    levelKey: 1,
    dayIndex: 26,
    open: true,
    plannedEnd: '2026-11-22',
    hasBuddy: true,
    hasCht: true,
    overdue: [],
    escalateDays: 7,
    sales: [],
    salesReference: 30,
    rubric: { count: 0, rate: null, meetsTarget: null, target: 80 },
    safetyErrors: 0,
    hasAccount: true,
    lastSeen: '2026-10-18',
    lateStageSigns: 0,
  };

  it('không có gì bất thường thì không có cảnh báo', () => {
    expect(computeAlerts(base)).toEqual([]);
  });

  it('mục trễ hạn: vàng; trễ hơn escalateDays: đỏ (T-L08), không báo trùng', () => {
    expect(computeAlerts({ ...base, overdue: [{ gpp: false, days: 2 }] }).map((a) => [a.key, a.severity])).toEqual([['overdue', 'yellow']]);
    const late = computeAlerts({ ...base, overdue: [{ gpp: false, days: 2 }, { gpp: false, days: 9 }] });
    expect(late.map((a) => a.key)).toEqual(['overdue_escalate']);
    expect(late[0].message).toBe('1 mục trễ hạn hơn 7 ngày (trễ nhất 9 ngày)');
  });

  it('GPP quá hạn, chưa có Buddy sau 48 giờ, lỗi an toàn thuốc là đỏ', () => {
    const a = computeAlerts({ ...base, overdue: [{ gpp: true, days: 1 }], hasBuddy: false, safetyErrors: 1 });
    expect(countAlerts(a)).toEqual({ red: 3, yellow: 1 });
    expect(computeAlerts({ ...base, hasBuddy: false, dayIndex: 1 }).some((x) => x.key === 'no_buddy')).toBe(false);
    expect(computeAlerts({ ...base, levelKey: 3, hasBuddy: false }).some((x) => x.key === 'no_buddy')).toBe(false);
  });

  it('DS tổng dưới 80% mức tham khảo 2 tháng liên tiếp', () => {
    const one = computeAlerts({ ...base, sales: [{ month: 1, total: 20 }, { month: 2, total: 28 }] });
    expect(one.some((x) => x.key === 'sales_low')).toBe(false);
    const two = computeAlerts({ ...base, sales: [{ month: 1, total: 20 }, { month: 2, total: 23 }] });
    expect(two.find((x) => x.key === 'sales_low')?.message).toBe('DS tổng tháng 1, 2 dưới 80% mức tham khảo 30 triệu');
  });

  it('NV Level 1 không đăng nhập quá 5 ngày; quá thời gian Level 14 ngày', () => {
    expect(computeAlerts({ ...base, lastSeen: '2026-10-12' }).find((x) => x.key === 'inactive')?.message).toBe('Không đăng nhập 7 ngày');
    expect(computeAlerts({ ...base, lastSeen: '2026-10-14' }).some((x) => x.key === 'inactive')).toBe(false);
    expect(computeAlerts({ ...base, plannedEnd: '2026-10-01' }).find((x) => x.key === 'level_overrun')?.message).toBe('Quá thời gian Level 18 ngày chưa có quyết định');
  });

  it('Rubric dưới mục tiêu khi đủ số ca', () => {
    expect(computeAlerts({ ...base, rubric: { count: 4, rate: 50, meetsTarget: false, target: 80 } })[0].key).toBe('rubric_low');
    expect(computeAlerts({ ...base, rubric: { count: 2, rate: 50, meetsTarget: null, target: 80 } })).toEqual([]);
  });
});
