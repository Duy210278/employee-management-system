/** Vai trò tài khoản (mục 3.1): quyết định chức năng được dùng. */
export const ACCOUNT_ROLES = ['nv', 'cht', 'qlkv', 'bp'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

/** Vai trò trên một đầu việc: gồm cả Buddy, vốn là vai trò phân công chứ không phải tài khoản. */
export const TASK_ROLES = ['nv', 'buddy', 'cht', 'qlkv', 'bp'] as const;
export type TaskRole = (typeof TASK_ROLES)[number];

/** Vai trò phân công trên lượt Level (bảng run_assignments). */
export const ASSIGNMENT_ROLES = ['buddy', 'cht', 'qlkv'] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

export const ROLE_LABEL: Record<TaskRole, string> = {
  nv: 'Nhân viên',
  buddy: 'Buddy',
  cht: 'Cửa hàng trưởng',
  qlkv: 'QLKV',
  bp: 'BP Đào tạo',
};

export const ROLE_SHORT: Record<TaskRole, string> = {
  nv: 'NV',
  buddy: 'Buddy',
  cht: 'CHT',
  qlkv: 'QLKV',
  bp: 'BP ĐT',
};

export const USER_STATUSES = ['pending', 'active', 'locked', 'left', 'rejected'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  pending: 'Chờ duyệt',
  active: 'Hoạt động',
  locked: 'Tạm khóa',
  left: 'Đã nghỉ',
  rejected: 'Bị từ chối',
};

export const ASSIGNMENT_LABEL: Record<AssignmentRole, string> = { buddy: 'Buddy', cht: 'Cửa hàng trưởng', qlkv: 'QLKV' };

/**
 * Tài khoản còn giữ được một phân công trên lượt Level không (mục 5.4 điều 3, R20):
 * phải đang hoạt động; Buddy cần quyền "Có thể làm Buddy" hoặc là CHT; CHT, QLKV đúng vai trò tài khoản.
 */
export function canHoldAssignment(role: AssignmentRole, user: { role: AccountRole; status: UserStatus; canBuddy: boolean }): boolean {
  if (user.status !== 'active') return false;
  if (role === 'buddy') return user.canBuddy || user.role === 'cht';
  return user.role === role;
}
