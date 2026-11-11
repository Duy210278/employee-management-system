import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { MeResponse, TodayResponse } from '@lotrinh/shared';
import { and, eq } from 'drizzle-orm';
import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Db } from '../src/db/client';
import { DB } from '../src/db/db.provider';
import { auditLogs, staff, stores, users } from '../src/db/schema';
import { JobsService } from '../src/modules/jobs/jobs.service';
import { API, setupApp, type TestApp } from './helpers';

// Cấu hình được đọc lúc nạp module nên phải đặt trước mọi import
const DIRECTORY_PORT = vi.hoisted(() => {
  const port = 45000 + Math.floor(Math.random() * 1000);
  Object.assign(process.env, {
    AUTH_MODE: 'external',
    HOST_AUTH_MODE: 'jwt',
    HOST_COOKIE_NAME: 'hostsid',
    HOST_JWT_SECRET: 'khoa-thu-cua-web-a-0123456789',
    HOST_LOGIN_URL: 'http://web-a.test/dang-nhap',
    HOST_LOGOUT_URL: 'http://web-a.test/dang-xuat',
    HOST_DIRECTORY_URL: `http://127.0.0.1:${port}/api/directory`,
  });
  return port;
});

const SECRET = new TextEncoder().encode('khoa-thu-cua-web-a-0123456789');
let tokenSeq = 0;
/** Cookie dùng chung do "Web A" ký; mỗi lần ký là một cookie mới (như đăng nhập lại) */
const hostToken = (claims: Record<string, unknown>, secret = SECRET) =>
  new SignJWT({ active: true, ...claims, n: ++tokenSeq }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);

const LAN = { sub: 'a-lan', employeeCode: 'NV201', name: 'Nguyễn Thị Lan', email: 'lan@upharma.local', titles: ['NVBH'] };
const HA = { sub: 'a-ha', employeeCode: 'CH001', name: 'Phạm Thu Hà', email: 'ha@upharma.local', titles: ['CHT'], stores: ['NTA'] };

/** Trình duyệt giả: giữ cookie lt_session do module cấp, gửi kèm cookie Web A */
class Browser {
  session: string | null = null;
  constructor(
    private readonly harness: TestApp,
    public host: string | null,
  ) {}
  private cookie() {
    return [this.host && `hostsid=${this.host}`, this.session && `lt_session=${this.session}`].filter(Boolean).join('; ');
  }
  private keep(res: request.Response) {
    const set = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    for (const c of set) {
      const m = /^lt_session=([^;]*)/.exec(c);
      if (m) this.session = m[1] || null;
    }
    return res;
  }
  async get(path: string) {
    return this.keep(await this.harness.anonymous().get(`${API}${path}`).set('Cookie', this.cookie()));
  }
  async post(path: string, body: object = {}, origin: string | null = 'same') {
    const addr = this.harness.app.getHttpServer().address() as AddressInfo | null;
    const req = this.harness.anonymous().post(`${API}${path}`).set('Cookie', this.cookie());
    if (origin === 'same') req.set('Origin', `http://127.0.0.1:${addr?.port}`).set('Host', `127.0.0.1:${addr?.port}`);
    else if (origin) req.set('Origin', origin);
    return this.keep(await req.send(body));
  }
}

let harness: TestApp;
let db: Db;
let directory: Record<string, unknown>[] = [];
let directoryServer: http.Server;

beforeAll(async () => {
  directoryServer = http.createServer((_req, res) => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(directory)));
  await new Promise<void>((ok) => directoryServer.listen(DIRECTORY_PORT, '127.0.0.1', ok));
  harness = await setupApp();
  await harness.app.listen(0, '127.0.0.1');
  db = harness.app.get<Db>(DB);
});
afterAll(async () => {
  await harness.close();
  await new Promise((ok) => directoryServer.close(ok));
});

