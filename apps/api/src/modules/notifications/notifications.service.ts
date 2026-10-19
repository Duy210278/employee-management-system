import { Inject, Injectable, Logger } from '@nestjs/common';
import type { NotificationsResponse, RunPeople, TaskRole } from '@lotrinh/shared';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { ClockService } from '../../adapters/clock/clock.service';
import type { SessionUser } from '../../common/session';
import type { Db } from '../../db/client';
import { DB } from '../../db/db.provider';
import { notifications, users } from '../../db/schema';

export interface NotifyInput {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  /** Khóa chống trùng (mục 14.9); hệ thống gắn thêm mã người nhận */
  dedupeKey?: string;
}

/** Thông báo trong ứng dụng (mục 10.6). Bản demo chỉ có kênh trong ứng dụng */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
  ) {}

  /** Gửi tới nhiều người, bỏ qua người vừa thao tác (`except`) và giá trị rỗng; trả về số thông báo mới */
  async notify(recipients: (number | null | undefined)[], input: NotifyInput, except?: number): Promise<number> {
    const ids = [...new Set(recipients.filter((id): id is number => typeof id === 'number' && id !== except))];
    if (!ids.length) return 0;
    try {
      const [today, now] = await Promise.all([this.clock.today(), this.clock.now()]);
      const rows = await this.db
        .insert(notifications)
        .values(
          ids.map((userId) => ({
            userId,
            type: input.type,
            title: input.title,
            body: input.body ?? null,
            link: input.link ?? null,
            dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${userId}` : null,
            businessDate: today,
            createdAt: now,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: notifications.id });
      return rows.length;
    } catch (err) {
      // Thông báo không được làm hỏng thao tác nghiệp vụ đã thành công
      this.logger.error(`Không tạo được thông báo ${input.type}: ${(err as Error).message}`);
      return 0;
    }
  }

  /** Người nhận việc của một vai trò trên lượt (mục 10.5): NV chưa có tài khoản thì Buddy, rồi CHT; BP ĐT là mọi BP ĐT */
  async recipientsOf(roles: readonly TaskRole[], people: RunPeople): Promise<number[]> {
    const out: (number | null)[] = [];
    for (const role of roles) {
      if (role === 'nv') out.push(people.staffUserId ?? people.buddyId ?? people.chtId);
      else if (role === 'buddy') out.push(people.buddyId ?? people.chtId);
      else if (role === 'cht') out.push(people.chtId);
      else if (role === 'qlkv') out.push(people.qlkvId);
      else out.push(...(await this.activeIds({ role: 'bp' })));
    }
    return [...new Set(out.filter((id): id is number => id !== null))];
  }

  /** Tài khoản đang hoạt động theo vai trò, ví dụ mọi BP ĐT */
  async activeIds(where: { role?: 'bp'; canApproveVersions?: boolean }): Promise<number[]> {
    const conds = [eq(users.status, 'active')];
    if (where.role) conds.push(eq(users.role, where.role));
    if (where.canApproveVersions) conds.push(eq(users.canApproveVersions, true));
    return (await this.db.select({ id: users.id }).from(users).where(and(...conds))).map((u) => u.id);
  }

  async list(user: SessionUser, limit = 50): Promise<NotificationsResponse> {
    const rows = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      // Theo thứ tự nhận; thời điểm tạo theo ngày giả lập có thể nhảy lùi khi đổi ngày
      .orderBy(desc(notifications.id))
      .limit(limit);
    const [{ n }] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    return {
      unread: n,
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        link: r.link,
        businessDate: r.businessDate,
        createdAt: r.createdAt.toISOString(),
        read: r.readAt !== null,
      })),
    };
  }

  async markRead(user: SessionUser, body: { ids?: number[]; all?: boolean }): Promise<NotificationsResponse> {
    const now = await this.clock.now();
    const mine = and(eq(notifications.userId, user.id), isNull(notifications.readAt));
    if (body.all) await this.db.update(notifications).set({ readAt: now }).where(mine);
    else if (body.ids?.length) await this.db.update(notifications).set({ readAt: now }).where(and(mine, inArray(notifications.id, body.ids)));
    return this.list(user);
  }
}
