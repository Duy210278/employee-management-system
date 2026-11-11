/**
 * Web A giả (hệ thống chính) để chạy thử tích hợp trên máy: pnpm -F @lotrinh/api fake-host
 *
 *   http://localhost:8080/            trang chủ Web A, có tab "Lộ trình"
 *   http://localhost:8080/dang-nhap   chọn người đăng nhập → đặt cookie dùng chung "hostsid" (JWT HS256)
 *   http://localhost:8080/cookie-test trang kiểm tra cookie và gọi API qua proxy
 *   http://localhost:8080/api/me      người dùng hiện tại (cho chế độ introspect)
 *   http://localhost:8080/api/directory  danh sách nhân sự (cho đồng bộ hàng loạt)
 *   http://localhost:8080/lo-trinh/*  chuyển tiếp sang module Lộ trình (cùng tên miền, như proxy thật)
 *
 * Module chạy với: BASE_PATH=/lo-trinh HOST_AUTH_MODE=jwt HOST_JWT_SECRET=<FAKE_HOST_SECRET>
 * HOST_LOGIN_URL=http://localhost:8080/dang-nhap HOST_LOGOUT_URL=http://localhost:8080/dang-xuat
 * HOST_DIRECTORY_URL=http://localhost:8080/api/directory PUBLIC_URL=http://localhost:8080
 * Danh sách người lấy từ dữ liệu mẫu nên mã nhân viên khớp với module.
 */
import { createHmac } from 'node:crypto';
import http from 'node:http';
import { SEED_USERS } from '../src/db/seed/seed-data';

const PORT = Number(process.env.FAKE_HOST_PORT ?? 8080);
const MODULE = new URL(process.env.MODULE_URL ?? 'http://localhost:3000');
const SECRET = process.env.FAKE_HOST_SECRET ?? 'khoa-web-a-gia-chi-dung-tren-may-dev';
const COOKIE = 'hostsid';

const TITLE_OF = { bp: 'DAO_TAO', qlkv: 'QLKV', cht: 'CHT', nv: 'NVBH' } as const;
const TITLE_LABEL: Record<string, string> = { DAO_TAO: 'Đào tạo', QLKV: 'Quản lý khu vực', CHT: 'Cửa hàng trưởng', NVBH: 'Nhân viên bán hàng', KE_TOAN: 'Kế toán (không có quyền Lộ trình)' };

interface Person {
  sub: string;
  employeeCode: string;
  name: string;
  email: string;
  titles: string[];
  stores: string[];
  areas: string[];
  canBuddy?: boolean;
  active: boolean;
}

/** "CSDL nhân sự" của Web A giả; sửa được ngay trên trang chủ để thử đổi chức danh, nơi làm việc, nghỉ việc */
const people = new Map<string, Person>(
  SEED_USERS.filter((u) => u.status === 'active').map((u) => [
    u.employeeCode,
    {
      sub: `webA-${u.employeeCode}`,
      employeeCode: u.employeeCode,
      name: u.fullName,
      email: u.email,
      titles: [TITLE_OF[u.role]],
      stores: u.stores ?? [],
      areas: u.areas ?? [],
      canBuddy: u.canBuddy ?? false,
      active: true,
    },
  ]),
);
people.set('KT001', { sub: 'webA-KT001', employeeCode: 'KT001', name: 'Lê Kế Toán', email: 'ketoan@weba.local', titles: ['KE_TOAN'], stores: [], areas: [], active: true });

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');
function sign(p: Person): string {
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64(JSON.stringify({ ...p, iat: now, exp: now + 8 * 3600 }));
  return `${head}.${body}.${b64(createHmac('sha256', SECRET).update(`${head}.${body}`).digest())}`;
}
function verify(token: string | undefined): Person | null {
  if (!token) return null;
  const [h, b, s] = token.split('.');
  if (!h || !b || !s || b64(createHmac('sha256', SECRET).update(`${h}.${b}`).digest()) !== s) return null;
  const claims = JSON.parse(Buffer.from(b, 'base64url').toString()) as Person & { exp: number };
  if (claims.exp * 1000 < Date.now()) return null;
  // Đọc lại từ "CSDL" để phản ánh sửa đổi; cookie cũ vẫn mang thông tin lúc đăng nhập như Web A thật
  return people.get(claims.employeeCode) ?? null;
}
const cookieOf = (req: http.IncomingMessage) => /(?:^|;\s*)hostsid=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
const cookieNamesOf = (req: http.IncomingMessage) =>
  (req.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim().split('=', 1)[0])
    .filter(Boolean);
