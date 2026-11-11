# Kế hoạch: đưa Lộ trình Upharma thành module của dự án lớn (tab + cookie dùng chung)

## Bối cảnh

Ban đầu Lộ trình là ứng dụng độc lập có email/mật khẩu, đăng ký và duyệt tài khoản. Thiết kế đó đã được thay bằng SSO-only: hệ thống chính cấp danh tính, vai trò, phạm vi và trạng thái qua cookie; BP Đào tạo chỉ quản lý quyền Buddy trong module. Phiên cookie `lt_session` của module vẫn dùng riêng dưới `BASE_PATH`, song không phải luồng đăng nhập độc lập.

**Mục tiêu:** dự án lớn có thêm tab "Lộ trình". Người dùng bấm vào tab thì sang trang của module mà không phải đăng nhập lại. Module đọc cookie đăng nhập của dự án lớn để biết người dùng là ai, có vai trò gì và phạm vi đến đâu.

**Những gì đã chốt:**
- Hai bên dùng chung một tên miền và khác đường dẫn: dự án lớn ở `/`, module ở `/lo-trinh/` sau proxy ngược.
- Hệ thống chính là nguồn chuẩn cho danh tính, vai trò, phạm vi và trạng thái.
- BP Đào tạo quản lý riêng quyền Buddy trong module; module không nhận quyền Buddy từ hệ thống chính.
- Bỏ hẳn đăng nhập, đăng ký và chờ duyệt riêng của module. Không còn chế độ xác thực nội bộ/demo.
- Định dạng cookie thật được cấu hình qua adapter JWT hoặc introspection; fake-host cung cấp luồng JWT để kiểm thử trên máy.

## Kiến trúc đích

```
Trình duyệt ──► proxy (cùng miền)
                 ├─ /            → dự án lớn (đặt cookie phiên, Path=/)
                 └─ /lo-trinh/*  → module Lộ trình (NestJS phục vụ cả web và /lo-trinh/api/v1)
Module: AuthGuard → IdentityProvider.resolve(req) → ExternalIdentity → UserSync (upsert users, user_scopes) → req.user
```

Nghiệp vụ không đổi: `SessionUser`, `AccessService` ([access.service.ts](apps/api/src/modules/access/access.service.ts)), `ability.ts` và các service vẫn dùng `users.id` nội bộ như bây giờ. Chỉ thay **cách xác định `req.user`**.

## Các bước

### 1. Đường dẫn gốc `/lo-trinh`
- `config.ts`: thêm `BASE_PATH` (mặc định `/`; khi tích hợp đặt `/lo-trinh`).
- [app.setup.ts](apps/api/src/app.setup.ts): `setGlobalPrefix(`${BASE_PATH}/api/v1`)`. [main.ts](apps/api/src/main.ts) `serveWeb`: phục vụ file tĩnh và `index.html` dưới `BASE_PATH`, đổi điều kiện `startsWith('/api/')` theo tiền tố mới. Swagger ([api-docs.ts](apps/api/src/api-docs.ts)) cũng đặt dưới tiền tố này.
- Web: [vite.config.ts](apps/web/vite.config.ts) đặt `base: process.env.BASE_PATH`. [router.ts](apps/web/src/router.ts) dùng `createWebHistory(import.meta.env.BASE_URL)`. [client.ts](apps/web/src/api/client.ts) và `exportUrl` trong [queries.ts](apps/web/src/api/queries.ts) ghép đường dẫn bằng `import.meta.env.BASE_URL`. Proxy dev của Vite đổi theo.
- Link trong thông báo (ví dụ `/quan-tri/tai-khoan/…` trong `notifications`) vẫn là đường dẫn tương đối của module, do Vue Router tự thêm base. Trong email (`SMTP_URL`), link phải ghép `PUBLIC_URL + BASE_PATH`.

### 2. Lớp đọc danh tính từ dự án lớn (adapter)
Tạo thư mục mới `apps/api/src/adapters/identity/`, theo cùng kiểu với `adapters/clock`.

```ts
interface ExternalIdentity {
  externalId: string; email: string; fullName: string; employeeCode?: string;
  roles: string[];            // tên vai trò của dự án lớn
  storeCodes: string[]; areaCodes: string[]; canBuddy: boolean;
}
interface IdentityProvider { resolve(req: Request): Promise<ExternalIdentity | null> }
```

