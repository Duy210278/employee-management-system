import type { ChtTrack, Item, Level, Stage } from '@lotrinh/shared';

/**
 * Thao tác trên nội dung checklist khi soạn (mục 7.3). Sửa trực tiếp đối tượng reactive của bản nháp.
 * Mảng items trong giai đoạn là thứ tự hiển thị; trường order luôn được đánh lại theo vị trí.
 * Dùng chung cho checklist Level của NVBH và checklist onboarding CHT (mỗi ngày D+n là một giai đoạn).
 */

/** Nơi chứa các giai đoạn: một Level (key là số) hoặc một checklist CHT (key là chuỗi, mã đầu việc theo code) */
export type StageOwner = Level | ChtTrack;
export const isChtOwner = (o: StageOwner): o is ChtTrack => typeof o.key === 'string';
const prefixOf = (o: StageOwner) => (isChtOwner(o) ? o.code : `L${o.key}`);
/** Vị trí của nơi chứa để trình soạn chuyển đúng tab và Level/checklist khi focus */
export const ownerAt = (o: StageOwner) => (isChtOwner(o) ? { trackKey: o.key } : { levelKey: o.key });
/** Nhãn của ngày trong checklist CHT: Ngày D, Ngày D+1… */
export const chtDayLabel = (offset: number) => (offset ? `Ngày D+${offset}` : 'Ngày D');

export const renumber = (stage: Stage) => stage.items.forEach((it, i) => (it.order = i + 1));

