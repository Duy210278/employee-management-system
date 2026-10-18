import type { Level } from '../schemas/version';

/**
 * Đánh giá chỉ tiêu doanh số (mục 6.1, R15). Tháng tính theo tháng của Level (V8): tháng 1 = 30 ngày đầu của lượt.
 * L1 mặc định: mọi tháng trong cửa sổ 1–2 phải đạt. L2–L4: trung bình 2 tháng cuối Level đạt.
 */

export interface SalesMonth {
  month: number;
  /** Doanh số tổng, triệu đồng */
  total: number | null;
  /** Doanh số hàng hệ số 1, triệu đồng */
  coef1: number | null;
}

export type KpiMethod = 'all_months' | 'average';

export interface KpiRule {
  method: KpiMethod;
  windowFrom: number;
  windowTo: number;
  total: number;
  coef1: number;
  ratio: number;
}

export interface KpiEvaluation {
  rule: KpiRule;
  state: 'pass' | 'fail' | 'missing';
  label: string;
  /** Số tháng đạt trong cửa sổ (cách xét all_months) */
  passedMonths: number;
  windowMonths: number;
  /** Trung bình trong cửa sổ xét */
  windowAvgTotal: number | null;
  windowAvgCoef1: number | null;
  /** Tổng và trung bình trên mọi tháng đã nhập của Level */
  sumTotal: number;
  sumCoef1: number;
  avgTotal: number | null;
  avgCoef1: number | null;
  /** Tỉ trọng H.số 1 tính trên tổng (%) */
  ratio: number | null;
  monthsEntered: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const complete = (m: SalesMonth | undefined): m is SalesMonth & { total: number; coef1: number } => !!m && m.total !== null && m.coef1 !== null;

export function kpiRule(level: Pick<Level, 'key' | 'months' | 'kpi'>): KpiRule {
  const method: KpiMethod = level.kpi.method ?? (level.key === 1 ? 'all_months' : 'average');
  const windowTo = Math.min(level.kpi.windowTo ?? level.months, level.months);
  const windowFrom = Math.max(1, level.kpi.windowFrom ?? (method === 'all_months' ? 1 : windowTo - 1));
  return { method, windowFrom, windowTo, total: level.kpi.total, coef1: level.kpi.coef1, ratio: level.kpi.ratio };
}

export const monthPasses = (rule: Pick<KpiRule, 'total' | 'coef1'>, m: SalesMonth) =>
  m.total !== null && m.coef1 !== null && m.total >= rule.total && m.coef1 >= rule.coef1;

export function evaluateKpi(level: Pick<Level, 'key' | 'months' | 'kpi'>, months: readonly SalesMonth[]): KpiEvaluation {
  const rule = kpiRule(level);
  const entered = months.filter(complete);
  const sumTotal = round1(entered.reduce((a, m) => a + m.total, 0));
  const sumCoef1 = round1(entered.reduce((a, m) => a + m.coef1, 0));
  const windowList = Array.from({ length: rule.windowTo - rule.windowFrom + 1 }, (_, i) => rule.windowFrom + i);
  const inWindow = windowList.map((n) => months.find((m) => m.month === n));
  const windowData = inWindow.filter(complete);
  const windowAvgTotal = windowData.length ? round1(windowData.reduce((a, m) => a + m.total, 0) / windowData.length) : null;
  const windowAvgCoef1 = windowData.length ? round1(windowData.reduce((a, m) => a + m.coef1, 0) / windowData.length) : null;
  const passedMonths = windowData.filter((m) => monthPasses(rule, m)).length;
  const range = rule.windowFrom === rule.windowTo ? `tháng ${rule.windowFrom}` : `tháng ${rule.windowFrom}–${rule.windowTo}`;

  let state: KpiEvaluation['state'];
  let label: string;
  if (windowData.length < windowList.length) {
    state = 'missing';
    label = `Chưa đủ số liệu ${range}`;
  } else if (rule.method === 'all_months') {
    state = passedMonths === windowList.length ? 'pass' : 'fail';
    label = `Đạt ${passedMonths}/${windowList.length} tháng (${range})`;
  } else {
    state = windowAvgTotal! >= rule.total && windowAvgCoef1! >= rule.coef1 ? 'pass' : 'fail';
    const r = windowAvgTotal ? Math.round((windowAvgCoef1! / windowAvgTotal) * 100) : 0;
    label = `TB ${range}: ${windowAvgTotal} tr / ${windowAvgCoef1} tr (H.số 1 ${r}%)`;
  }

  return {
    rule,
    state,
    label,
    passedMonths,
    windowMonths: windowList.length,
    windowAvgTotal,
    windowAvgCoef1,
    sumTotal,
    sumCoef1,
    avgTotal: entered.length ? round1(sumTotal / entered.length) : null,
    avgCoef1: entered.length ? round1(sumCoef1 / entered.length) : null,
    ratio: sumTotal ? Math.round((sumCoef1 / sumTotal) * 100) : null,
    monthsEntered: entered.length,
  };
}

/** Tháng của Level chứa ngày thứ dayIndex (0 = ngày đầu), giới hạn trong số tháng của Level */
export const levelMonthOf = (dayIndex: number, months: number) => Math.min(months, Math.max(1, Math.floor(dayIndex / 30) + 1));
