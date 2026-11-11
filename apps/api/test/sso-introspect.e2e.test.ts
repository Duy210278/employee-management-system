import http from 'node:http';
import type { MeResponse } from '@lotrinh/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { API, setupApp, type TestApp } from './helpers';

// Web A dùng mã phiên ngẫu nhiên: module gọi API "người dùng hiện tại" của Web A kèm cookie
const PORT = vi.hoisted(() => {
  const port = 46000 + Math.floor(Math.random() * 1000);
  Object.assign(process.env, {
    AUTH_MODE: 'external',
    HOST_AUTH_MODE: 'introspect',
    HOST_COOKIE_NAME: 'hostsid',
    HOST_ME_URL: `http://127.0.0.1:${port}/api/me`,
    // Web A đặt tên trường khác mặc định
    HOST_CLAIM_MAP: JSON.stringify({ externalId: 'id', employeeCode: 'maNhanVien', fullName: 'hoTen', titles: 'chucDanh', storeCodes: 'cuaHang' }),
  });
  return port;
});

const SESSIONS: Record<string, Record<string, unknown>> = {
  'phien-cua-ha': { id: 77, maNhanVien: 'CH001', hoTen: 'Phạm Thu Hà', chucDanh: 'CHT', cuaHang: 'NTA' },
};
let calls = 0;
let server: http.Server;
let harness: TestApp;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    calls++;
    const sid = /hostsid=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
    const user = sid ? SESSIONS[sid] : undefined;
    if (!user) return res.writeHead(401).end();
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(user));
  });
  await new Promise<void>((ok) => server.listen(PORT, '127.0.0.1', ok));
  harness = await setupApp();
});
afterAll(async () => {
  await harness.close();
  await new Promise((ok) => server.close(ok));
});

describe('đọc người dùng bằng cách hỏi Web A (introspect)', () => {
  it('cookie hợp lệ → đúng người, đúng vai trò; hỏi Web A một lần rồi dùng bộ đệm', async () => {
    const get = () => harness.anonymous().get(`${API}/me`).set('Cookie', 'hostsid=phien-cua-ha');
    const me = (await get().expect(200)).body as MeResponse;
    expect(me.user).toMatchObject({ fullName: 'Phạm Thu Hà', role: 'cht' });
    // Không gửi lt_session: mỗi request phải đọc lại cookie Web A, nhưng kết quả nằm trong bộ đệm 60 giây
    await get().expect(200);
    await get().expect(200);
    expect(calls).toBe(1);
  });

  it('Web A báo chưa đăng nhập (401) → 401 SSO_REQUIRED', async () => {
    const res = await harness.anonymous().get(`${API}/me`).set('Cookie', 'hostsid=phien-da-het');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SSO_REQUIRED');
  });
});
