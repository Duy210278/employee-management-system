import type { Item, Level, Stage } from '@lotrinh/shared';

/**
 * Thao tác trên nội dung checklist khi soạn (mục 7.3). Sửa trực tiếp đối tượng reactive của bản nháp.
 * Mảng items trong giai đoạn là thứ tự hiển thị; trường order luôn được đánh lại theo vị trí.
 */

export const renumber = (stage: Stage) => stage.items.forEach((it, i) => (it.order = i + 1));

/** Ô số luôn ra số nguyên (ô trống không được thành chuỗi rỗng, vì schema yêu cầu số) */
export const intOf = (e: Event, fallback = 0): number => {
  const n = parseInt((e.target as HTMLInputElement).value, 10);
  return Number.isFinite(n) ? n : fallback;
};
export const optIntOf = (e: Event): number | undefined => {
  const n = parseInt((e.target as HTMLInputElement).value, 10);
  return Number.isFinite(n) ? n : undefined;
};

const allItems = (level: Level) => level.stages.flatMap((s) => s.items);

/** Mã mới không trùng: L{level}-{thứ tự giai đoạn}-{số kế tiếp} */
export function nextItemKey(level: Level, stage: Stage): string {
  const prefix = `L${level.key}-${stage.order}-`;
  const used = new Set(allItems(level).map((i) => i.key));
  let n = Math.max(0, ...stage.items.map((i) => Number(i.key.startsWith(prefix) ? i.key.slice(prefix.length) : 0) || 0)) + 1;
  while (used.has(prefix + n)) n++;
  return prefix + n;
}

export function addItem(level: Level, stage: Stage): Item {
  const last = stage.items.at(-1);
  const item: Item = {
    key: nextItemKey(level, stage),
    order: stage.items.length + 1,
    category: last?.category ?? '',
    content: '',
    guidance: '',
    verifiers: [level.key === 1 ? 'buddy' : 'cht'],
    requireNvFirst: true,
    dueOffset: stage.offsetEnd,
    gpp: false,
    required: true,
    allowNa: true,
    dataSource: 'manual',
    evidence: 'none',
    dependsOn: [],
  };
  stage.items.push(item);
  return item;
}

/** Xóa đầu việc và tự gỡ các phụ thuộc trỏ tới mã đó; trả về số mục đã gỡ phụ thuộc */
export function removeItem(level: Level, key: string): number {
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
export function moveToStage(level: Level, key: string, targetKey: string): void {
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
export function renameKey(level: Level, oldKey: string, newKey: string): void {
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

export function addStage(level: Level): Stage {
  const last = level.stages.at(-1);
  const start = last?.offsetEnd ?? 0;
  const n = Math.max(0, ...level.stages.map((s) => Number(s.key.split('-S')[1]) || 0)) + 1;
  const stage: Stage = {
    key: `L${level.key}-S${n}`,
    order: level.stages.length + 1,
    name: '',
    label: `Giai đoạn ${level.stages.length + 1}`,
    offsetStart: start,
    offsetEnd: Math.max(start + 1, Math.min(start + 7, level.totalDays)),
    goal: '',
    signers: ['cht'],
    items: [],
  };
  level.stages.push(stage);
  return stage;
}

/** Không cho xóa giai đoạn còn đầu việc (mục 7.3) */
export function removeStage(level: Level, key: string): boolean {
  const idx = level.stages.findIndex((s) => s.key === key);
  if (idx < 0 || level.stages[idx].items.length) return false;
  level.stages.splice(idx, 1);
  level.stages.forEach((s, i) => (s.order = i + 1));
  return true;
}
