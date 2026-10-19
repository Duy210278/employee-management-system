import { ROLE_LABEL, ROLE_SHORT, type TaskRole } from './roles';
import { isChtTrack, TRACK_LABEL, type Track } from './schemas/version';

/**
 * Nhãn hiển thị theo loại lộ trình: trên lượt onboarding CHT, phần "NV" là chính Cửa hàng trưởng được đào tạo,
 * phần "BP ĐT" là Đào tạo (người phụ trách check-in hằng ngày).
 */
export function roleShortFor(role: TaskRole, track: Track = 'nvbh'): string {
  if (isChtTrack(track)) {
    if (role === 'nv') return 'CHT';
    if (role === 'bp') return 'Đào tạo';
  }
  return ROLE_SHORT[role];
}

export function roleLabelFor(role: TaskRole, track: Track = 'nvbh'): string {
  if (isChtTrack(track)) {
    if (role === 'nv') return 'Cửa hàng trưởng được đào tạo';
    if (role === 'bp') return 'Đào tạo (BP ĐT)';
  }
  return ROLE_LABEL[role];
}

/** "Level 2" với lộ trình NVBH, tên loại checklist với lượt CHT */
export const runTitle = (run: { track: Track; levelKey: number }) => (isChtTrack(run.track) ? TRACK_LABEL[run.track] : `Level ${run.levelKey}`);

/** Thang chấm sao trong đánh giá tổng kết tuần đầu của CHT (file Excel BP ĐT) */
export const RATING_SCALE: { value: number; label: string }[] = [
  { value: 5, label: '⭐⭐⭐⭐⭐ Xuất sắc' },
  { value: 4, label: '⭐⭐⭐⭐ Tốt' },
  { value: 3, label: '⭐⭐⭐ Đạt yêu cầu' },
  { value: 2, label: '⭐⭐ Cần cải thiện' },
  { value: 1, label: '⭐ Yếu' },
];

export const RISK_LABEL: Record<'low' | 'medium' | 'high', string> = {
  low: '🟢 Thấp – Đang ổn định',
  medium: '🟡 Trung bình – Cần theo dõi',
  high: '🔴 Cao – Cần can thiệp ngay',
};

export const TRAINING_MODE_LABEL: Record<'online' | 'offline', string> = { online: 'Online', offline: 'Offline' };
