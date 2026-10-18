import type { Rubric, VersionContent } from '../schemas/version';

/** Rubric đánh giá tư vấn tại quầy theo Phụ lục C của Khung năng lực (N1) */
export const DEFAULT_RUBRIC: Rubric = {
  scaleMax: 3,
  passTotal: 10,
  forbidOne: true,
  minObsPerMonth: 3,
  targetRate: 80,
  criteria: [
    { key: 'needs', name: 'Khai thác nhu cầu', d1: 'Không hỏi hoặc hỏi sai', d2: 'Hỏi đủ 3–4 câu cơ bản', d3: 'Hỏi sâu, phát hiện nhu cầu tiềm ẩn', critical: false },
    { key: 'advice', name: 'Tư vấn sản phẩm', d1: 'Tư vấn sai hoặc không đủ thông tin', d2: 'Đúng sản phẩm, công dụng cơ bản', d3: 'Đúng + cá nhân hoá cho đối tượng khách', critical: false },
    { key: 'safety', name: 'An toàn thuốc', d1: 'Bỏ qua cảnh báo quan trọng', d2: 'Đề cập cảnh báo', d3: 'Chủ động cảnh báo phù hợp', critical: true },
    { key: 'upsell', name: 'Upsell / Cross-sell', d1: 'Không đề xuất khi có cơ hội rõ', d2: 'Đề xuất nhưng chưa có lý do thuyết phục', d3: 'Đề xuất tự nhiên, có lý do rõ ràng', critical: false },
    { key: 'closing', name: 'Kết thúc giao dịch', d1: 'Không dặn dò', d2: 'Dặn dò cơ bản', d3: 'Dặn dò đầy đủ, mời quay lại', critical: false },
  ],
};

export const rubricOf = (content: Pick<VersionContent, 'rubric'>): Rubric => content.rubric ?? DEFAULT_RUBRIC;

export interface ObservationScore {
  total: number;
  max: number;
  passed: boolean;
  /** Tiêu chí bị chấm 1 điểm */
  ones: string[];
  /** Tiêu chí chưa chấm */
  missing: string[];
}

/** R16: ca đạt khi tổng ≥ ngưỡng và (nếu cấu hình) không tiêu chí nào 1 điểm */
export function scoreObservation(rubric: Rubric, scores: Record<string, number>): ObservationScore {
  const missing = rubric.criteria.filter((c) => !Number.isInteger(scores[c.key])).map((c) => c.name);
  const total = rubric.criteria.reduce((a, c) => a + (scores[c.key] ?? 0), 0);
  const ones = rubric.criteria.filter((c) => scores[c.key] === 1).map((c) => c.name);
  return {
    total,
    max: rubric.criteria.length * rubric.scaleMax,
    passed: missing.length === 0 && total >= rubric.passTotal && !(rubric.forbidOne && ones.length > 0),
    ones,
    missing,
  };
}

export interface RubricEvaluation {
  count: number;
  passed: number;
  /** Tỉ lệ ca đạt (%), null khi chưa có ca */
  rate: number | null;
  /** null khi chưa đủ số ca tối thiểu để kết luận */
  meetsTarget: boolean | null;
  label: string;
}

/** Tỉ lệ ca đạt trên số ca thực tế (V3); chỉ kết luận khi có ít nhất số ca tối thiểu */
export function evaluateRubric(rubric: Rubric, observations: readonly { scores: Record<string, number> }[]): RubricEvaluation {
  const count = observations.length;
  const passed = observations.filter((o) => scoreObservation(rubric, o.scores).passed).length;
  const rate = count ? Math.round((passed / count) * 100) : null;
  const enough = count >= Math.max(1, rubric.minObsPerMonth);
  return {
    count,
    passed,
    rate,
    meetsTarget: enough ? rate! >= rubric.targetRate : null,
    label: count ? `${passed}/${count} ca đạt (${rate}%) · mục tiêu ≥ ${rubric.targetRate}%` : 'Chưa có ca quan sát',
  };
}