describe('đăng nhập qua cookie dùng chung của Web A', () => {
  it('cấu hình cho giao diện; không có cookie Web A → 401 SSO_REQUIRED; đăng nhập riêng không còn', async () => {
    expect((await harness.anonymous().get(`${API}/auth/config`).expect(200)).body).toEqual({
      authMode: 'external',
      loginUrl: 'http://web-a.test/dang-nhap',
      logoutUrl: 'http://web-a.test/dang-xuat',
    });
    const res = await new Browser(harness, null).get('/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SSO_REQUIRED');
    const anon = new Browser(harness, null);
    expect((await anon.post('/auth/login', { email: 'lan@upharma.local', password: 'Demo@123' })).status).toBe(404);
    expect((await anon.post('/demo/login-as', { userId: 1 })).status).toBe(404);
    // Thiếu Origin thì bị chặn CSRF trước cả khi tới route
    expect((await anon.post('/auth/login', {}, null)).status).toBe(403);
  });

  it('cookie ký sai khóa → 401 SSO_INVALID', async () => {
    const res = await new Browser(harness, await hostToken(LAN, new TextEncoder().encode('khoa-gia-mao-0123456789'))).get('/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SSO_INVALID');
  });

  it('Lan bấm tab: khớp tài khoản sẵn có theo mã NV, thấy đúng checklist của mình; phiên module dùng lại, không đồng bộ lại', async () => {
    const lan = new Browser(harness, await hostToken(LAN));
    const today = (await lan.get('/me/today')).body as TodayResponse;
    expect(today.staff?.fullName).toBe('Nguyễn Thị Lan');
    expect(today.run?.levelKey).toBe(1);
    expect(lan.session).toBeTruthy();
    const [row] = await db.select().from(users).where(eq(users.employeeCode, 'NV201'));
    expect(row).toMatchObject({ externalId: 'a-lan', role: 'nv', status: 'active' });
    const before = (await db.select().from(auditLogs).where(eq(auditLogs.action, 'auth.sso'))).length;
    expect(((await lan.get('/me')).body as MeResponse).user.fullName).toBe('Nguyễn Thị Lan');
    expect((await db.select().from(auditLogs).where(eq(auditLogs.action, 'auth.sso'))).length).toBe(before);
  });

  it('người mới ở Web A: tự tạo tài khoản và gắn hồ sơ nhân viên cùng mã → thấy ngay lộ trình', async () => {
    const [nta] = await db.select().from(stores).where(eq(stores.code, 'NTA'));
    await db.insert(staff).values({ fullName: 'Đỗ Văn Mới', employeeCode: 'NV901', storeId: nta!.id, hireDate: harness.today });
    const moi = new Browser(harness, await hostToken({ sub: 'a-moi', employeeCode: 'NV901', name: 'Đỗ Văn Mới', titles: ['NVBH'] }));
    const me = (await moi.get('/me')).body as MeResponse;
    expect(me.user).toMatchObject({ fullName: 'Đỗ Văn Mới', role: 'nv', email: null });
    const [st] = await db.select().from(staff).where(eq(staff.employeeCode, 'NV901'));
    expect(st!.userId).toBe(me.user.id);
    expect(me.staffId).toBe(st!.id);
  });

  it('đổi chức danh và cửa hàng ở Web A (Lan lên CHT Nhà thuốc B) → lần vào sau cập nhật vai trò, phạm vi, có lịch sử', async () => {
    const lan = new Browser(harness, await hostToken({ ...LAN, titles: ['CHT'], stores: ['NTB'] }));
    const me = (await lan.get('/me')).body as MeResponse;
    expect(me.user.role).toBe('cht');
    const admin = new Browser(harness, await hostToken({ sub: 'a-admin', employeeCode: 'BP001', name: 'Ngô Quốc Bảo', titles: ['DAO_TAO'] }));
    const detail = (await admin.get(`/users/${me.user.id}`)).body as { user: { stores: { name: string }[] }; history: { field: string; newValue: string | null }[] };
    expect(detail.user.stores.map((s) => s.name)).toEqual(['Nhà thuốc B']);
    expect(detail.history.find((h) => h.field === 'role')?.newValue).toBe('Cửa hàng trưởng');
  });

  it('đổi người ở Web A trên cùng trình duyệt → phiên module đổi theo, không thấy dữ liệu người trước', async () => {
    const browser = new Browser(harness, await hostToken(LAN));
    expect(((await browser.get('/me')).body as MeResponse).user.fullName).toBe('Nguyễn Thị Lan');
    browser.host = await hostToken(HA);
    expect(((await browser.get('/me')).body as MeResponse).user.fullName).toBe('Phạm Thu Hà');
    browser.host = null;
    expect((await browser.get('/me')).status).toBe(401);
  });

  it('chức danh không có quyền → 403 NO_MODULE_ACCESS; nghỉ việc ở Web A → 403 và tài khoản chuyển Đã nghỉ', async () => {
    const ketoan = await new Browser(harness, await hostToken({ sub: 'a-kt', employeeCode: 'KT001', name: 'Kế Toán', titles: ['KE_TOAN'] })).get('/me');
    expect(ketoan.status).toBe(403);
    expect(ketoan.body.code).toBe('NO_MODULE_ACCESS');
    expect(await db.select().from(users).where(eq(users.employeeCode, 'KT001'))).toHaveLength(0);
    const tuan = await new Browser(harness, await hostToken({ sub: 'a-tuan', employeeCode: 'NV202', name: 'Phạm Minh Tuấn', titles: ['NVBH'], active: false })).get('/me');
    expect(tuan.status).toBe(403);
    expect((await db.select().from(users).where(eq(users.employeeCode, 'NV202')))[0]!.status).toBe('left');
  });

  it('chống CSRF: lệnh ghi không có Origin của chính trang bị chặn', async () => {
    const ha = new Browser(harness, await hostToken(HA));
    await ha.get('/me');
    const noOrigin = await ha.post('/me/notifications/read', { all: true }, null);
    expect(noOrigin.status).toBe(403);
    expect(noOrigin.body.code).toBe('CSRF');
    expect((await ha.post('/me/notifications/read', { all: true }, 'http://trang-la.test')).status).toBe(403);
    expect((await ha.post('/me/notifications/read', { all: true })).status).toBe(200);
  });

  it('đăng xuất: xóa phiên module, trả địa chỉ đăng xuất của Web A', async () => {
    const ha = new Browser(harness, await hostToken(HA));
    await ha.get('/me');
    const res = await ha.post('/auth/logout');
    expect(res.body).toEqual({ ok: true, logoutUrl: 'http://web-a.test/dang-xuat' });
    expect(ha.session).toBeNull();
  });
});

