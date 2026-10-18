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
