import { kpiRule } from '../evaluation/kpi';
import { reviewFormOf } from '../evaluation/review';
import { rubricOf } from '../evaluation/rubric';
import type { VersionContent } from '../schemas/version';
import { validateChecklist, type IssueLevel, type ValidationIssue } from './checklist';

/**
 * Kiểm tra hợp lệ Khung năng lực (mục 6.2). KNL-01, KNL-02 cần mốc tháng có cấu trúc (hiện chỉ có nhãn) nên chưa kiểm;
 * KNL-07, KNL-08, KNL-09 thuộc Buddy Score chưa làm; KNL-11 (ghi chú thay đổi) kiểm khi gửi duyệt.
 */
export function validateFramework(content: VersionContent): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (code: string, level: IssueLevel, message: string, at: ValidationIssue['at']) => issues.push({ code, level, message, at });

  for (const level of content.levels) {
    const L = level.key;
    if (!level.name.trim()) add('KNL-00', 'error', `Level ${L} chưa có tên gọi`, { levelKey: L, section: 'info', field: 'name' });
    if (level.totalDays < 1) add('KNL-00', 'error', `Level ${L}: số ngày phải lớn hơn 0`, { levelKey: L, section: 'info', field: 'totalDays' });

    const k = level.kpi;
    const rule = kpiRule(level);
    if ((k.windowFrom ?? rule.windowFrom) < 1 || (k.windowTo ?? rule.windowTo) > level.months || rule.windowFrom > rule.windowTo) {
      add('KNL-03', 'error', `Level ${L}: cửa sổ xét KPI (tháng ${k.windowFrom ?? '?'}–${k.windowTo ?? '?'}) phải nằm trong ${level.months} tháng của Level`, {
        levelKey: L,
        section: 'kpi',
        field: 'windowTo',
      });
    }
    if (k.coef1 > k.total) add('KNL-04', 'error', `Level ${L}: DS hệ số 1 (${k.coef1}) lớn hơn DS tổng (${k.total})`, { levelKey: L, section: 'kpi', field: 'coef1' });
    if (k.total > 0 && Math.abs((k.coef1 / k.total) * 100 - k.ratio) > 0.5) {
      add('KNL-05', 'warning', `Level ${L}: tỉ trọng H.số 1 khai báo ${k.ratio}% lệch so với ${k.coef1}/${k.total} = ${((k.coef1 / k.total) * 100).toFixed(1)}%`, {
        levelKey: L,
        section: 'kpi',
        field: 'ratio',
      });
    }

    const form = reviewFormOf(level);
    if (form.signers.length === 0) add('KNL-10', 'error', `Level ${L}: phiếu đánh giá chưa có bước ký nào`, { levelKey: L, section: 'review', field: 'signers' });
    if (!form.passLabel.trim()) add('KNL-10', 'error', `Level ${L}: chưa đặt tên kết quả "đạt" của phiếu`, { levelKey: L, section: 'review', field: 'passLabel' });
    const promptKeys = form.prompts.map((p) => p.key.trim());
    if (promptKeys.some((p) => !p) || new Set(promptKeys).size !== promptKeys.length) {
      add('KNL-10', 'error', `Level ${L}: mỗi phần nhận xét của phiếu cần mã riêng, không trùng`, { levelKey: L, section: 'review', field: 'prompts' });
    }
    for (const p of form.prompts) if (!p.text.trim()) add('KNL-10', 'error', `Level ${L}: phần nhận xét "${p.key}" chưa có nội dung câu hỏi`, { levelKey: L, section: 'review', field: 'prompts' });
    if (form.extension.enabled && (form.extension.months < 1 || form.extension.maxGoals < 1)) {
      add('CK-13', 'warning', `Level ${L}: phiếu cho phép gia hạn nhưng chưa có thời gian hoặc số mục tiêu tối đa`, { levelKey: L, section: 'review', field: 'extension' });
    }
    if (level.reviewCriteria.length === 0) add('CK-12', 'error', `Level ${L}: phiếu đánh giá chưa có tiêu chí định lượng`, { levelKey: L, section: 'review', field: 'criteria' });
    level.reviewCriteria.forEach((c, i) => {
      if (!c.name.trim() || !c.threshold.trim()) add('CK-12', 'error', `Level ${L}: tiêu chí phiếu thứ ${i + 1} thiếu tên hoặc ngưỡng đạt`, { levelKey: L, section: 'review', field: 'criteria' });
    });
  }

  const rubric = rubricOf(content);
  const max = rubric.criteria.length * rubric.scaleMax;
  if (rubric.passTotal > max) add('KNL-06', 'error', `Rubric: ngưỡng đạt ${rubric.passTotal} vượt tổng điểm tối đa ${max}`, { section: 'rubric', field: 'passTotal' });
  const keys = rubric.criteria.map((c) => c.key.trim());
  if (keys.some((k) => !k) || new Set(keys).size !== keys.length) add('KNL-06', 'error', 'Rubric: mỗi tiêu chí cần mã riêng, không trùng', { section: 'rubric', field: 'criteria' });
  for (const c of rubric.criteria) if (!c.name.trim()) add('KNL-06', 'error', `Rubric: tiêu chí "${c.key}" chưa có tên`, { section: 'rubric', field: 'criteria' });
  if (rubric.criteria.length === 0) add('KNL-06', 'error', 'Rubric chưa có tiêu chí nào', { section: 'rubric', field: 'criteria' });
  return issues;
}

/** Toàn bộ kiểm tra của một phiên bản Bộ lộ trình: Checklist (mục 7.7) và Khung năng lực (mục 6.2) */
export function validateVersion(content: VersionContent): ValidationIssue[] {
  return [...validateChecklist(content), ...validateFramework(content)].sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
}
