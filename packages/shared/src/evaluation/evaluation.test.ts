import { describe, expect, it } from 'vitest';
import type { Actor, RunPeople } from '../rules/confirm';
import type { Level } from '../schemas/version';
import { evaluateKpi, kpiRule, levelMonthOf } from './kpi';
import { canSignAs, countPoints, nextSignStep, outcomeStep, reviewFormOf, reviewProblems, type ReviewDraft } from './review';
import { DEFAULT_RUBRIC, evaluateRubric, scoreObservation } from './rubric';

const L1 = { key: 1, months: 2, kpi: { total: 30, coef1: 12, ratio: 40 } } as Level;
const L2 = { key: 2, months: 9, kpi: { total: 100, coef1: 30, ratio: 30 } } as Level;

describe('doanh số (R15)', () => {
  it('cửa sổ mặc định: L1 mọi tháng 1–2; L2 trung bình 2 tháng cuối (tháng 8–9)', () => {
    expect(kpiRule(L1)).toMatchObject({ method: 'all_months', windowFrom: 1, windowTo: 2 });
    expect(kpiRule(L2)).toMatchObject({ method: 'average', windowFrom: 8, windowTo: 9 });
  });

  it('L1: 2/2 tháng đạt → đạt; 1/2 → chưa đạt; thiếu tháng → chưa đủ số liệu', () => {
    expect(evaluateKpi(L1, [{ month: 1, total: 32, coef1: 13 }, { month: 2, total: 35, coef1: 14 }])).toMatchObject({ state: 'pass', label: 'Đạt 2/2 tháng (tháng 1–2)' });
    expect(evaluateKpi(L1, [{ month: 1, total: 32, coef1: 11 }, { month: 2, total: 35, coef1: 14 }])).toMatchObject({ state: 'fail', passedMonths: 1 });
    expect(evaluateKpi(L1, [{ month: 1, total: 32, coef1: 13 }])).toMatchObject({ state: 'missing', label: 'Chưa đủ số liệu tháng 1–2' });
  });

  it('L2: trung bình 2 tháng cuối đạt dù một tháng dưới mức; tính tổng và trung bình mọi tháng đã nhập', () => {
    const months = [
      { month: 1, total: 70, coef1: 20 },
      { month: 2, total: 78, coef1: 22 },
      { month: 8, total: 95, coef1: 29 },
      { month: 9, total: 110, coef1: 33 },
    ];
    const e = evaluateKpi(L2, months);
    expect(e).toMatchObject({ state: 'pass', windowAvgTotal: 102.5, windowAvgCoef1: 31, sumTotal: 353, sumCoef1: 104, avgTotal: 88.3, monthsEntered: 4, ratio: 29 });
    expect(e.label).toBe('TB tháng 8–9: 102.5 tr / 31 tr (H.số 1 30%)');
  });

  it('tháng của Level: 30 ngày một tháng, không vượt số tháng Level', () => {
    expect([levelMonthOf(0, 2), levelMonthOf(29, 2), levelMonthOf(30, 2), levelMonthOf(75, 2)]).toEqual([1, 1, 2, 2]);
  });
});

describe('Rubric quan sát (R16)', () => {
  const s = (needs: number, advice: number, safety: number, upsell: number, closing: number) => ({ needs, advice, safety, upsell, closing });

  it('đạt khi tổng ≥ 10/15 và không tiêu chí nào 1 điểm', () => {
    expect(scoreObservation(DEFAULT_RUBRIC, s(2, 2, 2, 2, 2))).toMatchObject({ total: 10, max: 15, passed: true });
    expect(scoreObservation(DEFAULT_RUBRIC, s(3, 3, 1, 3, 3))).toMatchObject({ total: 13, passed: false, ones: ['An toàn thuốc'] });
    expect(scoreObservation(DEFAULT_RUBRIC, s(2, 2, 2, 2, 1)).passed).toBe(false);
    expect(scoreObservation(DEFAULT_RUBRIC, { needs: 3 }).missing).toHaveLength(4);
  });

  it('tỉ lệ ca đạt; chỉ kết luận đạt mục tiêu khi có ít nhất 3 ca', () => {
    const pass = { scores: s(2, 2, 2, 2, 2) };
    const fail = { scores: s(3, 3, 1, 3, 3) };
    expect(evaluateRubric(DEFAULT_RUBRIC, [pass, pass])).toMatchObject({ rate: 100, meetsTarget: null });
    expect(evaluateRubric(DEFAULT_RUBRIC, [pass, pass, pass, pass, fail])).toMatchObject({ rate: 80, meetsTarget: true, label: '4/5 ca đạt (80%) · mục tiêu ≥ 80%' });
    expect(evaluateRubric(DEFAULT_RUBRIC, [pass, pass, fail]).meetsTarget).toBe(false);
  });
});

