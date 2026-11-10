# Kế hoạch làm sạch CSDL và bộ API

Mục tiêu: gom bảng, siết ràng buộc dữ liệu, gộp các API chồng chéo. Không đổi nghiệp vụ, không đổi giao diện người dùng.
Số liệu lấy từ `apps/api/src/db/schema.ts`, các controller trong `apps/api/src/modules`, và `apps/web/src/api/queries.ts`.

## 1. Hiện trạng đã đo

### 1.1 CSDL: 26 bảng

| Nhóm | Bảng |
|---|---|
| Tổ chức, tài khoản (9) | areas, stores, users, credentials, user_store_scopes, user_area_scopes, user_changes, notifications, system_settings |
| Phiên bản (1) | versions |
| Vận hành (11) | staff, level_runs, run_assignments, run_tasks, task_confirmations, task_events, task_date_changes, stage_signoffs, run_pauses, run_journal, run_evaluations |
| Đánh giá (4) | sales_monthly, observations, level_reviews, review_signatures |
| Nhật ký (1) | audit_logs |

Bảng đang trống: level_reviews, review_signatures, run_evaluations, system_settings, task_date_changes, user_changes. Trống do dữ liệu mẫu chưa chạm tới luồng, không phải do thừa. Code vẫn ghi vào cả 6 bảng.

Ghi chú: `system_settings` hiện chỉ lưu ngày giả lập của đồng hồ demo (`clock.service.ts`). Thiết kế mới bỏ chức năng điều chỉnh thời gian demo (mục 2.3), nên bảng này được bỏ theo.

### 1.2 Ràng buộc: gần như chỉ có khóa ngoại và một số unique index

- Các cột trạng thái (role, status, track, level_runs.status, run_tasks.status, run_pauses.status...) là `text`. Kiểu TypeScript chỉ kiểm tra ở tầng code, DB không chặn giá trị sai.
- Trong migration chỉ có UNIQUE INDEX, trigger `versions_guard` và một partial unique của `task_confirmations`. Không có CHECK nào.
- Không có ràng buộc "mỗi nhân viên chỉ có một lượt đang mở". Quy tắc này hiện chỉ do code giữ.
- `run_assignments` không chặn hai người cùng vai trò đang hiệu lực trong một lượt.
- `level_runs.criteria_line` lặp lại thông tin đã có ở `versions.criteria_line` qua `version_id`.
- `staff.employee_code` và `staff.full_name` lặp với `users`, và `staff.employee_code` không unique.

### 1.3 API: 78 route

| Nhóm | Số route |
|---|---|
| versions 10, framework 1 | 11 |
| users 8, auth 4 | 12 |
| staff 7, cht 7, runs 8 | 22 |
| tasks 6 | 6 |
| sales 2, observations 2, reviews 3 | 7 |
| me 3, notifications 2, alerts 1 | 6 |
| org 5, audit 1, reports 1, health 1 | 8 |
| demo (chỉ bật ở DEMO_MODE) | 6, trong đó 2 route đồng hồ (GET, PUT /demo/clock) sẽ bị bỏ |

Kết quả rà soát: không có route nào hoàn toàn không dùng. Mọi route đều được giao diện gọi (qua `queries.ts`) hoặc có e2e test; `GET /health` phục vụ hạ tầng. Vì vậy "loại API dư" thực chất là **gộp các route chồng chéo**, không phải xóa route chết.

## 2. Thiết kế CSDL mục tiêu

### 2.1 Gom bảng: 26 → 21 (Đợt A, rủi ro thấp; còn 20 nếu bỏ credentials khi dùng SSO)

| Gộp | Thành | Cách làm |
|---|---|---|
| user_changes | audit_logs | `entity='user'`, `payload` = trường, giá trị cũ, giá trị mới |
| task_date_changes | task_events | thêm cột `data jsonb`; `action='date_change'`, `data` = ngày cũ, ngày mới, lý do |
| system_settings | (bỏ) | chỉ lưu ngày giả lập, xem mục 2.3 |
| user_store_scopes, user_area_scopes | user_scopes | cột `store_id` hoặc `area_id`, CHECK đúng một cột có giá trị, unique theo (user, store/area) |
| stage_signoffs, review_signatures | signoffs | cột `kind` ('stage' hoặc 'review'), `ref` (mã giai đoạn hoặc id phiếu), `step`, `role`, `user_id`, `at`; unique (run_id, kind, ref, step) |

Bảng còn lại sau Đợt A (21): areas, stores, users, credentials, user_scopes, notifications, versions, staff, level_runs, run_assignments, run_tasks, task_confirmations, task_events, signoffs, run_pauses, run_journal, run_evaluations, sales_monthly, observations, level_reviews, audit_logs. Đếm thực tế khi làm có thể lệch 1; chốt lại ở bước thiết kế chi tiết.