describe('đồng bộ hàng loạt từ danh sách nhân sự Web A', () => {
  it('người chưa từng mở module được tạo kèm phạm vi; người đã đồng bộ mà không còn trong danh sách chuyển Đã nghỉ', async () => {
    directory = [
      { sub: 'a-ha', employeeCode: 'CH001', name: 'Phạm Thu Hà', titles: ['CHT'], stores: ['NTA'], active: true },
      { sub: 'a-qlkv2', employeeCode: 'QL009', name: 'Trần Khu Vực', titles: ['QLKV'], areas: ['HN1'], active: true },
      { sub: 'a-buddy', employeeCode: 'NV909', name: 'Lê Kèm Cặp', titles: ['NVBH'], canBuddy: true, active: true },
      { sub: 'a-kt', employeeCode: 'KT001', name: 'Kế Toán', titles: ['KE_TOAN'], active: true },
    ];
    const result = await harness.app.get(JobsService).run('host-sync');
    expect(result.message).toMatch(/^4 người: thêm 2, cập nhật 1, chuyển nghỉ \d+, bỏ qua 1$/);
    const [ql] = await db.select().from(users).where(eq(users.employeeCode, 'QL009'));
    expect(ql).toMatchObject({ role: 'qlkv', status: 'active', externalId: 'a-qlkv2' });
    expect((await db.select().from(users).where(eq(users.employeeCode, 'NV909')))[0]).toMatchObject({ role: 'nv', canBuddy: true });
    // Lan và Đỗ Văn Mới đã đồng bộ khi vào module nhưng không có trong danh sách → Đã nghỉ
    const gone = await db.select({ code: users.employeeCode, status: users.status }).from(users).where(and(eq(users.status, 'left')));
    expect(gone.map((g) => g.code)).toEqual(expect.arrayContaining(['NV201', 'NV901']));
    // Tài khoản nội bộ chưa từng đồng bộ (không có external_id) không bị đụng
    expect((await db.select().from(users).where(eq(users.employeeCode, 'NV203')))[0]!.status).toBe('active');
  });
});
