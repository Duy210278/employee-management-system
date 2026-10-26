import { onBeforeUnmount, shallowRef, watchEffect } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

export interface Crumb {
  label: string;
  to: RouteLocationRaw;
}

/** Phần dải tiêu đề trang tự đặt khi cần nội dung động (tên NV, mã phiên bản); còn lại lấy từ meta của route */
export interface PageHeaderOverride {
  title?: string;
  desc?: string;
  /** Các trang cha; trang hiện tại (title) tự nối vào cuối */
  crumbs?: Crumb[];
}

const state = shallowRef<{ owner: symbol; value: PageHeaderOverride } | null>(null);

/** Dải tiêu đề đọc phần ghi đè của trang đang mở */
export const pageHeaderOverride = () => state.value?.value ?? null;

/**
 * Trang gọi trong setup để đặt tiêu đề, mô tả, đường dẫn động.
 * Gỡ ở onBeforeUnmount: trang cũ gỡ xong trang mới mới chạy setup, nên không xóa nhầm của nhau.
 */
export function usePageHeader(fn: () => PageHeaderOverride | null) {
  const owner = Symbol('page');
  watchEffect(() => {
    const value = fn();
    state.value = value ? { owner, value } : state.value?.owner === owner ? null : state.value;
  });
  onBeforeUnmount(() => {
    if (state.value?.owner === owner) state.value = null;
  });
}