### 2.2 Gom thêm: 21 → 19 (Đợt B, có đánh đổi, cần bạn quyết)

- **run_journal và run_evaluations**: chuyển vào `level_runs.meta` (JSONB), vì chúng chỉ thuộc luồng onboarding CHT và luôn truy cập theo lượt. Đổi lại: mất khóa ngoại tới người ghi, và phải tự xử lý ghi đè đồng thời.
- **Nên giữ riêng**: credentials (mật khẩu tách khỏi users), run_pauses (có luồng duyệt riêng), areas (cần cho phạm vi QLKV).

Đề xuất trước đây gộp `run_pauses` với `run_journal` thành `run_events` đã bị bỏ. Hai bảng khác bản chất (một bên là yêu cầu có duyệt, một bên là ghi chú theo ngày), gộp sẽ làm lỏng logic.

### 2.3 Bỏ điều chỉnh thời gian demo

Bỏ chức năng đặt ngày giả lập. Mọi nơi dùng ngày thật theo múi giờ `TZ`.

| Phần | Việc |
|---|---|
| API | bỏ GET /demo/clock và PUT /demo/clock |
| CSDL | bỏ bảng system_settings |
| `clock.service.ts` | giữ làm nguồn "hôm nay" duy nhất, nhưng bỏ phần ngày giả lập; `today()` luôn trả ngày thật. Các service đang gọi ClockService không phải sửa |
| Giao diện | bỏ thanh `SimDateBar.vue` và phần chỉnh ngày trong `SystemPage.vue` |
| Seed mẫu | seed phải sinh ngày theo ngày thật lúc nạp, để dữ liệu mẫu vẫn có đủ trạng thái đúng hạn, sắp đến hạn, quá hạn |
| Job | giữ POST /demo/jobs/:name/run để chạy tay các job nhắc việc; nếu muốn bỏ luôn thì báo tôi |
| Test | 4 file e2e đang tua ngày bằng PUT /demo/clock: `tasks`, `staff`, `assessment`, `operations`. Phải thay bằng đồng hồ giả chỉ dùng trong test: ghi đè provider `ClockService` trong `apps/api/test/helpers.ts`, cho phép test đặt ngày trực tiếp. Không đưa đường nào vào API thật |

Hệ quả cần biết: khi demo, người xem không còn tua ngày để cho thấy cảnh báo quá hạn hay nhắc việc. Họ chỉ thấy các trạng thái mà seed đã dựng sẵn quanh ngày thật.

### 2.4 Siết ràng buộc (Đợt P1, không đổi cấu trúc, làm trước)

| Bảng | Ràng buộc thêm |
|---|---|
| Mọi cột trạng thái | CHECK theo danh sách giá trị hợp lệ (role, status, track, trạng thái lượt, trạng thái đầu việc, trạng thái tạm dừng) |
| level_runs | partial unique: mỗi `staff_id` chỉ một lượt ở trạng thái đang mở (active, paused, review, extended); CHECK `planned_end >= start_date` |
| run_assignments | partial unique (run_id, role) khi `to_date is null`; CHECK `to_date >= from_date` |
| run_tasks | CHECK `due_date >= open_date`; CHECK trạng thái done thì có `done_date`, trạng thái na thì có `na_reason` |
| run_pauses | CHECK `to_date >= from_date` |
| versions | CHECK `effective_to > effective_from` |
| staff | unique `employee_code` (bỏ qua null) |
| audit_logs | index (entity, entity_id) và (at) |
| level_runs | bỏ cột `criteria_line`, lấy qua `versions` |

Trước khi bật mỗi ràng buộc phải chạy câu truy vấn kiểm tra dữ liệu hiện có (cả local lẫn Neon) để chắc chắn không có dòng vi phạm.

## 3. Thiết kế API mục tiêu

### 3.1 Đợt A: gộp route cùng bản chất (76 → 70, sau khi bỏ 2 route đồng hồ)

| Hiện tại | Gộp thành |
|---|---|
| POST /tasks/:id/confirm, /undo, /rework, /status | POST /tasks/:id/actions `{ type, ... }` (4 → 1) |
| POST /versions/:id/submit, /withdraw, /approve | POST /versions/:id/transition `{ to }` (3 → 1) |
| POST /users/:id/approve, /reject | POST /users/:id/decision `{ approve, note }` (2 → 1) |

Giữ nguyên `POST /tasks/confirm-many`. Mỗi `type` và mỗi `to` vẫn đi qua đúng kiểm tra quyền như route cũ.

### 3.2 Đợt B: gộp sâu hơn (70 → khoảng 63)

