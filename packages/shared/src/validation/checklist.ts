import { TASK_ROLES } from '../roles';
import type { Level, VersionContent } from '../schemas/version';

/**
 * Kiểm tra hợp lệ checklist (mục 7.7). Chạy liên tục khi soạn (giao diện) và chặn gửi duyệt, ban hành (máy chủ).
 * CK-12..CK-14 thuộc phiếu đánh giá, làm cùng trình soạn phiếu.
 */

export type IssueLevel = 'error' | 'warning';

export interface ValidationIssue {
  code: string;
  level: IssueLevel;
  message: string;
  /** Vị trí để giao diện cuộn tới đúng chỗ */
  at: { levelKey?: number; stageKey?: string; itemKey?: string; field?: string };
}

const ITEM_KEY_RE = /^L([1-4])-\d+-\d+$/;
const ROLES = new Set<string>(TASK_ROLES);

/** Khoảng tháng của Level đọc từ nhãn "Tháng 1–2", "Tháng 13–24" */
function monthRange(level: Level): [number, number] | null {
  const m = level.rangeLabel.match(/(\d+)\s*[–-]\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

export function validateChecklist(content: VersionContent): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (code: string, level: IssueLevel, message: string, at: ValidationIssue['at']) => issues.push({ code, level, message, at });

  const keyCount = new Map<string, number>();
  for (const level of content.levels) for (const s of level.stages) for (const it of s.items) keyCount.set(it.key, (keyCount.get(it.key) ?? 0) + 1);

  for (const level of content.levels) {
    const L = level.key;
    if (level.stages.length === 0) add('CK-01', 'error', `Level ${L} chưa có giai đoạn nào`, { levelKey: L });

    const itemStage = new Map<string, number>();
    level.stages.forEach((s, i) => s.items.forEach((it) => itemStage.set(it.key, i)));
    const range = monthRange(level);

    level.stages.forEach((s, si) => {
      const at = { levelKey: L, stageKey: s.key };
      const title = `Giai đoạn ${s.label || s.key}`;
      if (!s.name.trim()) add('CK-02', 'error', `${title} chưa có tên`, { ...at, field: 'name' });
      if (s.offsetStart < 0 || s.offsetEnd <= s.offsetStart) {
        add('CK-02', 'error', `${title}: ngày kết thúc (${s.offsetEnd}) phải lớn hơn ngày bắt đầu (${s.offsetStart})`, { ...at, field: 'offsetEnd' });
      }
      const prev = level.stages[si - 1];
      if (prev) {
        if (s.offsetStart < prev.offsetEnd) {
          add('CK-02', 'error', `${title} chồng lên giai đoạn trước (bắt đầu ngày ${s.offsetStart}, giai đoạn trước kết thúc ngày ${prev.offsetEnd})`, { ...at, field: 'offsetStart' });
        } else if (s.offsetStart > prev.offsetEnd) {
          add('CK-03', 'warning', `${title} không liền mạch với giai đoạn trước: hở từ ngày ${prev.offsetEnd} đến ${s.offsetStart}`, { ...at, field: 'offsetStart' });
        }
      }
      if (si === level.stages.length - 1 && s.offsetEnd > level.totalDays) {
        add('CK-04', 'error', `${title} kết thúc ngày ${s.offsetEnd}, vượt thời gian Level ${L} (${level.totalDays} ngày)`, { ...at, field: 'offsetEnd' });
      }
      if (s.signers.length === 0) add('CK-11', 'error', `${title} chưa có chuỗi ký cuối giai đoạn`, { ...at, field: 'signers' });
      for (const r of s.signers) if (!ROLES.has(r)) add('CK-15', 'error', `${title}: vai trò ký "${r}" không có trong danh sách vai trò`, { ...at, field: 'signers' });

      for (const it of s.items) {
        const iat = { levelKey: L, stageKey: s.key, itemKey: it.key };
        const keyMatch = it.key.match(ITEM_KEY_RE);
        if (!keyMatch || Number(keyMatch[1]) !== L) add('CK-06', 'error', `Mã "${it.key}" không đúng dạng L${L}-<giai đoạn>-<thứ tự>`, { ...iat, field: 'key' });
        if ((keyCount.get(it.key) ?? 0) > 1) add('CK-06', 'error', `Mã đầu việc ${it.key} bị trùng`, { ...iat, field: 'key' });
        if (!it.content.trim()) add('CK-06', 'error', `${it.key} thiếu nội dung`, { ...iat, field: 'content' });
        if (!it.category.trim()) add('CK-06', 'error', `${it.key} thiếu nhóm nội dung`, { ...iat, field: 'category' });
        if (it.verifiers.length === 0) add('CK-06', 'error', `${it.key} chưa chọn người xác nhận`, { ...iat, field: 'verifiers' });
        if (it.dueOffset < s.offsetStart || it.dueOffset > s.offsetEnd) {
          add('CK-05', 'error', `${it.key}: hạn ngày ${it.dueOffset} nằm ngoài giai đoạn (ngày ${s.offsetStart}–${s.offsetEnd})`, { ...iat, field: 'dueOffset' });
        }
        if (it.gpp && (it.allowNa || !it.required)) add('CK-07', 'error', `${it.key} là mục GPP nên phải bắt buộc và không được N/A`, { ...iat, field: 'gpp' });

        for (const dep of it.dependsOn) {
          if (dep === it.key) add('CK-08', 'error', `${it.key} không thể phụ thuộc chính nó`, { ...iat, field: 'dependsOn' });
          else if (!itemStage.has(dep)) add('CK-08', 'error', `${it.key} phụ thuộc mã ${dep} không có trong Level ${L}`, { ...iat, field: 'dependsOn' });
          else if (itemStage.get(dep)! > si) add('CK-08', 'error', `${it.key} phụ thuộc ${dep} thuộc giai đoạn sau`, { ...iat, field: 'dependsOn' });
        }

        if (range) {
          for (const m of it.content.matchAll(/tháng\s+(\d+)(?!\s*tháng)/gi)) {
            const n = Number(m[1]);
            if (n < range[0] || n > range[1]) add('CK-09', 'warning', `${it.key} nhắc "${m[0]}" nằm ngoài thời gian Level ${L} (${level.rangeLabel})`, { ...iat, field: 'content' });
          }
          for (const m of it.content.matchAll(/(\d+)\s+tháng/gi)) {
            if (Number(m[1]) > level.months) add('CK-09', 'warning', `${it.key} nhắc "${m[0]}" dài hơn thời gian Level ${L} (${level.months} tháng)`, { ...iat, field: 'content' });
          }
        }
        for (const m of it.content.matchAll(/thu hoạch[^.\n]*?Level\s*(\d)/gi)) {
          if (Number(m[1]) !== L) add('CK-10', 'warning', `${it.key} nhắc bài thu hoạch Level ${m[1]} trong checklist Level ${L}`, { ...iat, field: 'content' });
        }
      }
    });
  }

  const p = content.scheduleParams;
  if (p.remindDays > p.escalateDays) {
    issues.push({ code: 'TS-01', level: 'warning', message: 'Số ngày nhắc trước hạn lớn hơn số ngày leo thang báo QLKV', at: { field: 'remindDays' } });
  }
  return issues.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
}

export const countIssues = (issues: ValidationIssue[]) => ({
  errors: issues.filter((i) => i.level === 'error').length,
  warnings: issues.filter((i) => i.level === 'warning').length,
});
