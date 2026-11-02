import type { ChtTrack, Item, Level, Stage, VersionContent } from '../schemas/version';

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

const ITEM_TEXT: (keyof Item)[] = ['content', 'guidance', 'category', 'session', 'supporter', 'link'];
const ITEM_CRITERIA: [keyof Item, string][] = [
  ['requireNvFirst', 'có phần NV xác nhận'],
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

type Push = (levelKey: number | undefined, ref: string, label: string) => void;

/** So sánh giai đoạn và đầu việc của hai checklist (một Level hoặc một checklist CHT) */
function compareStages(L: number | undefined, prefix: string, pStageList: Stage[], dStageList: Stage[], crit: Push, text: Push) {
  const pStages = new Map(pStageList.map((s) => [s.key, s]));
  const dStages = new Map(dStageList.map((s) => [s.key, s]));
  for (const s of dStageList) {
    const ps = pStages.get(s.key);
    if (!ps) {
      crit(L, s.key, `${prefix}Thêm giai đoạn ${s.label || s.key}`);
      continue;
    }
    if (ps.offsetStart !== s.offsetStart || ps.offsetEnd !== s.offsetEnd) crit(L, s.key, `${prefix}Giai đoạn ${s.label}: đổi mốc ngày`);
    if (!same(ps.signers, s.signers)) crit(L, s.key, `${prefix}Giai đoạn ${s.label}: đổi chuỗi ký`);
    if (STAGE_TEXT.some((f) => !same(ps[f], s[f]))) text(L, s.key, `${prefix}Giai đoạn ${s.label}: sửa tên, nhãn hoặc mục tiêu`);
  }
  for (const ps of pStageList) if (!dStages.has(ps.key)) crit(L, ps.key, `${prefix}Bỏ giai đoạn ${ps.label || ps.key}`);

  const where = (stages: Stage[]) => new Map(stages.flatMap((s) => s.items.map((it) => [it.key, { it, stageKey: s.key }] as const)));
  const pItems = where(pStageList);
  const dItems = where(dStageList);
  for (const [key, d] of dItems) {
    const p = pItems.get(key);
    if (!p) {
      crit(L, key, `${prefix}Thêm đầu việc ${key}`);
      continue;
    }
    if (p.stageKey !== d.stageKey) crit(L, key, `${key}: chuyển sang giai đoạn khác`);
    if (!sameSet(p.it.verifiers, d.it.verifiers)) crit(L, key, `${key}: đổi người xác nhận`);
    if (!sameSet(p.it.dependsOn, d.it.dependsOn)) crit(L, key, `${key}: đổi phụ thuộc`);
    for (const [f, label] of ITEM_CRITERIA) if (!same(p.it[f], d.it[f])) crit(L, key, `${key}: đổi ${label}`);
    if (ITEM_TEXT.some((f) => !same(p.it[f], d.it[f]))) text(L, key, `${key}: sửa câu chữ`);
    else if (p.it.order !== d.it.order) text(L, key, `${key}: đổi thứ tự hiển thị`);
  }
  for (const key of pItems.keys()) if (!dItems.has(key)) crit(L, key, `${prefix}Bỏ đầu việc ${key}`);
}

const CHT_TEXT: (keyof ChtTrack)[] = ['name', 'title', 'goal', 'tip', 'notes', 'moods'];

export function classifyChanges(parent: VersionContent, draft: VersionContent): ChangeSummary {
  const changes: Change[] = [];
  const crit: Push = (levelKey, ref, label) => changes.push({ kind: 'criteria', levelKey, ref, label });
  const text: Push = (levelKey, ref, label) => changes.push({ kind: 'text', levelKey, ref, label });

  for (const dl of draft.levels) {
    const pl = parent.levels.find((l) => l.key === dl.key);
    if (!pl) continue;
    const L = dl.key;
    for (const [f, label] of LEVEL_CRITERIA) if (!same(pl[f], dl[f])) crit(L, `L${L}`, `Level ${L}: đổi ${label}`);
    for (const f of LEVEL_TEXT) if (!same(pl[f], dl[f])) text(L, `L${L}`, `Level ${L}: sửa ${f === 'overview' ? 'nội dung tổng quan' : 'mô tả'}`);
    compareStages(L, '', pl.stages, dl.stages, crit, text);
  }

  // Checklist CHT: thêm, bỏ một loại, đổi số ngày, tiền tố mã, tiêu chí tổng kết là thay đổi tiêu chí
  const pTracks = new Map((parent.chtTracks ?? []).map((t) => [t.key, t]));
  for (const t of draft.chtTracks ?? []) {
    const pt = pTracks.get(t.key);
    if (!pt) {
      crit(undefined, t.key, `Thêm checklist ${t.name}`);
      continue;
    }
    const prefix = `${t.name}: `;
    if (pt.totalDays !== t.totalDays) crit(undefined, t.key, `${prefix}đổi số ngày`);
    if (pt.code !== t.code) crit(undefined, t.key, `${prefix}đổi tiền tố mã đầu việc`);
    if (!same(pt.ratings, t.ratings)) crit(undefined, t.key, `${prefix}đổi tiêu chí đánh giá tổng kết`);
    if (CHT_TEXT.some((f) => !same(pt[f], t[f]))) text(undefined, t.key, `${prefix}sửa giới thiệu, lưu ý hoặc lựa chọn cảm xúc`);
    compareStages(undefined, prefix, pt.stages, t.stages, crit, text);
  }
  for (const pt of parent.chtTracks ?? []) if (!(draft.chtTracks ?? []).some((t) => t.key === pt.key)) crit(undefined, pt.key, `Bỏ checklist ${pt.name}`);

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
