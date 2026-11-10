import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ROLE_LABEL, type RegisterBodyT, type RegisterOptions } from '@lotrinh/shared';
import bcrypt from 'bcryptjs';
import { and, asc, eq } from 'drizzle-orm';
import type { Response } from 'express';
import { ClockService } from '../../adapters/clock/clock.service';
import { badRequest, conflict, forbidden, unauthorized } from '../../common/errors';
import { SESSION_COOKIE, SESSION_HOURS } from '../../common/session';
import { DB } from '../../db/db.provider';
import type { Db } from '../../db/client';
import { areas, credentials, stores, users } from '../../db/schema';
import { logUserChanges } from '../audit/user-changes';
import { NotificationsService } from '../notifications/notifications.service';

const INACTIVE_MESSAGE: Record<string, string> = {
  pending: 'Tài khoản đang chờ BP Đào tạo duyệt',
  locked: 'Tài khoản đang bị tạm khóa. Liên hệ BP Đào tạo',
  left: 'Tài khoản đã ngừng hoạt động',
  rejected: 'Đăng ký tài khoản đã bị từ chối',
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwt: JwtService,
    private readonly clock: ClockService,
    private readonly notifications: NotificationsService,
  ) {}

  async verifyPassword(email: string, password: string) {
    const [row] = await this.db
      .select({ user: users, hash: credentials.passwordHash })
      .from(users)
      .leftJoin(credentials, eq(credentials.userId, users.id))
      .where(eq(users.email, email));
    if (!row?.hash || !(await bcrypt.compare(password, row.hash))) {
      throw unauthorized('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
    }
    this.assertActive(row.user.status, row.user.reviewNote);
    return row.user;
  }

  async findActiveUser(userId: number) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw unauthorized('INVALID_CREDENTIALS', 'Không tìm thấy tài khoản');
    this.assertActive(user.status, user.reviewNote);
    return user;
  }

  /** Tài khoản chờ duyệt có mã riêng để giao diện chuyển sang màn "Đang chờ duyệt" (mục 5.1) */
  assertActive(status: string, reviewNote?: string | null): void {
    if (status === 'active') return;
    if (status === 'pending') throw forbidden('ACCOUNT_PENDING', INACTIVE_MESSAGE.pending);
    const reason = status === 'rejected' && reviewNote ? `: ${reviewNote}. Liên hệ BP Đào tạo` : '';
    throw forbidden('ACCOUNT_INACTIVE', `${INACTIVE_MESSAGE[status] ?? 'Tài khoản không hoạt động'}${reason}`);
  }

  async startSession(res: Response, userId: number): Promise<void> {
    const token = await this.jwt.signAsync({ sub: userId });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_HOURS * 3600 * 1000,
    });
  }

  endSession(res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  /** Danh mục cho form đăng ký: chọn từ danh mục, không nhập chữ tự do (mục 5.5) */
  async registerOptions(): Promise<RegisterOptions> {
    const [areaRows, storeRows] = await Promise.all([
      this.db.select({ id: areas.id, name: areas.name }).from(areas).where(eq(areas.active, true)).orderBy(asc(areas.name)),
      this.db
        .select({ id: stores.id, name: stores.name, areaId: stores.areaId, areaName: areas.name })
        .from(stores)
        .innerJoin(areas, eq(areas.id, stores.areaId))
        .where(and(eq(stores.active, true), eq(areas.active, true)))
        .orderBy(asc(stores.name)),
    ]);
    return { areas: areaRows, stores: storeRows };
  }

  /** Đăng ký (mục 5.1): tạo tài khoản "Chờ duyệt", báo BP Đào tạo (mục 10.6, T-U01) */
  async register(body: RegisterBodyT): Promise<{ id: number }> {
    const [byEmail] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, body.email));
    if (byEmail) throw conflict('EMAIL_TAKEN', 'Email này đã được đăng ký. Đăng nhập, hoặc liên hệ BP Đào tạo nếu quên mật khẩu');
    const [byCode] = await this.db.select({ id: users.id }).from(users).where(eq(users.employeeCode, body.employeeCode));
    if (byCode) throw conflict('EMPLOYEE_CODE_TAKEN', 'Mã nhân viên này đã có tài khoản. Liên hệ BP Đào tạo');

    let storeId: number | null = null;
    let areaId: number | null = null;
    if (body.requestedRole !== 'qlkv') {
      const [store] = await this.db.select().from(stores).where(and(eq(stores.id, body.storeId!), eq(stores.active, true)));
      if (!store) throw badRequest('STORE_NOT_FOUND', 'Nhà thuốc không tồn tại hoặc đã ngừng hoạt động');
      storeId = store.id;
      areaId = store.areaId;
    } else {
      const [area] = await this.db.select().from(areas).where(and(eq(areas.id, body.areaId!), eq(areas.active, true)));
      if (!area) throw badRequest('AREA_NOT_FOUND', 'Khu vực không tồn tại hoặc đã ngừng hoạt động');
      areaId = area.id;
    }

    const hash = await bcrypt.hash(body.password, 10);
    const now = await this.clock.now();
    const user = await this.db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          fullName: body.fullName,
          employeeCode: body.employeeCode,
          email: body.email,
          phone: body.phone || null,
          role: body.requestedRole,
          status: 'pending',
          requestedRole: body.requestedRole,
          requestedStoreId: storeId,
          requestedAreaId: areaId,
        })
        .returning();
      await tx.insert(credentials).values({ userId: u.id, passwordHash: hash });
      await logUserChanges(tx, [{ userId: u.id, changedBy: u.id, field: 'registered', newValue: `Đăng ký vai trò ${ROLE_LABEL[body.requestedRole]}`, at: now }]);
      return u;
    });

    await this.notifications.notify(await this.notifications.activeIds({ role: 'bp' }), {
      type: 'registration',
      title: `Đăng ký tài khoản mới: ${user.fullName}`,
      body: `${ROLE_LABEL[body.requestedRole]} · ${user.email}`,
      link: `/quan-tri/tai-khoan/${user.id}`,
    });
    return { id: user.id };
  }
}