describe('phiếu đánh giá và chuỗi ký (R12–R14)', () => {
  const form = reviewFormOf({ key: 1 });
  const draft = (over: Partial<ReviewDraft> = {}): ReviewDraft => ({ criteria: [], notes: {}, result: null, goals: '', ...over });
  const notes = { strengths: '- Tư vấn đúng SKU\n- Thái độ tốt', improve: '1. Hỏi sâu hơn\n2. Nắm thêm CTKM' };

  it('mặc định theo N3: chuỗi ký CHT → QLKV → BP ĐT → NV, gia hạn tối đa 2 lần', () => {
    expect(form).toMatchObject({ passLabel: 'Đủ điều kiện lên Level 2', signers: ['cht', 'qlkv', 'bp', 'nv'], extension: { maxTimes: 2, months: 1, maxGoals: 3 } });
    expect(reviewFormOf({ key: 4 }).passLabel).toBe('Đạt chuẩn Level 4');
  });

  it('đếm ý: mỗi dòng không rỗng, bỏ gạch đầu dòng và số thứ tự', () => {
    expect(countPoints('- a\n\n2) b\n  \n• c')).toBe(3);
    expect(countPoints('   ')).toBe(0);
  });

  it('R13: CHT chỉ ký khi đã chọn kết quả và đủ 2 phần nhận xét bắt buộc', () => {
    expect(reviewProblems(form, draft(), 0)).toEqual(expect.arrayContaining(['Chọn kết quả đề xuất']));
    expect(reviewProblems(form, draft({ result: 'pass', notes: { strengths: 'chỉ một ý' } }), 0)).toHaveLength(2);
    expect(reviewProblems(form, draft({ result: 'pass', notes }), 0)).toEqual([]);
  });

  it('R14: gia hạn cần mục tiêu (≤ 3) và không quá 2 lần', () => {
    expect(reviewProblems(form, draft({ result: 'extend', notes }), 0)).toEqual(['Ghi mục tiêu cần đạt trong thời gian gia hạn']);
    expect(reviewProblems(form, draft({ result: 'extend', notes, goals: 'a\nb\nc\nd' }), 0)).toEqual(['Gia hạn tối đa 3 mục tiêu']);
    expect(reviewProblems(form, draft({ result: 'extend', notes, goals: 'a' }), 2)[0]).toContain('Không gia hạn quá 2 lần');
  });

  it('R12: ký theo thứ tự; đúng người mới ký được bước của mình', () => {
    const people: RunPeople = { staffUserId: 10, buddyId: 5, chtId: 3, qlkvId: 2, acknowledged: true };
    const ha: Actor = { userId: 3, role: 'cht' };
    const huy: Actor = { userId: 2, role: 'qlkv' };
    const admin: Actor = { userId: 1, role: 'bp' };
    expect(nextSignStep(form.signers, [])).toBe(0);
    expect(nextSignStep(form.signers, [0, 1])).toBe(2);
    expect(nextSignStep(form.signers, [0, 1, 2, 3])).toBeNull();
    expect(canSignAs(ha, people, 'cht')).toBe(true);
    expect(canSignAs(huy, people, 'cht')).toBe(false);
    expect(canSignAs(admin, people, 'bp')).toBe(true);
    expect(canSignAs({ userId: 10, role: 'nv' }, people, 'nv')).toBe(true);
    expect(canSignAs({ userId: 5, role: 'nv' }, { ...people, staffUserId: null }, 'nv')).toBe(true);
    expect(outcomeStep(form.signers)).toBe(2);
  });
});