Biến `HOST_AUTH_MODE` chọn một trong ba cách:
- **`jwt`**: đọc cookie `HOST_COOKIE_NAME`, kiểm chữ ký bằng `HOST_JWT_SECRET` (HS256) hoặc `HOST_JWKS_URL` (RS256, dùng gói `jose`), và kiểm `iss`/`aud`. Tên các claim đọc từ `HOST_CLAIM_MAP` (JSON), vì chưa biết dự án lớn đặt tên claim thế nào.
- **`introspect`**: gọi `HOST_ME_URL` kèm nguyên header `Cookie`, đặt thời gian chờ 3 giây. Kết quả được cache trong bộ nhớ 60 giây, khóa là sha256 của cookie, để không gọi dự án lớn ở mọi request.
Module không có chế độ xác thực độc lập. Muốn chạy local cần dùng Web A giả và cookie SSO thử; `DEMO_MODE` chỉ bật công cụ demo, không bỏ qua xác thực.

Bảng đổi tên vai trò `HOST_ROLE_MAP`, ví dụ `{"NVBH":"nv","CHT":"cht","QLKV":"qlkv","DAO_TAO":"bp"}`. Nếu một người có nhiều vai trò, lấy vai trò cao nhất theo thứ tự `bp > qlkv > cht > nv`. Nếu không có vai trò nào đổi được thì trả 403 `NO_MODULE_ACCESS`.

### 3. Đồng bộ người dùng từ dự án lớn (UserSync)
Tạo service mới `apps/api/src/modules/auth/user-sync.service.ts`:
- Migration mới: `users.external_id nvarchar(100)` unique (có lọc null). Bỏ bảng `credentials`. Bỏ các cột `requested_role`, `requested_store_id`, `requested_area_id`, `review_note`, `reviewed_by`, `reviewed_at`. Thu `USER_STATUSES` trong [roles.ts](packages/shared/src/roles.ts) còn `active | left`. Cập nhật [docs/thiet-ke/sqlserver/01_tao_bang.sql](docs/thiet-ke/sqlserver/01_tao_bang.sql) và [CO_SO_DU_LIEU.md](docs/thiet-ke/CO_SO_DU_LIEU.md).
- Tìm người dùng theo `external_id`, rồi theo `employee_code` để giữ dữ liệu cũ. Tìm thấy thì gắn `external_id`, không thấy thì tạo mới với `status='active'`.
- Đồng bộ `role`, `full_name`, `email`, trạng thái và `user_scopes`; không đồng bộ `can_buddy`. Phạm vi map theo `stores.code` và `areas.code`. Quyền Buddy chỉ do BP Đào tạo cập nhật trong module.
- Lần đầu thấy người dùng: gắn `staff.user_id` cho hồ sơ nhân viên có cùng `employee_code` mà chưa có tài khoản.
- Ghi audit `auth.sso` mỗi khi bắt đầu một phiên mới (cookie mới), thay cho `auth.login`.

### 4. Viết lại AuthGuard và các endpoint xác thực
- [auth.guard.ts](apps/api/src/modules/auth/auth.guard.ts): `identity = await provider.resolve(req)`. Không có danh tính thì trả 401 `NO_SESSION`. Có thì `userSync.ensure(identity)` → `req.user`. Giữ nguyên phần cập nhật `last_seen_at` và kiểm `status`.
- [auth.controller.ts](apps/api/src/modules/auth/auth.controller.ts) và `auth.service.ts`: bỏ `login`, `register`, `register-options`, `verifyPassword`, `startSession`. Thêm `GET /auth/config` để web biết `loginUrl` và `logoutUrl` của dự án lớn (`HOST_LOGIN_URL`, `HOST_LOGOUT_URL`).
- Chống CSRF: cookie của dự án lớn có thể là `SameSite=Lax`, nên các request POST/PUT/DELETE phải có header `Origin` thuộc `PUBLIC_URL` (thêm middleware trong `app.setup.ts`).
- [demo.controller.ts](apps/api/src/modules/demo/demo.controller.ts): bỏ đăng nhập nhanh; chỉ giữ công cụ demo không liên quan đến xác thực.

