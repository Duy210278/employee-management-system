import { addDays, diffDays, type IsoDate } from '../dates';
import type { Level, Stage } from '../schemas/version';

/**
 * Bộ tính lịch (mục 10.2). Mọi mốc tính từ ngày bắt đầu lượt Level S của từng NV:
 * mở giai đoạn = S + a, kết thúc = S + b, hạn đầu việc = S + d.
 * Tạm dừng [P1, P2] (đã duyệt): mọi mốc ≥ P1 cộng thêm (P2 − P1 + 1) ngày.
 */

export interface PlannedTask {
  itemKey: string;
  stageKey: string;
  openDate: IsoDate;
  dueDate: IsoDate;
}

/** Một lần tạm dừng đã duyệt, tính cả hai đầu */
export interface PauseSpan {
  from: IsoDate;
  to: IsoDate;
}

export const pauseLength = (p: PauseSpan): number => diffDays(p.to, p.from) + 1;

/** Lùi một mốc theo các lần tạm dừng (mục 10.2). Xét theo thứ tự thời gian vì mốc đã lùi có thể rơi vào lần dừng sau */
export function shiftByPauses(date: IsoDate, pauses: readonly PauseSpan[]): IsoDate {
  let d = date;
  for (const p of [...pauses].sort((a, b) => a.from.localeCompare(b.from))) {
    if (d >= p.from) d = addDays(d, pauseLength(p));
  }
  return d;
}

/** Sinh lịch toàn bộ đầu việc của Level; kết quả được lưu cứng khi tạo lượt (mục 9.2). */
export function planRunTasks(level: Level, startDate: IsoDate): PlannedTask[] {
  return level.stages.flatMap((stage) =>
    stage.items.map((item) => ({
      itemKey: item.key,
      stageKey: stage.key,
      openDate: addDays(startDate, stage.offsetStart),
      dueDate: addDays(startDate, item.dueOffset),
    })),
  );
}

export function stageWindow(stage: Pick<Stage, 'offsetStart' | 'offsetEnd'>, startDate: IsoDate, pauses: readonly PauseSpan[] = []) {
  return {
    from: shiftByPauses(addDays(startDate, stage.offsetStart), pauses),
    to: shiftByPauses(addDays(startDate, stage.offsetEnd), pauses),
  };
}

/** Kết thúc dự kiến khi chưa có tạm dừng, gia hạn. */
export function plannedEnd(level: Pick<Level, 'totalDays'>, startDate: IsoDate): IsoDate {
  return addDays(startDate, level.totalDays);
}

/** Số ngày tạm dừng đã trôi qua trước `today` (không tính hôm nay) */
function pausedDaysBefore(startDate: IsoDate, today: IsoDate, pauses: readonly PauseSpan[]): number {
  const last = addDays(today, -1);
  let n = 0;
  for (const p of pauses) {
    const from = p.from > startDate ? p.from : startDate;
    const to = p.to < last ? p.to : last;
    if (to >= from) n += diffDays(to, from) + 1;
  }
  return n;
}

/**
 * Số ngày kể từ ngày bắt đầu: 0 là ngày đầu tiên, âm khi lượt chưa bắt đầu. Hiển thị "ngày thứ" = giá trị + 1.
 * Ngày tạm dừng không được tính; trong lúc dừng, số ngày đứng yên.
 */
export function dayIndex(startDate: IsoDate, today: IsoDate, pauses: readonly PauseSpan[] = []): number {
  const raw = diffDays(today, startDate);
  return raw < 0 ? raw : raw - pausedDaysBefore(startDate, today, pauses);
}

/** Lần tạm dừng chứa `today`, nếu có */
export function activePause(today: IsoDate, pauses: readonly PauseSpan[]): PauseSpan | null {
  return pauses.find((p) => p.from <= today && today <= p.to) ?? null;
}

/** Giai đoạn đang diễn ra; −1 khi lượt chưa bắt đầu. Qua hết giai đoạn cuối thì vẫn trả giai đoạn cuối. */
export function currentStageIndex(level: Pick<Level, 'stages'>, startDate: IsoDate, today: IsoDate, pauses: readonly PauseSpan[] = []): number {
  const day = dayIndex(startDate, today, pauses);
  if (day < 0) return -1;
  const idx = level.stages.findIndex((s) => day < s.offsetEnd);
  return idx === -1 ? level.stages.length - 1 : idx;
}
