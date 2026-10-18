import type { Item, Level, Stage, VersionContent } from '../schemas/version';

/**
 * Phân loại thay đổi của bản nháp so với bản gốc (mục 8.3).
 * - Sửa diễn đạt: chỉ câu chữ, không đổi cách đánh giá → tăng số thứ ba (2.1 → 2.1.1), áp dụng ngay cho lượt cùng dòng tiêu chí.
 * - Thay đổi tiêu chí: mọi trường còn lại → tăng số thứ hai (2.1 → 2.2), chỉ áp dụng cho lượt Level mới.
 * Thứ tự hiển thị trong cùng giai đoạn chỉ là trình bày nên tính là diễn đạt (định nghĩa "Sửa diễn đạt" ở mục 2).
 */

export type ChangeKind = 'text' | 'criteria';

export interface Change {
  kind: ChangeKind;
  levelKey?: number;
  ref: string;
  label: string;
}

export interface ChangeSummary {
  /** null khi bản nháp chưa khác bản gốc */
  kind: ChangeKind | null;
  criteria: number;
  text: number;
  changes: Change[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sameSet = (a: readonly string[], b: readonly string[]) => same([...a].sort(), [...b].sort());

const ITEM_TEXT: (keyof Item)[] = ['content', 'guidance', 'category'];
const ITEM_CRITERIA: [keyof Item, string][] = [
  ['requireNvFirst', 'yêu cầu NV báo trước'],
  ['dueOffset', 'hạn'],
  ['gpp', 'cờ GPP'],
  ['required', 'cờ bắt buộc'],
  ['allowNa', 'cho phép N/A'],
  ['dataSource', 'nguồn xác nhận'],
  ['evidence', 'bằng chứng yêu cầu'],
];
const STAGE_TEXT: (keyof Stage)[] = ['name', 'label', 'goal', 'shiftFrom', 'shiftTo', 'order'];
const LEVEL_TEXT: (keyof Level)[] = ['name', 'phase', 'motto', 'durationLabel', 'rangeLabel', 'checklistName', 'overview'];
const LEVEL_CRITERIA: [keyof Level, string][] = [
  ['totalDays', 'số ngày Level'],
  ['months', 'số tháng Level'],
  ['kpi', 'chỉ tiêu doanh số'],
  ['reviewCriteria', 'tiêu chí phiếu đánh giá'],
  ['review', 'cấu hình phiếu đánh giá'],
];

export function classifyChanges(parent: VersionContent, draft: VersionContent): ChangeSummary {
  const changes: Change[] = [];
  const crit = (levelKey: number | undefined, ref: string, label: string) => changes.push({ kind: 'criteria', levelKey, ref, label });
  const text = (levelKey: number | undefined, ref: string, label: string) => changes.push({ kind: 'text', levelKey, ref, label });

  for (const dl of draft.levels) {
    const pl = parent.levels.find((l) => l.key === dl.key);
    if (!pl) continue;
    const L = dl.key;
    for (const [f, label] of LEVEL_CRITERIA) if (!same(pl[f], dl[f])) crit(L, `L${L}`, `Level ${L}: đổi ${label}`);
    for (const f of LEVEL_TEXT) if (!same(pl[f], dl[f])) text(L, `L${L}`, `Level ${L}: sửa ${f === 'overview' ? 'nội dung tổng quan' : 'mô tả'}`);

    const pStages = new Map(pl.stages.map((s) => [s.key, s]));
    const dStages = new Map(dl.stages.map((s) => [s.key, s]));
    for (const s of dl.stages) {
      const ps = pStages.get(s.key);
      if (!ps) {
        crit(L, s.key, `Thêm giai đoạn ${s.label || s.key}`);
        continue;
      }
      if (ps.offsetStart !== s.offsetStart || ps.offsetEnd !== s.offsetEnd) crit(L, s.key, `Giai đoạn ${s.label}: đổi mốc ngày`);
      if (!same(ps.signers, s.signers)) crit(L, s.key, `Giai đoạn ${s.label}: đổi chuỗi ký`);
      if (STAGE_TEXT.some((f) => !same(ps[f], s[f]))) text(L, s.key, `Giai đoạn ${s.label}: sửa tên, nhãn hoặc mục tiêu`);
    }
    for (const ps of pl.stages) if (!dStages.has(ps.key)) crit(L, ps.key, `Bỏ giai đoạn ${ps.label || ps.key}`);

    const where = (level: Level) => new Map(level.stages.flatMap((s) => s.items.map((it) => [it.key, { it, stageKey: s.key }] as const)));
    const pItems = where(pl);
    const dItems = where(dl);
    for (const [key, d] of dItems) {
      const p = pItems.get(key);
      if (!p) {
        crit(L, key, `Thêm đầu việc ${key}`);
        continue;
      }
      if (p.stageKey !== d.stageKey) crit(L, key, `${key}: chuyển sang giai đoạn khác`);
      if (!sameSet(p.it.verifiers, d.it.verifiers)) crit(L, key, `${key}: đổi người xác nhận`);
      if (!sameSet(p.it.dependsOn, d.it.dependsOn)) crit(L, key, `${key}: đổi phụ thuộc`);
      for (const [f, label] of ITEM_CRITERIA) if (!same(p.it[f], d.it[f])) crit(L, key, `${key}: đổi ${label}`);
      if (ITEM_TEXT.some((f) => !same(p.it[f], d.it[f]))) text(L, key, `${key}: sửa câu chữ`);
      else if (p.it.order !== d.it.order) text(L, key, `${key}: đổi thứ tự hiển thị`);
    }
    for (const key of pItems.keys()) if (!dItems.has(key)) crit(L, key, `Bỏ đầu việc ${key}`);
  }

  for (const k of Object.keys(draft.scheduleParams) as (keyof VersionContent['scheduleParams'])[]) {
    if (parent.scheduleParams[k] !== draft.scheduleParams[k]) crit(undefined, `param:${k}`, `Đổi tham số lịch ${k}`);
  }
  if (!same(parent.rubric, draft.rubric)) crit(undefined, 'rubric', 'Đổi Rubric quan sát');
  if (!same(parent.framework, draft.framework)) text(undefined, 'framework', 'Sửa phần giới thiệu Khung năng lực');

  const criteria = changes.filter((c) => c.kind === 'criteria').length;
  const textCount = changes.length - criteria;
  return { kind: criteria ? 'criteria' : textCount ? 'text' : null, criteria, text: textCount, changes };
}

/**
 * Số phiên bản đề xuất (mục 8.3). Sửa diễn đạt: số thứ ba kế tiếp trong dòng tiêu chí của bản gốc.
 * Thay đổi tiêu chí: số thứ hai kế tiếp chưa dùng trong cùng số chính.
 */
export function proposeVersionCode(parentLine: string, kind: ChangeKind, existingCodes: readonly string[]): string {
  const [major, minor] = parentLine.split('.').map(Number);
  if (kind === 'text') {
    const patches = existingCodes.filter((c) => c.startsWith(`${parentLine}.`)).map((c) => Number(c.split('.')[2]) || 0);
    return `${parentLine}.${Math.max(0, ...patches) + 1}`;
  }
  const minors = existingCodes.filter((c) => c.split('.')[0] === String(major)).map((c) => Number(c.split('.')[1]) || 0);
  return `${major}.${Math.max(minor, ...minors) + 1}`;
}
