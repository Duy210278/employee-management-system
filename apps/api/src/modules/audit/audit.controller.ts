import { Controller, Get, Inject, Query } from '@nestjs/common';
import { isIsoDate, type AuditLogResponse } from '@lotrinh/shared';
import { and, asc, desc, eq, gte, lt, sql, type SQL } from 'drizzle-orm';
import { CurrentUser, type SessionUser } from '../../common/session';
import type { Db } from '../../db/client';
import { DB } from '../../db/db.provider';
import { auditLogs, users } from '../../db/schema';
import { AccessService } from '../access/access.service';

const PAGE_SIZE = 50;

/** Nhãn tiếng Việt cho thao tác trong nhật ký; khóa là "METHOD đường dẫn" (bỏ /api/v1) hoặc tên sự kiện */
const LABELS: [RegExp, string][] = [
  [/^auth\.login$/, 'Đăng nhập'],
  [/^auth\.login_demo$/, 'Đăng nhập nhanh (demo)'],
  [/^auth\.register$/, 'Đăng ký tài khoản'],
  [/^demo\.reset$/, 'Khôi phục dữ liệu mẫu'],
  [/^POST \/demo\/jobs\/:name\/run$/, 'Chạy job'],
  [/^POST \/tasks\/:id\/confirm$/, 'Xác nhận đầu việc'],
  [/^POST \/tasks\/confirm-many$/, 'Duyệt nhanh nhiều đầu việc'],
  [/^POST \/tasks\/:id\/undo$/, 'Hủy xác nhận'],
  [/^POST \/tasks\/:id\/rework$/, 'Yêu cầu làm lại'],
  [/^POST \/tasks\/:id\/status$/, 'Đổi trạng thái đầu việc'],
  [/^POST \/runs\/:id\/ack$/, 'Xác nhận đã đọc tổng quan'],
  [/^POST \/runs\/:id\/stages\/:stageKey\/sign$/, 'Ký cuối giai đoạn'],
  [/^POST \/runs\/:id\/pauses$/, 'Tạm dừng lượt Level'],
  [/^POST \/runs\/:id\/pauses\/:pauseId\/decision$/, 'Duyệt / từ chối tạm dừng'],
  [/^POST \/runs\/:id\/assignments$/, 'Đổi Buddy / CHT / QLKV'],
  [/^PUT \/runs\/:id\/sales\/:month$/, 'Nhập doanh số'],
  [/^POST \/runs\/:id\/observations$/, 'Ghi ca quan sát Rubric'],
  [/^PUT \/runs\/:id\/review$/, 'Lưu phiếu đánh giá'],
  [/^POST \/runs\/:id\/review\/sign$/, 'Ký phiếu đánh giá'],
  [/^POST \/staff$/, 'Thêm nhân viên'],
  [/^POST \/cht\/runs$/, 'Gán checklist CHT'],
  [/^PUT \/runs\/:id\/cht\/journal\/:day$/, 'Ghi nhật ký onboarding CHT'],
  [/^PUT \/runs\/:id\/cht\/evaluation$/, 'Lưu đánh giá tuần đầu CHT'],
  [/^POST \/runs\/:id\/cht\/evaluation\/confirm$/, 'Xác nhận tổng kết onboarding CHT'],
  [/^PUT \/runs\/:id\/cht\/meta$/, 'Ghi chú quản lý (onboarding CHT)'],
  [/^POST \/staff\/:id\/transfer$/, 'Chuyển cửa hàng'],
  [/^POST \/staff\/:id\/stop$/, 'Ngừng theo dõi nhân viên'],
  [/^DELETE \/staff\/:id$/, 'Xóa hồ sơ nhân viên'],
  [/^POST \/versions$/, 'Tạo bản nháp phiên bản'],
  [/^PUT \/versions\/:id\/content$/, 'Lưu bản nháp phiên bản'],
  [/^POST \/versions\/:id\/submit$/, 'Gửi duyệt phiên bản'],
  [/^POST \/versions\/:id\/withdraw$/, 'Rút phiên bản về nháp'],
  [/^POST \/versions\/:id\/approve$/, 'Duyệt và ban hành phiên bản'],
  // reject và settings/publishing đã bỏ, giữ nhãn để đọc nhật ký cũ
  [/^POST \/versions\/:id\/reject$/, 'Trả phiên bản về nháp'],
  [/^PUT \/versions\/:id\/effective$/, 'Đổi ngày hiệu lực phiên bản'],
  [/^DELETE \/versions\/:id$/, 'Xóa bản nháp'],
  [/^PUT \/settings\/publishing$/, 'Đổi cấu hình ban hành (V20)'],
  [/^POST \/users$/, 'Tạo tài khoản'],
  [/^PUT \/users\/:id$/, 'Sửa tài khoản'],
  [/^POST \/users\/:id\/approve$/, 'Duyệt đăng ký'],
  [/^POST \/users\/:id\/reject$/, 'Từ chối đăng ký'],
  [/^POST \/users\/import$/, 'Nhập tài khoản từ CSV'],
  [/^(POST|PUT) \/org\/areas/, 'Sửa danh mục khu vực'],
  [/^(POST|PUT) \/org\/stores/, 'Sửa danh mục cửa hàng'],
];

export function auditLabel(action: string): string {
  const key = action.replace(' /api/v1/', ' /');
  return LABELS.find(([re]) => re.test(key))?.[1] ?? action;
}

/** Nhật ký hệ thống (mục 5.7): chỉ BP ĐT xem; lọc theo người, loại thao tác, khoảng ngày; không sửa, không xóa */
@Controller('audit-logs')
export class AuditController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly access: AccessService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: SessionUser,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') pageParam?: string,
  ): Promise<AuditLogResponse> {
    await this.access.assertCan(user, 'read', 'AuditLog', 'Chỉ BP Đào tạo xem nhật ký hệ thống');
    const conds: SQL[] = [];
    if (userId && Number(userId) > 0) conds.push(eq(auditLogs.userId, Number(userId)));
    if (action) conds.push(eq(auditLogs.action, action));
    // Khoảng ngày theo giờ Việt Nam
    if (from && isIsoDate(from)) conds.push(gte(auditLogs.at, new Date(`${from}T00:00:00+07:00`)));
    if (to && isIsoDate(to)) conds.push(lt(auditLogs.at, new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86_400_000)));
    const where = conds.length ? and(...conds) : undefined;
    const page = Math.max(1, Number(pageParam) || 1);

    const [rows, [{ n }], people, actionRows] = await Promise.all([
      this.db
        .select({ l: auditLogs, userName: users.fullName })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.userId))
        .where(where)
        .orderBy(desc(auditLogs.at), desc(auditLogs.id))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
      this.db.select({ n: sql<number>`count(*)::int` }).from(auditLogs).where(where),
      this.db.selectDistinct({ id: users.id, fullName: users.fullName }).from(auditLogs).innerJoin(users, eq(users.id, auditLogs.userId)).orderBy(asc(users.fullName)),
      this.db.selectDistinct({ action: auditLogs.action }).from(auditLogs),
    ]);
    return {
      items: rows.map(({ l, userName }) => ({
        id: l.id,
        at: l.at.toISOString(),
        userId: l.userId,
        userName,
        action: l.action,
        label: auditLabel(l.action),
        entity: l.entity,
        entityId: l.entityId,
        payload: l.payload,
        ip: l.ip,
      })),
      total: n,
      page,
      pageSize: PAGE_SIZE,
      users: people,
      actions: actionRows.map((a) => ({ value: a.action, label: auditLabel(a.action) })).sort((a, b) => a.label.localeCompare(b.label, 'vi')),
    };
  }
}