### 5. Quản trị tài khoản: chuyển sang chỉ xem
- [users.controller.ts](apps/api/src/modules/users/users.controller.ts) và `users.service.ts`: giữ `GET` danh sách/chi tiết và `PUT /:id` chỉ để BP Đào tạo cập nhật `can_buddy` (kèm chuyển giao phân công nếu cần).
- Web: [AccountsPage.vue](apps/web/src/pages/admin/AccountsPage.vue) chỉ xem danh tính; `AccountDetailPage.vue` cho BP Đào tạo quản lý quyền Buddy. Bỏ các luồng duyệt và nhập tài khoản.
- Xóa thông báo kiểu `registration` và mục liên quan trong `jobs.service.ts`.

### 6. Web: bỏ trang đăng nhập riêng
- Xóa `LoginPage.vue`, `RegisterPage.vue`, `PendingPage.vue` cùng các route `/dang-nhap`, `/dang-ky`, `/cho-duyet`, và các hàm tương ứng trong `queries.ts`.
- `router.beforeEach`: khi gặp 401 thì chuyển tới URL đăng nhập của hệ thống chính; 403 `NO_MODULE_ACCESS` thông báo người dùng chưa được cấp quyền.
- [UserMenu.vue](apps/web/src/components/UserMenu.vue): "Đăng xuất" chuyển sang `logoutUrl` của hệ thống chính. Không có ô đổi tài khoản.

### 7. Phía dự án lớn (bàn giao cho đội dự án lớn)
- Thêm tab "Lộ trình" trỏ tới `/lo-trinh/`. Chỉ hiện tab cho người có vai trò nằm trong `HOST_ROLE_MAP`.
- Cấu hình proxy chuyển `/lo-trinh/*` sang module và giữ nguyên tiền tố, kèm `X-Forwarded-For` (module đã bật `trust proxy`).
- Cookie phiên phải có `Path=/` để gửi kèm tới `/lo-trinh`.
- Cung cấp: định dạng cookie (JWT và khóa, hoặc URL `/me`), tên claim, danh sách vai trò, mã cửa hàng và khu vực trùng với `stores.code` và `areas.code`, URL đăng nhập và đăng xuất.
- (Tùy chọn) Hiện số thông báo chưa đọc trên tab qua API thông báo sẵn có của module.

### 8. Test
- [helpers.ts](apps/api/test/helpers.ts): tạo cookie JWT SSO cho danh tính thử; các test nghiệp vụ không còn đăng nhập bằng mật khẩu.
- Test tài khoản xác nhận đồng bộ Buddy do module quản lý; role/scope/status đến từ hệ thống chính; endpoint đăng nhập, đăng ký và quản trị tài khoản cũ không còn.
- Test riêng cho cách `jwt` (ký token test bằng `jose`, sai chữ ký thì 401) và cách `introspect` (giả lập `HOST_ME_URL` bằng một server HTTP nhỏ trong test, kiểm cache).
- Test `BASE_PATH=/lo-trinh`: API trả về ở `/lo-trinh/api/v1/health`, và `/lo-trinh/hom-nay` trả `index.html`.

## Thứ tự làm và kiểm tra
1. Bước 1 (BASE_PATH) làm riêng, không đổi hành vi khi `BASE_PATH=/`. Kiểm bằng `pnpm test` và `pnpm typecheck`.
2. Bước 2, 3, 4 và 8 (adapter, đồng bộ, guard, test) làm trong một đợt, có migration.
3. Bước 5 và 6 (giao diện).
4. Chạy thử đầu cuối: `pnpm -F @lotrinh/api fake-host`, đăng nhập tại `/dang-nhap`, rồi dùng `/cookie-test` để xác nhận `HttpOnly` cookie được gửi qua proxy và module nhận diện được phiên.
5. Hoàn tất kiểm thử và bàn giao cấu hình JWT/introspection, cookie `Path=/`, claim map, vai trò, mã cửa hàng/khu vực và URL đăng nhập/đăng xuất với đội hệ thống chính.

## Cấu hình cần xác nhận với đội dự án lớn
Định dạng cookie và khóa kiểm chữ ký, tên claim, danh sách vai trò, mã cửa hàng và khu vực, URL đăng nhập và đăng xuất, và cách báo một người đã nghỉ việc (khi đó module đặt `status='left'`).
