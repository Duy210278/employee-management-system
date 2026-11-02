import { TASK_ROLES } from '../roles';
import type { ChtTrack, Level, Stage, VersionContent } from '../schemas/version';

/**
 * Kiểm tra hợp lệ checklist (mục 7.7). Chạy liên tục khi soạn (giao diện) và chặn gửi duyệt, ban hành (máy chủ).
 * CK-12..CK-14 thuộc phiếu đánh giá, làm cùng trình soạn phiếu.
 */

export type IssueLevel = 'error' | 'warning';

export interface ValidationIssue {
  code: string;
  level: IssueLevel;
  message: string;
  /** Vị trí để giao diện cuộn tới đúng chỗ; section là phần của Khung năng lực (info, kpi, review, rubric…); trackKey là checklist CHT */
  at: { levelKey?: number; trackKey?: string; stageKey?: string; itemKey?: string; section?: string; field?: string };
}

const ROLES = new Set<string>(TASK_ROLES);

/** Khoảng tháng của Level đọc từ nhãn "Tháng 1–2", "Tháng 13–24" */
function monthRange(level: Level): [number, number] | null {
  const m = level.rangeLabel.match(/(\d+)\s*[–-]\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Một checklist cần kiểm tra: một Level của lộ trình NVBH hoặc một loại checklist CHT */
interface Owner {
  where: { levelKey?: number; trackKey?: string };
  /** "Level 2" hoặc "CHT mới tuyển" */
  name: string;
  keyRe: RegExp;
  keyHint: string;
  totalDays: number;
  stages: Stage[];
  /** Ngày ký cuối giai đoạn bắt buộc (NVBH); checklist CHT ký ở đánh giá tổng kết tuần */
  needSigners: boolean;
  level: Level | null;
  /** Tên phần người học trong thông báo: "NV", checklist CHT là "CHT" */
  nv: string;
}

function checkOwner(o: Owner, keyCount: Map<string, number>, add: (code: string, level: IssueLevel, message: string, at: ValidationIssue['at']) => void) {
  if (o.stages.length === 0) add('CK-01', 'error', `${o.name} chưa có giai đoạn nào`, o.where);
  const itemStage = new Map<string, number>();
  o.stages.forEach((s, i) => s.items.forEach((it) => itemStage.set(it.key, i)));
  const range = o.level ? monthRange(o.level) : null;

  o.stages.forEach((s, si) => {
    const at = { ...o.where, stageKey: s.key };
    const title = `${o.level ? 'Giai đoạn' : o.name + ' ·'} ${s.label || s.key}`;
    if (!s.name.trim()) add('CK-02', 'error', `${title} chưa có tên`, { ...at, field: 'name' });
    if (s.offsetStart < 0 || s.offsetEnd <= s.offsetStart) {
      add('CK-02', 'error', `${title}: ngày kết thúc (${s.offsetEnd}) phải lớn hơn ngày bắt đầu (${s.offsetStart})`, { ...at, field: 'offsetEnd' });
    }
    const prev = o.stages[si - 1];
    if (prev) {
      if (s.offsetStart < prev.offsetEnd) {
        add('CK-02', 'error', `${title} chồng lên giai đoạn trước (bắt đầu ngày ${s.offsetStart}, giai đoạn trước kết thúc ngày ${prev.offsetEnd})`, { ...at, field: 'offsetStart' });
      } else if (s.offsetStart > prev.offsetEnd) {
        add('CK-03', 'warning', `${title} không liền mạch với giai đoạn trước: hở từ ngày ${prev.offsetEnd} đến ${s.offsetStart}`, { ...at, field: 'offsetStart' });
      }
    }
    if (si === o.stages.length - 1 && s.offsetEnd > o.totalDays) {
      add('CK-04', 'error', `${title} kết thúc ngày ${s.offsetEnd}, vượt thời gian ${o.name} (${o.totalDays} ngày)`, { ...at, field: 'offsetEnd' });
    }
    if (o.needSigners && s.signers.length === 0) add('CK-11', 'error', `${title} chưa có chuỗi ký cuối giai đoạn`, { ...at, field: 'signers' });
    for (const r of s.signers) if (!ROLES.has(r)) add('CK-15', 'error', `${title}: vai trò ký "${r}" không có trong danh sách vai trò`, { ...at, field: 'signers' });

    for (const it of s.items) {
      const iat = { ...o.where, stageKey: s.key, itemKey: it.key };
      if (!o.keyRe.test(it.key)) add('CK-06', 'error', `Mã "${it.key}" không đúng dạng ${o.keyHint}`, { ...iat, field: 'key' });
      if ((keyCount.get(it.key) ?? 0) > 1) add('CK-06', 'error', `Mã đầu việc ${it.key} bị trùng`, { ...iat, field: 'key' });
      if (!it.content.trim()) add('CK-06', 'error', `${it.key} thiếu nội dung`, { ...iat, field: 'content' });
      if (!it.category.trim()) add('CK-06', 'error', `${it.key} thiếu nhóm nội dung`, { ...iat, field: 'category' });
      // Không chọn người xác nhận = NV tự đánh giá (mục 7.2): cần có phần NV, mục GPP vẫn phải có người kiểm tra
      if (it.verifiers.length === 0) {
        if (!it.requireNvFirst) add('CK-06', 'error', `${it.key} không có ai xác nhận: chọn người xác nhận hoặc bật "Có phần ${o.nv} xác nhận"`, { ...iat, field: 'verifiers' });
        else if (it.gpp) add('CK-07', 'error', `${it.key} là mục GPP nên phải có người kiểm tra, không để ${o.nv} tự xác nhận`, { ...iat, field: 'verifiers' });
        else add('CK-18', 'warning', `${it.key}: ${o.nv} tự xác nhận, không có người kiểm tra`, { ...iat, field: 'verifiers' });
      }
      if (it.dueOffset < s.offsetStart || it.dueOffset > s.offsetEnd) {
        add('CK-05', 'error', `${it.key}: hạn ngày ${it.dueOffset} nằm ngoài giai đoạn (ngày ${s.offsetStart}–${s.offsetEnd})`, { ...iat, field: 'dueOffset' });
      }
      if (it.gpp && (it.allowNa || !it.required)) add('CK-07', 'error', `${it.key} là mục GPP nên phải bắt buộc và không được N/A`, { ...iat, field: 'gpp' });
      if (it.link && !/^https?:\/\/\S+$/.test(it.link)) add('CK-16', 'warning', `${it.key}: link hướng dẫn phải bắt đầu bằng http:// hoặc https://`, { ...iat, field: 'link' });

      for (const dep of it.dependsOn) {
        if (dep === it.key) add('CK-08', 'error', `${it.key} không thể phụ thuộc chính nó`, { ...iat, field: 'dependsOn' });
        else if (!itemStage.has(dep)) add('CK-08', 'error', `${it.key} phụ thuộc mã ${dep} không có trong ${o.name}`, { ...iat, field: 'dependsOn' });
        else if (itemStage.get(dep)! > si) add('CK-08', 'error', `${it.key} phụ thuộc ${dep} thuộc giai đoạn sau`, { ...iat, field: 'dependsOn' });
      }

      const level = o.level;
      if (!level) continue;
      const L = level.key;
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

const chtOwner = (t: ChtTrack): Owner => ({
  where: { trackKey: t.key },
  name: t.name || t.key,
  keyRe: new RegExp(`^${t.code}-\\d+-\\d+$`),
  keyHint: `${t.code}-<ngày>-<thứ tự>`,
  totalDays: t.totalDays,
  stages: t.stages,
  needSigners: false,
  level: null,
  nv: 'CHT',
});

export function validateChecklist(content: VersionContent): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (code: string, level: IssueLevel, message: string, at: ValidationIssue['at']) => issues.push({ code, level, message, at });

  const owners: Owner[] = [
    ...content.levels.map((level) => ({
      where: { levelKey: level.key },
      name: `Level ${level.key}`,
      keyRe: new RegExp(`^L${level.key}-\\d+-\\d+$`),
      keyHint: `L${level.key}-<giai đoạn>-<thứ tự>`,
      totalDays: level.totalDays,
      stages: level.stages,
      needSigners: true,
      level,
      nv: 'NV',
    })),
    ...(content.chtTracks ?? []).map(chtOwner),
  ];
  const keyCount = new Map<string, number>();
  for (const o of owners) for (const s of o.stages) for (const it of s.items) keyCount.set(it.key, (keyCount.get(it.key) ?? 0) + 1);
  for (const o of owners) checkOwner(o, keyCount, add);

  for (const t of content.chtTracks ?? []) {
    const at = { trackKey: t.key, section: 'cht-info' };
    if (!t.name.trim()) add('CK-17', 'error', `Checklist CHT (${t.key}) chưa có tên`, { ...at, field: 'name' });
    if (!t.moods.length) add('CK-17', 'warning', `${t.name}: chưa có lựa chọn "Cảm xúc CHT" cho nhật ký theo dõi`, { ...at, field: 'moods' });
    if (!t.ratings.length) add('CK-17', 'error', `${t.name}: chưa có tiêu chí chấm điểm tổng kết tuần đầu`, { ...at, field: 'ratings' });
    const keys = t.ratings.map((r) => r.key.trim());
    if (keys.some((k) => !k) || new Set(keys).size !== keys.length) add('CK-17', 'error', `${t.name}: mã tiêu chí tổng kết phải có và không trùng`, { ...at, field: 'ratings' });
    const codes = (content.chtTracks ?? []).filter((x) => x.code === t.code);
    if (codes.length > 1) add('CK-17', 'error', `Hai checklist CHT dùng chung tiền tố mã ${t.code}`, { ...at, field: 'code' });
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
