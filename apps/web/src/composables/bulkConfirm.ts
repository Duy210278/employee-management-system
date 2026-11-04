import type { TaskView } from '@lotrinh/shared';
import { inject, provide, reactive, type InjectionKey } from 'vue';

/**
 * Duyệt nhanh: các đầu việc đang chọn trên một màn hình (Hôm nay, Việc cần xử lý, Checklist).
 * Màn hình gọi provideBulk(); dòng đầu việc bên trong tự hiện ô chọn khi người dùng xác nhận được mục đó.
 */
export interface BulkSelection {
  picked: Map<number, TaskView>;
  has(id: number): boolean;
  toggle(t: TaskView): void;
  setMany(tasks: TaskView[], on: boolean): void;
  /** Dữ liệu tải lại: cập nhật rowVersion mới, bỏ chọn mục không còn xác nhận được */
  sync(t: TaskView): void;
  clear(): void;
}

const KEY: InjectionKey<BulkSelection> = Symbol('bulk-confirm');

/** Người đang xem có ô xác nhận điền được ngay ở đầu việc này */
export const canBulk = (t: TaskView) => !!t.actions.confirmAs;

export function provideBulk(): BulkSelection {
  const picked = reactive(new Map<number, TaskView>());
  const sel: BulkSelection = {
    picked,
    has: (id) => picked.has(id),
    toggle(t) {
      if (picked.has(t.id)) picked.delete(t.id);
      else if (canBulk(t)) picked.set(t.id, t);
    },
    setMany(tasks, on) {
      for (const t of tasks) {
        if (on && canBulk(t)) picked.set(t.id, t);
        else picked.delete(t.id);
      }
    },
    sync(t) {
      if (!picked.has(t.id)) return;
      if (canBulk(t)) picked.set(t.id, t);
      else picked.delete(t.id);
    },
    clear: () => picked.clear(),
  };
  provide(KEY, sel);
  return sel;
}

export function useBulk(): BulkSelection | null {
  return inject(KEY, null);
}
