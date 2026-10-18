import { addDays, diffDays, type IsoDate } from '../dates';
import type { Level, Stage } from '../schemas/version';

/**
 * Bộ tính lịch (mục 10.2). Mọi mốc tính từ ngày bắt đầu lượt Level S của từng NV:
 * mở giai đoạn = S + a, kết thúc = S + b, hạn đầu việc = S + d.
 */

export interface PlannedTask {
  itemKey: string;
  stageKey: string;
  openDate: IsoDate;
  dueDate: IsoDate;
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

export function stageWindow(stage: Pick<Stage, 'offsetStart' | 'offsetEnd'>, startDate: IsoDate) {
  return { from: addDays(startDate, stage.offsetStart), to: addDays(startDate, stage.offsetEnd) };
}

/** Kết thúc dự kiến khi chưa có tạm dừng, gia hạn. */
export function plannedEnd(level: Pick<Level, 'totalDays'>, startDate: IsoDate): IsoDate {
  return addDays(startDate, level.totalDays);
}

/** Số ngày kể từ ngày bắt đầu: 0 là ngày đầu tiên, âm khi lượt chưa bắt đầu. Hiển thị "ngày thứ" = giá trị + 1. */
export function dayIndex(startDate: IsoDate, today: IsoDate): number {
  return diffDays(today, startDate);
}

/** Giai đoạn đang diễn ra; −1 khi lượt chưa bắt đầu. Qua hết giai đoạn cuối thì vẫn trả giai đoạn cuối. */
export function currentStageIndex(level: Pick<Level, 'stages'>, startDate: IsoDate, today: IsoDate): number {
  const day = dayIndex(startDate, today);
  if (day < 0) return -1;
  const idx = level.stages.findIndex((s) => day < s.offsetEnd);
  return idx === -1 ? level.stages.length - 1 : idx;
}
