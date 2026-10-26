import { ref } from 'vue';

/** Chế độ giao diện chọn tay (mục 15.1): mặc định Sáng; "Theo máy" thì đi theo prefers-color-scheme */
export type ThemePref = 'light' | 'dark' | 'system';

/** Khóa lưu lựa chọn; index.html đọc cùng khóa này để đặt chế độ trước khi trang hiện, tránh nháy màu */
const KEY = 'lotrinh-theme';

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'system' ? v : 'light';
  } catch {
    return 'light';
  }
}

function apply(pref: ThemePref) {
  if (pref === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', pref);
}

const pref = ref<ThemePref>(read());

export function useTheme() {
  return {
    pref,
    set(value: ThemePref) {
      pref.value = value;
      apply(value);
      try {
        localStorage.setItem(KEY, value);
      } catch {
        // Trình duyệt chặn lưu trữ: vẫn đổi được trong phiên này
      }
    },
  };
}