/** Ô số luôn ra số nguyên (ô trống không được thành chuỗi rỗng, vì schema yêu cầu số) */
export const intOf = (e: Event, fallback = 0): number => {
  const n = parseInt((e.target as HTMLInputElement).value, 10);
  return Number.isFinite(n) ? n : fallback;
};
/** Ô số thập phân (doanh số, tỉ lệ), chấp nhận dấu phẩy */
export const numOf = (e: Event, fallback = 0): number => {
  const n = Number((e.target as HTMLInputElement).value.replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};
export const optIntOf = (e: Event): number | undefined => {
  const n = parseInt((e.target as HTMLInputElement).value, 10);
  return Number.isFinite(n) ? n : undefined;
};

const allItems = (level: StageOwner) => level.stages.flatMap((s) => s.items);

/** Mã mới không trùng: L{level}-{thứ tự giai đoạn}-{số kế tiếp}, checklist CHT là {code}-{ngày}-{số kế tiếp} */
export function nextItemKey(level: StageOwner, stage: Stage): string {
  const prefix = `${prefixOf(level)}-${stage.order}-`;
  const used = new Set(allItems(level).map((i) => i.key));
  let n = Math.max(0, ...stage.items.map((i) => Number(i.key.startsWith(prefix) ? i.key.slice(prefix.length) : 0) || 0)) + 1;
  while (used.has(prefix + n)) n++;
  return prefix + n;
}

export function addItem(level: StageOwner, stage: Stage): Item {
  const last = stage.items.at(-1);
  const cht = isChtOwner(level);
  const item: Item = {
    key: nextItemKey(level, stage),
    order: stage.items.length + 1,
    category: last?.category ?? '',
    content: '',
    guidance: '',
    // CHT: mặc định Đào tạo xác nhận; NVBH: Buddy ở Level 1, CHT từ Level 2
    verifiers: [cht ? 'bp' : level.key === 1 ? 'buddy' : 'cht'],
    requireNvFirst: true,
    dueOffset: stage.offsetEnd,
    gpp: false,
    required: true,
    allowNa: true,
    dataSource: 'manual',
    evidence: 'none',
    dependsOn: [],
    ...(cht ? { session: last?.session, supporter: last?.supporter } : {}),
  };
  stage.items.push(item);
  return item;
}

/** Xóa đầu việc và tự gỡ các phụ thuộc trỏ tới mã đó; trả về số mục đã gỡ phụ thuộc */
export function removeItem(level: StageOwner, key: string): number {
  for (const s of level.stages) {
    const idx = s.items.findIndex((i) => i.key === key);
    if (idx >= 0) {
      s.items.splice(idx, 1);
      renumber(s);
    }
  }
  let detached = 0;
  for (const it of allItems(level)) {
    if (it.dependsOn.includes(key)) {
      it.dependsOn = it.dependsOn.filter((d) => d !== key);
      detached++;
    }
  }
  return detached;
}

export function moveWithin(stage: Stage, index: number, delta: -1 | 1): void {
  const target = index + delta;
  if (target < 0 || target >= stage.items.length) return;
  const [it] = stage.items.splice(index, 1);
  stage.items.splice(target, 0, it);
  renumber(stage);
}

/** Chuyển đầu việc sang giai đoạn khác trong cùng Level; hạn được kéo vào trong khoảng của giai đoạn đích */
export function moveToStage(level: StageOwner, key: string, targetKey: string): void {
  const from = level.stages.find((s) => s.items.some((i) => i.key === key));
  const to = level.stages.find((s) => s.key === targetKey);
  if (!from || !to || from === to) return;
  const idx = from.items.findIndex((i) => i.key === key);
  const [it] = from.items.splice(idx, 1);
  it.dueOffset = Math.min(Math.max(it.dueOffset, to.offsetStart), to.offsetEnd);
  to.items.push(it);
  renumber(from);
  renumber(to);
}

/** Đổi mã: tính là bỏ mục cũ + thêm mục mới khi phân loại thay đổi; phụ thuộc trỏ tới mã cũ được cập nhật */
export function renameKey(level: StageOwner, oldKey: string, newKey: string): void {
  for (const it of allItems(level)) {
    if (it.key === oldKey) it.key = newKey;
    it.dependsOn = it.dependsOn.map((d) => (d === oldKey ? newKey : d));
  }
}

/** Bật GPP thì tự bật Bắt buộc, tắt Cho phép N/A (mục 7.3) */
export function setGpp(item: Item, on: boolean): void {
  item.gpp = on;
  if (on) {
    item.required = true;
    item.allowNa = false;
  }
}

/** Chia đều hạn trong giai đoạn theo thứ tự: d_i = a + round((b − a) × i / n) (mục 7.1) */
export function spreadDue(stage: Stage): void {
  const n = stage.items.length;
  stage.items.forEach((it, i) => (it.dueOffset = stage.offsetStart + Math.round(((stage.offsetEnd - stage.offsetStart) * (i + 1)) / n)));
}

export function addStage(level: StageOwner): Stage {
  const last = level.stages.at(-1);
  const start = last?.offsetEnd ?? 0;
  const n = Math.max(0, ...level.stages.map((s) => Number(s.key.split('-S')[1]) || 0)) + 1;
  const cht = isChtOwner(level);
  const stage: Stage = {
    key: `${prefixOf(level)}-S${n}`,
    order: level.stages.length + 1,
    name: '',
    label: cht ? chtDayLabel(start) : `Giai đoạn ${level.stages.length + 1}`,
    offsetStart: start,
    // Checklist CHT: mỗi giai đoạn là một ngày, không ký cuối giai đoạn
    offsetEnd: cht ? start + 1 : Math.max(start + 1, Math.min(start + 7, level.totalDays)),
    goal: '',
    signers: cht ? [] : ['cht'],
    items: [],
  };
  if (cht && stage.offsetEnd > level.totalDays) level.totalDays = stage.offsetEnd;
  level.stages.push(stage);
  return stage;
}

/** Không cho xóa giai đoạn còn đầu việc (mục 7.3) */
export function removeStage(level: StageOwner, key: string): boolean {
  const idx = level.stages.findIndex((s) => s.key === key);
  if (idx < 0 || level.stages[idx].items.length) return false;
  level.stages.splice(idx, 1);
  level.stages.forEach((s, i) => (s.order = i + 1));
  return true;
}
