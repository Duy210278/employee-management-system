import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability';
import type { SessionUser } from '../../common/session';

/**
 * Ma trận phân quyền mục 3.3 (phần đã có trong MVP), viết thành một file cấu hình.
 * Bước 2 của mục 14.8; bước 3 (lọc phạm vi ở truy vấn) là AccessService.staffScope, phải khớp các quy tắc dưới đây.
 */
export type Action = 'read' | 'create' | 'update' | 'approve' | 'manage';
/** User: tài khoản · Org: danh mục cửa hàng, khu vực · AuditLog: nhật ký hệ thống · Report: xuất CSV */
export type SubjectName = 'Staff' | 'StaffList' | 'Clock' | 'DemoData' | 'Version' | 'Settings' | 'User' | 'Org' | 'AuditLog' | 'Report' | 'all';

/** Cấu hình hệ thống ảnh hưởng tới quyền */
export interface AbilityFlags {
  /** V20: BP Đào tạo tự duyệt và ban hành phiên bản */
  bpSelfPublish: boolean;
}

/** Bản ghi dùng để xét quyền trên một hồ sơ NV / lượt Level */
export interface StaffRecord {
  userId: number | null;
  storeId: number;
  areaId: number;
  buddyId: number | null;
  chtId: number | null;
  qlkvId: number | null;
}

export type AppAbility = MongoAbility<[Action, SubjectName | (StaffRecord & { __caslSubjectType__: 'Staff' })]>;

export interface UserScopes {
  storeIds: number[];
  areaIds: number[];
}

export function defineAbilityFor(user: SessionUser, scopes: UserScopes, flags: AbilityFlags = { bpSelfPublish: false }): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  switch (user.role) {
    case 'bp':
      // BP Đào tạo là quản trị viên: toàn chuỗi; chỉ BP ĐT soạn, sửa Khung năng lực và Checklist, gửi duyệt, rút về
      can('manage', 'all');
      // Duyệt và ban hành mặc định tách khỏi người soạn; bật "BP ĐT tự ban hành" (V20) thì BP ĐT tự duyệt được
      if (!user.canApproveVersions && !flags.bpSelfPublish) cannot('approve', 'Version');
      break;
    case 'qlkv':
      can(['read'], ['StaffList', 'Report']);
      // QLKV duyệt đề xuất tạm dừng của CHT trong khu vực (mục 9.3)
      can(['read', 'create', 'update', 'approve'], 'Staff', { areaId: { $in: scopes.areaIds } });
      break;
    case 'cht':
      can(['read'], ['StaffList', 'Report']);
      can(['read', 'create', 'update'], 'Staff', { storeId: { $in: scopes.storeIds } });
      break;
    case 'nv':
      break;
  }

  // Ai cũng xem được hồ sơ của chính mình và các lượt mình được phân công (Buddy ◐, CHT/QLKV phụ trách)
  can('read', 'Staff', { userId: user.id });
  can('read', 'Staff', { buddyId: user.id });
  can('read', 'Staff', { chtId: user.id });
  can('read', 'Staff', { qlkvId: user.id });
  can('read', 'Clock');
  // Quyền bổ sung "Người duyệt phiên bản" (mục 3.2): xem và duyệt bản chờ duyệt
  if (user.canApproveVersions) {
    can('read', 'Version');
    can('approve', 'Version');
  }
  return build();
}