| Hiện tại | Gộp thành |
|---|---|
| POST /staff và POST /cht/runs | POST /runs `{ track, ... }` |
| GET /staff/form-options và GET /cht/form-options/:userId | GET /runs/form-options?track=&userId= |
| PUT /runs/:id/cht/journal/:day, /evaluation, /meta | PUT /runs/:id/cht `{ journal?, evaluation?, meta? }` |
| GET /runs/:id/sales, /observations, /review | GET /runs/:id/assessment |

Các route ghi `PUT sales/:month`, `POST observations`, `PUT review` giữ riêng vì khác quyền và khác nhịp thao tác.

### 3.3 Nguyên tắc chung

- Mỗi route phải khai báo quyền. Thêm một e2e test duyệt toàn bộ route và báo lỗi nếu route nào thiếu khai báo quyền.
- Thông báo lỗi và mã lỗi giữ nguyên để giao diện không bị ảnh hưởng.
- Chưa có hệ thống ngoài nào gọi API (tích hợp LMS/elearning chưa làm), nên đây là lúc đổi route rẻ nhất. Không cần giữ route cũ làm bí danh.
- Nhóm demo còn 4 route (accounts, login-as, jobs, reset), tách khỏi số đếm bản chạy thật.

## 4. Các bước thực hiện

Mỗi bước là một commit riêng, xong bước nào chạy kiểm tra bước đó rồi mới sang bước kế tiếp.

| Bước | Việc | Ước lượng |
|---|---|---|
| 0 | Sao lưu `pg_dump` local, tạo nhánh Neon để thử. Chạy toàn bộ e2e và ghi lại kết quả gốc | 0,5 ngày |
| 1 | Siết ràng buộc (mục 2.4). Truy vấn kiểm tra dữ liệu, migration 0007, cập nhật seed | 0,5 ngày |
| 2 | Gộp bảng Đợt A (mục 2.1). Migration chuyển dữ liệu bằng INSERT...SELECT rồi xóa bảng cũ; sửa các service dùng bảng đó; cập nhật `staff.service.ts` (xóa nhân viên liệt kê tên bảng) | 1,5 ngày |
| 3 | Gộp API Đợt A (mục 3.1): sửa controller, schema Zod dùng chung, `queries.ts` ở web, test | 1 ngày |
| 4 | Quyết định Đợt B cho bảng và API, rồi làm theo kết quả | 1,5 ngày nếu làm |
| 2b | Bỏ đồng hồ demo (mục 2.3): thay đồng hồ giả trong test trước, rồi bỏ route, giao diện, bảng và sửa seed | 1 ngày |
| 5 | Cập nhật `CO_SO_DU_LIEU.md`, tài liệu thiết kế, trang `/api/docs`, sơ đồ DB và cây chức năng | 0,5 ngày |

## 5. Cách kiểm chứng

- `typecheck` toàn repo và toàn bộ e2e (11 file trong `apps/api/test`) trên DB `lotrinh_test` phải xanh sau mỗi bước.
- Với migration: so số dòng trước và sau từng bảng được gộp (ví dụ `stage_signoffs` + `review_signatures` = `signoffs`); chạy migration trên bản sao dữ liệu thật trước.
- Với API: test cho mỗi `type` và mỗi `to` của route gộp, gồm cả trường hợp bị từ chối vì thiếu quyền.
- Giao diện: chạy Playwright qua các màn Hôm nay, Việc cần xử lý, Checklist, Thiết kế lộ trình, Đánh giá, Nhân sự, không có lỗi console.
- Triển khai: chỉ đẩy lên `main` (Render tự deploy) sau khi đã thử migration trên nhánh Neon.

## 6. Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Migration làm mất dữ liệu trên Neon | Sao lưu và thử trên nhánh Neon trước; mỗi migration có kiểm tra số dòng |
| Ràng buộc mới làm hỏng dữ liệu cũ không hợp lệ | Chạy truy vấn tìm dòng vi phạm trước, sửa dữ liệu rồi mới bật ràng buộc |
| Gộp route làm lọt kiểm tra quyền | Test duyệt toàn bộ route; test từng `type` và `to` với từng vai trò |
| Seed mẫu lệch với schema mới | Cập nhật seed ở cùng bước đổi schema; chạy "Khôi phục dữ liệu mẫu" để thử |

## 7. Cần bạn quyết

1. Có làm Đợt B (gộp `run_journal`, `run_evaluations` vào `level_runs.meta`) không, hay dừng ở Đợt A.
2. Có gộp API Đợt B (tạo lượt, cập nhật CHT, đọc đánh giá) không. Mỗi mục gộp đều làm cả web và test phải sửa theo.
3. Dữ liệu trên Neon hiện có cần giữ không, hay được phép dựng lại từ seed.