const setCookie = (res: http.ServerResponse, value: string, maxAge: number) =>
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const page = (title: string, body: string) => `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#f4f6f8;color:#1b2430}header{background:#0c4a6e;color:#fff;padding:12px 20px;display:flex;gap:20px;align-items:center}
header a{color:#fff;text-decoration:none;padding:6px 12px;border-radius:6px}header a.tab{background:#0e623a}main{max-width:900px;margin:24px auto;padding:0 16px}
.card{background:#fff;border-radius:10px;padding:16px 20px;margin-bottom:16px;box-shadow:0 1px 3px #0001}table{width:100%;border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #eee;text-align:left;font-size:14px}
button{padding:6px 12px;border-radius:6px;border:1px solid #0c4a6e;background:#fff;cursor:pointer}input,select{padding:5px}</style></head><body>${body}</body></html>`;
const form = (req: http.IncomingMessage) =>
  new Promise<URLSearchParams>((ok) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => ok(new URLSearchParams(data)));
  });
const redirect = (res: http.ServerResponse, to: string) => res.writeHead(302, { Location: to }).end();

function proxy(req: http.IncomingMessage, res: http.ServerResponse) {
  const up = http.request({ hostname: MODULE.hostname, port: MODULE.port, method: req.method, path: req.url, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  up.on('error', () => res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' }).end(`Không kết nối được module Lộ trình ở ${MODULE.origin}`));
  req.pipe(up);
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    if (url.pathname === '/lo-trinh' || url.pathname.startsWith('/lo-trinh/')) return proxy(req, res);
    const me = verify(cookieOf(req));

    if (url.pathname === '/api/me') {
      if (!me || !me.active) return res.writeHead(401).end();
      return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(me));
    }
    if (url.pathname === '/api/cookie-check') {
      const names = cookieNamesOf(req);
      return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
        hostCookieReceived: names.includes(COOKIE),
        cookieNames: names,
      }));
    }
    if (url.pathname === '/api/directory') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify([...people.values()]));

    if (url.pathname === '/dang-nhap' && req.method === 'POST') {
      const f = await form(req);
      const p = people.get(f.get('code') ?? '');
      if (!p) return redirect(res, '/dang-nhap');
      setCookie(res, sign(p), 8 * 3600);
      const back = f.get('returnTo') ?? '';
      const localHosts = [`http://localhost:${PORT}/`, `http://127.0.0.1:${PORT}/`];
      return redirect(res, localHosts.some((host) => back.startsWith(host)) ? back : '/');
    }
    if (url.pathname === '/dang-nhap') {
      const back = esc(url.searchParams.get('returnTo') ?? '');
      const rows = [...people.values()]
        .map((p) => `<tr><td>${esc(p.name)}</td><td>${p.employeeCode}</td><td>${p.titles.map((t) => TITLE_LABEL[t] ?? t).join(', ')}</td><td>${[...p.stores, ...p.areas].join(', ')}</td>
          <td><form method="post"><input type="hidden" name="code" value="${p.employeeCode}"><input type="hidden" name="returnTo" value="${back}"><button>Đăng nhập</button></form></td></tr>`)
        .join('');
      return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page('Đăng nhập Web A', `<header><b>Web A (giả lập)</b></header><main><div class="card"><h2>Đăng nhập hệ thống chính</h2>
        <p>Chọn người để đăng nhập. Web A đặt cookie dùng chung <code>hostsid</code> cho cả tên miền.</p><table><tr><th>Họ tên</th><th>Mã NV</th><th>Chức danh</th><th>Nơi làm việc</th><th></th></tr>${rows}</table></div></main>`));
    }
    if (url.pathname === '/dang-xuat') {
      setCookie(res, '', 0);
      return redirect(res, '/dang-nhap');
    }
    if (url.pathname === '/cookie-test') {
      const testPage = `<main><div class="card"><h2>Kiểm tra cookie qua proxy</h2>
        <p>Đăng nhập ở <a href="/dang-nhap">Web A giả</a>, sau đó bấm kiểm tra. Cookie <code>${COOKIE}</code> được đặt <code>Path=/; HttpOnly; SameSite=Lax</code>.</p>
        <p>JavaScript sẽ không đọc được cookie HttpOnly bằng <code>document.cookie</code>. Kiểm tra dưới đây cho biết máy chủ có nhận cookie và module có xác thực được qua đường dẫn proxy hay không.</p>
        <button id="check">Kiểm tra ngay</button>
        <h3>Cookie thấy được từ trình duyệt</h3><pre id="browser"></pre>
        <h3>Web A nhận được gì?</h3><pre id="host"></pre>
        <h3>Module nhận được gì qua /lo-trinh/?</h3><pre id="module"></pre>
        <p><a class="tab" href="/lo-trinh/">Mở module Lộ trình</a> · <a href="/">Về Web A giả</a></p></div></main>
        <script>
          const out = (id, value) => document.getElementById(id).textContent = JSON.stringify(value, null, 2);
          async function check() {
            out('browser', {cookieVisibleInDocument: document.cookie.includes('${COOKIE}'), note: 'false là đúng với cookie HttpOnly'});
            try {
              const host = await fetch('/api/cookie-check', {credentials: 'same-origin'});
              out('host', {status: host.status, ...(await host.json())});
            } catch (error) { out('host', {error: String(error)}); }
            try {
              const module = await fetch('/lo-trinh/api/v1/me', {credentials: 'same-origin'});
              const result = await module.json();
              out('module', {status: module.status, identity: result.user ? {
                id: result.user.id, fullName: result.user.fullName, role: result.user.role
              } : result, note: module.ok ? 'Cookie đã đi qua proxy và module đã nhận diện người dùng.' : 'Kiểm tra đăng nhập Web A, Path=/ và cấu hình proxy.'});
            } catch (error) { out('module', {error: String(error)}); }
          }
          document.getElementById('check').addEventListener('click', check);
          check();
        </script>`;
      return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page('Cookie test', testPage));
    }
    if (!me) return redirect(res, '/dang-nhap');

    if (url.pathname === '/doi-thong-tin' && req.method === 'POST') {
      const f = await form(req);
      const p = people.get(f.get('code') ?? '');
      if (p) {
        p.titles = [f.get('title') ?? p.titles[0]!];
        p.stores = (f.get('stores') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
        p.areas = (f.get('areas') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
        p.active = f.get('active') === 'on';
        // Người đang đăng nhập tự đổi thì cấp lại cookie (như đăng nhập lại) để module đồng bộ ngay
        if (p.employeeCode === me.employeeCode) setCookie(res, sign(p), 8 * 3600);
      }
      return redirect(res, '/');
    }
    if (url.pathname === '/') {
      const opts = (sel: string) => Object.keys(TITLE_LABEL).map((t) => `<option value="${t}" ${t === sel ? 'selected' : ''}>${TITLE_LABEL[t]}</option>`).join('');
      const rows = [...people.values()]
        .map((p) => `<tr><form method="post" action="/doi-thong-tin"><td>${esc(p.name)}<input type="hidden" name="code" value="${p.employeeCode}"></td><td><select name="title">${opts(p.titles[0]!)}</select></td>
          <td><input name="stores" value="${p.stores.join(',')}" size="6"></td><td><input name="areas" value="${p.areas.join(',')}" size="5"></td><td><input type="checkbox" name="active" ${p.active ? 'checked' : ''}></td><td><button>Lưu</button></td></form></tr>`)
        .join('');
      return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page('Web A', `<header><b>Web A (giả lập)</b><a href="/">Trang chủ</a><a href="/cookie-test">Cookie test</a><a class="tab" href="/lo-trinh/">Lộ trình</a>
        <span style="margin-left:auto">${esc(me.name)} · ${me.titles.map((t) => TITLE_LABEL[t] ?? t).join(', ')}</span><a href="/dang-xuat">Đăng xuất</a></header>
        <main><div class="card"><h2>Xin chào ${esc(me.name)}</h2><p>Bấm tab <b>Lộ trình</b> để vào module mà không đăng nhập lại.</p></div>
        <div class="card"><a href="/cookie-test">Mở trang kiểm tra truyền cookie qua proxy</a></div>
        <div class="card"><h3>Nhân sự (sửa để thử đồng bộ)</h3><table><tr><th>Họ tên</th><th>Chức danh</th><th>Cửa hàng</th><th>Khu vực</th><th>Đang làm</th><th></th></tr>${rows}</table></div></main>`));
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Không có trang này');
  })
  .listen(PORT, '127.0.0.1', () => console.log(`Web A giả: http://localhost:${PORT} → module ${MODULE.origin}/lo-trinh/`));
