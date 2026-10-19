# Kế hoạch triển khai "Lộ trình Upharma" (EMS NVBH)

## Context

BP Đào tạo Upharma đang theo dõi lộ trình 4 Level của NVBH bằng Excel (N2: 138 đầu việc, 15 giai đoạn, 4 phiếu đánh giá). Không biết ai đang ở đâu, hạn mỗi người khác nhau theo ngày vào làm, người xác nhận không có danh sách việc, không quản lý được phiên bản tài liệu. Tài liệu thiết kế [docs/thiet-ke/Upharma_Lo_trinh_NVBH_Tai_lieu_thiet_ke.md](../thiet-ke/Upharma_Lo_trinh_NVBH_Tai_lieu_thiet_ke.md) (v0.12) đặc tả đầy đủ một bản **demo chạy local, cài trực tiếp trên máy, không dùng Docker**: NestJS + Vue 3 + PostgreSQL 16, Drizzle, pnpm monorepo, có ngày giả lập.

Tài liệu nằm trong `docs/`: đặc tả ở `docs/thiet-ke/`, kế hoạch ở `docs/ke-hoach/`, tài liệu nguồn ở `docs/nguon/`: [Checklist_Onboarding_4Level_v2.1.xlsx](../nguon/Checklist_Onboarding_4Level_v2.1.xlsx) (N2), [Khung_Nang_Luc_Upharma_v2.1.docx](../nguon/Khung_Nang_Luc_Upharma_v2.1.docx) (N1), [Checklist_onboarding_UI.html](../nguon/Checklist_onboarding_UI.html) (N3). Chưa có code. N4/N5/N6 sẽ được bổ sung sau.

**Ràng buộc đã chốt với người dùng:** 1 dev + Claude Code · MVP chứng minh **vòng lặp giao việc** trước (~2 tuần) · giữ đúng stack của tài liệu · **không dùng Docker**, PostgreSQL cài trực tiếp trên máy.

**Kết quả mong muốn:** sau 2 tuần có MVP chạy `pnpm build && pnpm start` mở `localhost:3000` demo được: NV vào ngày khác nhau → lịch riêng → Hôm nay / Việc cần xử lý → xác nhận 2 phía → tua ngày thấy quá hạn. Sau đó mở rộng dần tới bản demo đầy đủ (~10–11 tuần tổng).

---

## 1. Phân tích tài liệu – những điểm quyết định cách làm

| Phát hiện | Hệ quả cho kế hoạch |
|---|---|
| Lõi nghiệp vụ là **bộ tính lịch** (mục 10) + **mô hình xác nhận nhiều vai trò** (7.2, R04–R10). Mọi màn hình khác chỉ là cách nhìn vào hai thứ này | Viết lõi này đầu tiên, dạng hàm thuần trong `packages/shared`, test kỹ bằng kịch bản T-L/T-X |
| Trình soạn phiên bản (mục 6, 7, 8) chiếm khoảng 40% khối lượng nhưng không cần để chứng minh giá trị vận hành | Đẩy ra sau MVP. MVP dùng **v2.1 nạp cứng từ seed JSON** |
| Mục 13.2 cho phép lưu nội dung phiên bản dạng **một tài liệu JSONB bất biến** thay vì ~25 bảng `v_*` | **Chọn JSONB** (`versions.content`) + Zod schema dùng chung. Tiết kiệm nhiều nhất cho 1 dev. Chỉ thêm bảng chỉ mục khi thực sự cần truy vấn |
| Lượt Level **lưu cứng** `open_date`/`due_date` khi tạo (10.2); trạng thái hiển thị tính tại thời điểm đọc theo bảng ưu tiên 10.3 | `run_tasks` lưu ngày; trạng thái do hàm `computeTaskState()` tính, dùng chung server + client |
| "Hôm nay" luôn lấy từ `ClockService` (ngày giả lập) | Làm `ClockService` từ ngày 1, cấm gọi `new Date()` trực tiếp trong nghiệp vụ |
| Phân quyền theo phạm vi kiểm tra ở server (R22, T-U05) | `scopeFilter(user)` + CASL làm ngay trong MVP, không để sau |
| N3 ([docs/nguon/Checklist_onboarding_UI.html](../nguon/Checklist_onboarding_UI.html)) là nguồn seed chính: có sẵn `const LEVELS`, `const OV`; mốc giai đoạn khớp mục 22.4 (L1 6 giai đoạn đến ngày 60; L2 đến 274; L3, L4 đến 365) | Bóc seed `seed/v2.1.json` từ `LEVELS`/`OV` của N3; dùng Excel N2 để điền `source_ref` và đối chiếu; áp dụng giả định mục 16 |
| 20 vấn đề mở (mục 16) | Không chặn MVP; dùng giả định mặc định. V1, V2, V7 cần chốt trước khi seed được coi là chính thức |

---

## 2. Quyết định kỹ thuật

- **Monorepo pnpm:** `apps/api` (NestJS 10), `apps/web` (Vue 3 + Vite + Pinia + TanStack Query), `packages/shared` (Zod, schedule, validation, change-kind). Cấu trúc theo mục 14.4.
- **Ngày nghiệp vụ** truyền và lưu dạng chuỗi `YYYY-MM-DD` (kiểu `date` trong PG); dùng `date-fns` + `date-fns-tz` với múi giờ `Asia/Ho_Chi_Minh`. Không dùng `Date` cho ngày nghiệp vụ.
- **Nội dung phiên bản:** `versions.content jsonb` được kiểm tra bằng `VersionContentSchema` (Zod) trong shared. Lượt Level đọc câu chữ qua `getContentForRun(run)`, hàm này lấy bản mới nhất của **dòng tiêu chí** (R02). MVP chỉ có 1 bản nhưng đi qua hàm này từ đầu.
- **Adapter** (14.1): `ClockService`, `Notifier`, `StorageService`, `JobRunner`. MVP chỉ cần `ClockService` thật; các adapter khác để interface rỗng.
- **UI:** CSS thuần theo token mục 15 (`tokens.css`, có dark mode qua `prefers-color-scheme`, chi phí thấp). Chưa dùng thư viện component; Reka UI chỉ thêm khi cần dialog/dropdown phức tạp.
- **Kiểm thử:** Vitest cho shared (tính lịch, trạng thái, quy tắc xác nhận) và API (quyền, phạm vi). Playwright để cuối giai đoạn 5.

---

## 3. Lộ trình tổng thể

| Giai đoạn | Nội dung chính | Thời lượng (1 dev + Claude) | Mốc nghiệm thu |
|---|---|---|---|
| **0. Chuẩn bị** | Chốt V1/V2/V7, thu N4/N5, bóc seed từ N3 | 2–3 ngày (chạy song song với tuần 1) | Có `seed/v2.1.json` hợp lệ theo Zod |
| **1. MVP – Vòng lặp giao việc** | Lịch, giao việc, Hôm nay, Việc cần xử lý, xác nhận 2 phía, tua ngày | **10 ngày làm việc** (+2 ngày dự phòng) | Kịch bản demo MVP 7 phút chạy trọn |
| **2. Demo vòng 1 hoàn chỉnh** | Quản trị người dùng, cảnh báo, thông báo + job, ký giai đoạn, tạm dừng, nhật ký, CSV | 2 tuần | Đủ hạng mục "Demo vòng 1" mục 21 |
| **3. Thiết kế lộ trình & phiên bản** | Vòng đời phiên bản, trình soạn Khung NL/Checklist/Phiếu, kiểm tra hợp lệ, chuyển phiên bản | 3 tuần | T-V01..T-V06 đạt |
| **4. Đánh giá & chuyển Level** | Doanh số, Rubric, Buddy Score, phiếu + chuỗi ký, lên Level, gia hạn | 2 tuần | Bước 7 kịch bản 14.13 chạy được |
| **5. Hoàn thiện demo** | Nhập/xuất Excel/JSON, in PDF, bằng chứng đính kèm, e2e, a11y | 1 tuần | Kịch bản 15 phút (14.13) chạy trọn, cài < 10 phút |
| **6. Chạy thật** | Thay hạ tầng (14.14), tích hợp (18), nhập NV thật, thí điểm 1 cửa hàng | Lập kế hoạch riêng | BP ĐT duyệt bản demo |

Tổng tới bản demo đầy đủ: **khoảng 10–11 tuần**.

---

## 4. Giai đoạn 0 – Chuẩn bị (song song với tuần 1)

| Việc | Ai | Đầu ra |
|---|---|---|
| Gửi BP ĐT chốt **V1** (L1 = 60 ngày?), **V2** (L2 bắt đầu tháng 4?), **V7** (chuỗi duyệt CHT→QLKV→BP ĐT→NV?) | Dev → BP ĐT | Biên bản chốt; nếu chưa có thì dùng giả định mục 16 |
| Thu JSON từ N4/N5 (N1, N3 đã có trong `docs/nguon/`) | Dev | Đặt vào `docs/nguon/` |
| Viết script `seed/extract-n3.ts` trích `LEVELS` và `OV` từ [docs/nguon/Checklist_onboarding_UI.html](../nguon/Checklist_onboarding_UI.html) → JSON thô | Dev + Claude | `seed/raw-n3.json` |
| Viết script `seed/extract-n2.ts` (exceljs) đọc 4 sheet checklist của N2 để lấy số thứ tự gốc làm `source_ref` và đối chiếu nội dung với N3 | Dev + Claude | Bảng đối chiếu N2 ↔ N3 |
| Chuẩn hóa thành `seed/v2.1.json` theo `VersionContentSchema`: mã `L{n}-{gđ}-{tt}`, mốc giai đoạn theo N3 (L1: [0,7] [7,14] [14,21] [21,30] [30,45] [45,60]), hạn `d` theo N3, áp dụng sửa V11, V12 | Dev + Claude | File seed qua được kiểm tra Zod |

---

## 5. Giai đoạn 1 – MVP "Vòng lặp giao việc" (chi tiết)

### 5.1 Phạm vi MVP

**Có:**
- Đăng nhập email + mật khẩu (bcryptjs, JWT cookie httpOnly 12h); **đăng nhập nhanh** và nút đổi tài khoản trên thanh trên cùng (DEMO_MODE).
- Danh mục khu vực/cửa hàng và tài khoản **chỉ qua seed** (chưa có màn quản trị).
- Phiên bản v2.1 nạp cứng (chỉ đọc). Trang "Khung năng lực" chỉ xem tối giản: Level, mục tiêu.
- Hồ sơ NV: tạo NV mới + bắt đầu lượt L1 (chọn cửa hàng, ngày bắt đầu, Buddy, CHT/QLKV lấy mặc định theo cửa hàng). Hệ thống sinh `run_tasks` với ngày lưu cứng.
- **Bộ tính lịch** đầy đủ mục 10.2 (trừ tạm dừng, POS) và **trạng thái** mục 10.3 (thứ tự 1–5, 8–10).
- **Giao việc theo người** (10.5) và hàng đợi ưu tiên.
- Màn hình: **Hôm nay** (NV), **Tổng quan Level + "Tôi đã đọc và hiểu"** (mở khóa checklist), **Việc cần xử lý** (Buddy/CHT/QLKV/BP ĐT), **Nhân sự** (danh sách trong phạm vi), **Hồ sơ NV – tab Checklist** theo giai đoạn.
- Thao tác đầu việc: Tôi đã làm xong · Xác nhận đạt (vai trò) · Hủy xác nhận của tôi · Yêu cầu làm lại (bắt buộc lý do) · Cần hỗ trợ · N/A (trừ GPP) · phụ thuộc khóa mục. Lịch sử từng mục. Áp dụng R04–R10.
- **Công cụ demo:** ngày giả lập (đặt ngày, −1, +1, +1 tuần, về ngày thật) + dải cảnh báo "Đang giả lập ngày…", khôi phục dữ liệu mẫu.
- Phân quyền server: AuthGuard → CASL ability → `scopeFilter` → kiểm tra theo bản ghi.
- `audit_logs` ghi bằng interceptor cho mọi request ghi dữ liệu.
- Chạy local không Docker theo mục 14.6: `scripts/setup-db.sql` tạo cơ sở dữ liệu trên PostgreSQL cài sẵn; `pnpm build && pnpm start` chạy API và phục vụ luôn file Vue đã build ở `localhost:3000`.

**Chưa có (để giai đoạn sau):** đăng ký/chờ duyệt, màn quản trị tài khoản, trang Cảnh báo, thông báo/job, ký cuối giai đoạn, tạm dừng, đổi phân công, trình soạn và vòng đời phiên bản, doanh số, Rubric, Buddy Score, phiếu đánh giá, lên Level, Excel/CSV, tệp đính kèm.

### 5.2 Bảng dữ liệu MVP (Drizzle, `apps/api/src/db/schema.ts`)

`areas`, `stores`, `users` (+ `can_buddy`, `can_approve_versions`), `user_store_scopes`, `user_area_scopes`, `credentials`, `system_settings` (`fake_today`), `versions` (`code`, `criteria_line`, `status`, `effective_from/to`, `content jsonb`), `staff`, `level_runs` (+ `ack_by/ack_at`, `row_version`), `run_assignments`, `run_tasks`, `task_confirmations` (unique `(task_id, role)` khi còn hiệu lực), `task_events`, `audit_logs`.
Các bảng còn lại của mục 13.3 thêm theo từng giai đoạn.

### 5.3 Gói `packages/shared` (lõi, viết trước UI)

| File | Nội dung |
|---|---|
| `schemas/version.ts` | `VersionContentSchema`: levels, goals, stages (`offset_start/end`, `signers`), items (`item_key`, `verifiers[]`, `require_nv_first`, `due_offset`, `gpp`, `required`, `allow_na`, `data_source`, `depends_on[]`), schedule params (10.4), statuses |
| `schedule/dates.ts` | `addDays`, `diffDays`, `today(tz)`; `buildRunTasks(content, levelKey, startDate)` → danh sách `{item_key, open_date, due_date}`; `stageWindow`, `currentStage`, `dayIndex` (ngày thứ N/tổng), `plannedEnd` |
| `schedule/state.ts` | `computeTaskState(task, confirmations, deps, today, params)` → `{code, label, tone}` theo thứ tự ưu tiên 10.3 |
| `rules/confirm.ts` | `requiredRoles(item)`, `missingRoles`, `canConfirm(actor, task, role, run)` (R05, R06, R10), `isDone` (R04) |
| `rules/assignee.ts` | Phân giải vai trò → người (10.5, kể cả fallback NV chưa có tài khoản → Buddy → CHT) |
| `__tests__/` | T-L01, T-L02, T-L03, T-L04, T-L07; T-X01..T-X06, T-X08 dưới dạng unit test |

### 5.4 API MVP (`/api/v1`)

`POST /auth/login|logout` · `GET /demo/accounts` · `GET|PUT /demo/clock` · `POST /demo/reset` · `GET /me` · `GET /me/today` · `GET /me/inbox` · `GET /versions/active` · `GET|POST /staff`, `GET /staff/:id` · `POST /staff/:id/runs` · `POST /runs/:id/ack` · `GET /runs/:id/tasks` · `POST /tasks/:id/confirm|undo|rework|status`.

Module NestJS: `auth`, `org` (chỉ đọc), `versions` (chỉ đọc), `staff`, `runs`, `tasks`, `audit`, `demo`, `common/clock`.

### 5.5 Kế hoạch theo ngày

Làm theo **lát cắt dọc**: mỗi lát gồm cả API lẫn giao diện, xong là kiểm tra được bằng mắt (không dựng giao diện trên dữ liệu giả).

> **Tiến độ (17/10/2026): xong giai đoạn 1 (MVP, D1–D10).**
> - 64 test đạt: 36 lõi nghiệp vụ (T-L01..T-L04, T-L06, T-L07, T-X01..T-X08, dữ liệu v2.1) và 28 test API (T-X01..T-X07, T-U05, T-L04, R08, chống ghi đè, phạm vi danh sách nhân sự, thêm nhân viên, ngày giả lập, khôi phục dữ liệu mẫu).
> - Kịch bản nghiệm thu 5.6 chạy trọn trên trình duyệt (bản `pnpm build && pnpm start`, cơ sở dữ liệu trống tự migrate + seed), không lỗi console.
> - Lệch so với đặc tả: NestJS 11 thay cho 10; PostgreSQL 18 trên máy dev (tương thích 16); tab Checklist dùng dòng đầu việc (ItemRow) thay cho bảng 7 cột của N3; T-X08 (phụ thuộc) mới test ở lõi nghiệp vụ vì v2.1 chưa khai báo phụ thuộc; `source_ref` (số thứ tự Excel) chưa điền; thêm tài khoản mẫu `hanh@` (NV chưa có hồ sơ) để demo bước 2.
> - Việc tiếp theo: giai đoạn 2 (mục 6).
>
> **Tiến độ (18/10/2026): làm trước phần quản lý checklist của giai đoạn 3 theo yêu cầu.**
> - Xong: vòng đời phiên bản (nháp → chờ duyệt → ban hành có ngày hiệu lực, trả về, rút về, xóa nháp, xuất JSON); phân loại sửa diễn đạt / thay đổi tiêu chí và cấp số 2.1.1 / 2.2; chọn phiên bản theo dòng tiêu chí (R01, R02); trigger R03; trình soạn checklist (giai đoạn, đầu việc, người xác nhận, hạn, cờ, phụ thuộc, sắp xếp, chuyển giai đoạn, chia đều hạn, thang thời gian, tìm/lọc); tham số lịch; kiểm tra CK-01..CK-11 ngay khi soạn; tab "Duyệt phiên bản" cho người duyệt.
> - 90 test đạt (50 lõi nghiệp vụ, 40 API, gồm T-V01..T-V04, T-V06); luồng soạn → gửi duyệt → ban hành chạy trọn trên trình duyệt.
> - Còn lại của giai đoạn 3: trình soạn Khung năng lực (mục 6), phiếu đánh giá (mục 7.4, CK-12..14), xem trước giao diện điện thoại (mục 7.6), chuyển phiên bản cho NV đang dở Level (mục 8.4, T-V05), nhập/xuất Excel (giai đoạn 5).
>
> **Tiến độ (18/10/2026): xong giai đoạn 4 trừ Buddy Score.**
> - Doanh số theo tháng của Level, có tổng, trung bình, cửa sổ xét KPI (R15); quan sát Rubric (R16); phiếu đánh giá có số liệu tự động, gợi ý theo nguồn POS/Rubric, đếm ý nhận xét; chuỗi ký CHT → QLKV → BP ĐT → NV (R12, R13); BP ĐT ký thì tự lên Level (V9), gia hạn (R14) hoặc đóng lượt; nhóm "Chữ ký chờ bạn"; NV được nhắc ký nhận kết quả.
> - Cấu hình KPI, Rubric (Phụ lục C N1), phiếu đánh giá nằm trong nội dung phiên bản; đổi cấu hình là thay đổi tiêu chí.
> - 113 test đạt (61 lõi nghiệp vụ, 52 API); luồng nhập doanh số → Rubric → phiếu → lên Level chạy trọn trên trình duyệt.
> - Chưa làm: Buddy Score (mục 11.5), quy tắc cảnh báo doanh số/Rubric (giai đoạn 2), miễn chỉ tiêu tháng đầu khi vào từ ngày 15 (V8), trả phiếu về để sửa sau khi đã ký.
>
> **Tiến độ (19/10/2026): Khung năng lực do BP Đào tạo quản lý (theo quyết định của người dùng: giữ Khung năng lực, chỉ BP ĐT sửa; giữ toàn bộ phần đánh giá).**
> - Trình soạn: tab "Khung năng lực" trong Thiết kế lộ trình (thông tin Level, mục tiêu, phân công, KPI và cách xét, LMS/tại quầy, phiếu đánh giá 7.4, Rubric, giới thiệu chung). Kiểm tra KNL-00/03/04/05/06/10, CK-12/13 chạy cùng CK-xx; bấm lỗi nhảy đúng tab và mục.
> - Trang "Khung năng lực" chỉ xem (`GET /framework`) cho CHT, QLKV, BP ĐT. Chỉ BP ĐT sửa được nội dung (CASL + test 403).
> - V20: công tắc "BP Đào tạo tự duyệt và ban hành" (`system_settings.bp_self_publish`, mặc định tắt) ở Quản trị.
> - 122 test đạt (65 lõi nghiệp vụ, 57 API). Luồng trên trình duyệt: sửa KPI → KNL-04 chặn gửi duyệt → sửa → lưu; CHT/QLKV chỉ xem; điện thoại 390 px không tràn ngang.
> - Chưa làm của mục 6.1: Buddy Score, quy tắc chuyển Level, cảnh báo, SKU/GPP/Career Path; xem trước điện thoại (7.6); chuyển phiên bản 8.4.
>
> **Tiến độ (19/10/2026): xong giai đoạn 2 (mục 6).**
> - Quản trị người dùng: đăng ký → chờ duyệt → duyệt (chốt vai trò, phạm vi) / từ chối có lý do; danh sách tài khoản có bộ lọc; trang chi tiết sửa vai trò, phạm vi, quyền bổ sung, trạng thái, lịch sử `user_changes`; chuyển giao bắt buộc khi khóa/cho nghỉ/đổi vai trò người đang được phân công (R20); chặn hạ BP ĐT cuối cùng (R19); tạo tài khoản; nhập CSV có xem trước; danh mục cửa hàng, khu vực.
> - Ký cuối giai đoạn (R11, R12) ở chân thẻ giai đoạn và trong "Chữ ký chờ bạn".
> - Cảnh báo theo mục 11.6 (trừ Buddy Score): trang Cảnh báo, cột ở Nhân sự, đầu Hồ sơ NV, huy hiệu tab; khối "Cảnh báo trong khu vực" cho QLKV (T-L08). Tính trực tiếp khi đọc, không lưu bảng.
> - Thông báo trong ứng dụng (chuông, trang Thông báo) cho các sự kiện mục 10.6; job bản tin sáng, leo thang, nhắc lượt sắp bắt đầu, kích hoạt phiên bản, có khóa chống trùng; chạy khi khởi động, sang ngày, đổi ngày giả lập, khôi phục dữ liệu mẫu, "Chạy ngay". Không dùng `@nestjs/schedule` (bộ đếm 15 phút trong tiến trình).
> - Tạm dừng lượt (CHT đề xuất, QLKV/BP ĐT duyệt, lùi mốc, `task_date_changes`, T-L05); đổi Buddy/CHT/QLKV; chuyển cửa hàng; ngừng theo dõi có chuyển giao Buddy.
> - Nhật ký hệ thống (lọc người, thao tác, ngày); xuất CSV tiến độ theo phạm vi.
> - 162 test đạt (78 lõi nghiệp vụ, 84 API, gồm T-U01..T-U04, T-U06, T-X09, T-L05, T-L07, T-L08). Kịch bản giai đoạn 2 chạy trọn trên trình duyệt, không lỗi console/5xx; điện thoại 390 px không tràn ngang.
> - Lệch so với đặc tả: quy tắc cảnh báo cố định trong mã (chưa cấu hình theo phiên bản ở "Thiết lập chung"); danh sách tài khoản chỉ BP ĐT xem (ma trận cho CHT/QLKV xem trong phạm vi); chưa có OTP, Mailpit, đổi mật khẩu.
> - Còn lại: Buddy Score (cả cảnh báo kèm theo), chuyển phiên bản cho NV đang dở Level (8.4), xem trước điện thoại (7.6), giai đoạn 5.

| Ngày | Việc | Kết quả kiểm tra được |
|---|---|---|
| D1 | `scripts/setup-db.sql`, monorepo pnpm, `.env.example`, NestJS + Drizzle kết nối PG, `/api/v1/health`, Vue + Vite proxy `/api`, `tokens.css` theo N3 + khung trang (thanh trên, tab theo vai trò) | `pnpm dev` mở được khung trang; `/api/v1/health` báo kết nối DB OK |
| D2 | `VersionContentSchema` + `seed/v2.1.json` trích từ `LEVELS`/`OV` của N3 + `schedule/*`, `rules/*` trong shared + test T-L01..04, T-L07, quy tắc xác nhận | `pnpm -F @lotrinh/shared test` xanh |
| D3–D4 | Schema DB + migration; seed (khu vực HN1, Nhà thuốc A/B, 11 tài khoản mục 14.12, v2.1, NV và lượt Level **tính lùi từ ngày seed**: Lan −26, Tuấn −9, Mai +2, Linh −61, Nam −138 (L2), Hùng −229, Thảo −199 (L3)); đăng nhập + đăng nhập nhanh + đổi tài khoản; `ClockService` + ngày giả lập; **màn Hôm nay** + Tổng quan Level + "Tôi đã đọc và hiểu" | Đăng nhập Lan thấy việc quá hạn, mục bị yêu cầu làm lại; tua ngày thì trạng thái đổi theo |
| D5–D6 | Xác nhận / hủy / yêu cầu làm lại / cần hỗ trợ / N/A theo R04–R10, `task_events`, `row_version`, nhật ký `audit_logs`; **màn Việc cần xử lý** + `ItemRow` bấm được; test API T-X01..T-X08, T-U05 | Lan báo xong → Hùng thấy ở đầu hàng đợi và xác nhận; Hà yêu cầu làm lại |
| D7–D8 | Nhân sự (bảng trong phạm vi), Hồ sơ NV + tab Checklist theo giai đoạn, form **Thêm nhân viên + bắt đầu L1**, trang **Công cụ demo** | Tua ngày, thấy lịch Tuấn lệch Lan đúng số ngày |
| D9–D10 | Phân quyền theo phạm vi đầy đủ (CASL + `scopeFilter`), responsive ≤ 620 px, `pnpm build` + `pnpm start` (API phục vụ file tĩnh), migrate + seed tự chạy khi DB trống, README | Máy chỉ có Node + pnpm + PostgreSQL: làm theo README → `localhost:3000` chạy được trong dưới 10 phút; chạy trọn kịch bản 5.6 |
| D11–12 | Dự phòng | |

### 5.6 Kịch bản demo MVP (~7 phút) = tiêu chí nghiệm thu

1. Đăng nhập nhanh **BP ĐT** → Công cụ demo: thấy ngày hiện tại.
2. Nhân sự → **Thêm nhân viên** "Hạnh", Nhà thuốc A, Buddy Hùng, bắt đầu L1 **ngày mai**. Hôm nay của Hạnh hiện "bắt đầu ngày dd/mm (còn 1 ngày)" (T-L04).
3. Tua **+1 ngày** → đổi sang **Hùng**: Việc cần xử lý có việc tuần 1 của Hạnh; thấy lịch của Tuấn (vào giữa tuần) lệch đúng ngày.
4. Đổi sang **Lan** (DevTools chế độ điện thoại): thấy mục quá hạn + mục bị yêu cầu làm lại; bấm "Tôi đã làm xong" một mục → chip NV ✓ (T-X01).
5. **Hùng** xác nhận → mục "Xong" (T-X02). Hùng không có nút xác nhận phần NV của Lan (T-X05).
6. **CHT Hà** yêu cầu làm lại mục khác: không nhập lý do thì bị chặn (T-X03); có lý do thì mọi xác nhận bị xóa, Lan thấy cảnh báo đỏ (T-X04).
7. Tua **+7 ngày** → mục trễ hiện "Trễ N ngày"; Hà cố mở hồ sơ NV Nhà thuốc B qua URL thì bị từ chối (T-U05).

---

## 6. Giai đoạn 2 – Demo vòng 1 hoàn chỉnh (2 tuần)

| Tuần | Hạng mục | Mục đặc tả | Kiểm thử |
|---|---|---|---|
| T1 | **Quản trị người dùng:** đăng ký → chờ duyệt → duyệt/từ chối (bắt buộc lý do); danh sách tài khoản + bộ lọc; trang chi tiết (vai trò, phạm vi, quyền bổ sung, lịch sử `user_changes`); khóa/nghỉ kèm **màn Chuyển giao**; chặn hạ BP ĐT cuối cùng; danh mục cửa hàng/khu vực; nhập CSV có xem trước | 5.1–5.6, R19, R20 | T-U01..T-U04, T-U06 |
| T1 | **Ký cuối giai đoạn** (`stage_signoffs`, R11, R12, cửa sổ `signOpenBefore/signDueAfter`), đưa vào hàng đợi "Chữ ký chờ bạn" | 10.2, 11.3 | T-X09 |
| T2 | **Cảnh báo:** module `alerts` tính theo `alert_rules` trong phiên bản (các quy tắc 11.6 chưa phụ thuộc doanh số/Rubric); trang Cảnh báo; badge tab; ô thống kê và cột cảnh báo ở Nhân sự; khối "Cảnh báo trong khu vực" cho QLKV | 11.4, 11.6 | T-L08 |
| T2 | **Thông báo + job:** bảng `notifications`, chuông + trang Thông báo; `@nestjs/schedule` với 5 job mục 14.11 + khóa chống trùng; nút "Chạy ngay"; đổi ngày giả lập thì tự chạy kích hoạt phiên bản + tính lại cảnh báo; Mailpit tùy chọn | 10.6, 14.11 | T-L07 (bản tin) |
| T2 | **Tạm dừng lượt** (CHT đề xuất, QLKV/BP ĐT duyệt, lùi mốc, `task_date_changes`); **đổi Buddy/CHT/QLKV**, chuyển cửa hàng, ngừng theo dõi | 9.3, 10.2 | T-L05 |
| T2 | **Nhật ký hệ thống** (trang lọc, chỉ BP ĐT); **xuất CSV tiến độ** | 5.7, 11.4 | |

---

## 7. Giai đoạn 3 – Thiết kế lộ trình & phiên bản (3 tuần)

- **T1 – Vòng đời + phân loại thay đổi:** tạo nháp từ bản bất kỳ; `PUT /versions/:id/content`; submit/withdraw/approve/reject; ngày hiệu lực; bản cũ hết hiệu lực = ngày mới − 1; job `version-activate`; trigger PG chặn sửa bản đã ban hành (R03); `change-kind/classify.ts` trong shared (danh sách trường "diễn đạt" mục 8.3) → đề xuất số phiên bản 2.1.1 / 2.2 và dải tác động; `getContentForRun` lấy câu chữ mới nhất trong dòng tiêu chí; tab "Duyệt phiên bản" cho người có quyền.
- **T1 – Kiểm tra hợp lệ:** `validation/knl.ts` (KNL-01..11), `validation/ck.ts` (CK-01..15) trong shared, chạy trong trình duyệt khi soạn và ở server khi gửi duyệt; khung "Kiểm tra trước khi gửi duyệt", bấm lỗi thì nhảy tới đúng tab/dòng.
- **T2 – Trình soạn Checklist** (7.3): bố cục 1440 px, cột phiên bản bên trái; chọn Level; thang thời gian giai đoạn; thẻ giai đoạn (a–b, ca, chuỗi ký chip); dòng đầu việc 2 cột + thuộc tính; thêm/sửa/xóa/sắp xếp (vuedraggable)/chuyển giai đoạn; đổi mã có cảnh báo; bật GPP tự bật Bắt buộc; gợi ý hạn chia đều; tìm/lọc. Tab **Phiếu đánh giá** (7.4) và **Thiết lập chung** (7.5).
- **T3 – Trình soạn Khung năng lực** (6.1), ưu tiên: Thời gian Level → Mục tiêu → Doanh số → Rubric → Buddy Score → Chuyển Level → Cảnh báo → Phân công trách nhiệm; SKU/GPP/Career Path để cuối (rich text đơn giản). **Xem trước** giao diện điện thoại (7.6). **Chuyển phiên bản** cho NV đang dở Level (8.4): xem trước tác động, ân hạn, đối chiếu mã, trạng thái `void`, log `version_migrations`.
- Seed thêm **bản nháp v2.2** (2 thay đổi) để demo.
- Kiểm thử: T-V01..T-V06.

---

## 8. Giai đoạn 4 – Đánh giá & chuyển Level (2 tuần)

- **Doanh số** (`sales_monthly`, tab Doanh số, nhập theo tháng của Level, đánh giá R15: L1 2/2 tháng đạt, L2–L4 trung bình 2 tháng cuối; miễn tháng đầu theo `exemptFromDay`).
- **Quan sát Rubric** (`observations`, form 5 tiêu chí 1–3, R16, tỉ lệ đạt so với 80%).
- **Buddy Score** (`buddy_scores`, NV chấm sau `daysAfter` ngày, trung bình có trọng số, R17, cảnh báo họp ba bên, hiển thị ở hồ sơ Buddy).
- **Phiếu đánh giá + chuỗi ký** (`level_reviews`, `review_signatures`): 4 ô số liệu tự động, tiêu chí định lượng điền sẵn, nhận xét đếm ý tối thiểu, R12, R13.
- **Lên Level** (transaction: đóng lượt cũ, tạo lượt mới ngày bắt đầu = ngày BP ĐT ký, V9), **gia hạn** (R14, chặn khi vượt số lần), **không đạt**; tab **Lịch sử lượt**, bộ chọn Level ở hồ sơ, `PathBar` đầy đủ.
- Bật các quy tắc cảnh báo phụ thuộc doanh số, Rubric, Buddy Score; giả lập "LMS báo hoàn thành" cho đầu việc nguồn LMS.

---

## 9. Giai đoạn 5 – Hoàn thiện demo (1 tuần)

- Nhập checklist từ Excel theo mẫu N2 → bản nháp mới (dùng lại `seed/extract-n2.ts`); xuất JSON/XLSX; in PDF bằng `@media print`.
- Bằng chứng đầu việc (điểm số, tệp ảnh/PDF ≤ 10 MB qua `StorageService` → `./storage`).
- Swagger `/api/docs` hoàn chỉnh; chế độ tối chọn tay; rà soát a11y (focus ring, `aria-expanded`, không chỉ dùng màu).
- Playwright e2e chạy **kịch bản 15 phút mục 14.13**; kiểm tra cài đặt trên máy sạch dưới 10 phút; README cuối.

---

## 10. Rủi ro và cách giảm

| Rủi ro | Giảm thiểu |
|---|---|
| Seed v2.1 lệch giữa N2 và N3 (mục 16) | Seed là file JSON tách khỏi code; lấy N3 làm chuẩn, đối chiếu N2; Zod + validation CK bắt lỗi |
| BP ĐT chưa chốt V1/V2/V7 | Không chặn MVP; ghi rõ "giả định" trên README và màn Khung năng lực |
| Sai lệch ngày/múi giờ | Ngày là chuỗi `YYYY-MM-DD`, mọi "hôm nay" qua `ClockService`, test T-L ở shared |
| Phình phạm vi khi BP ĐT xem MVP | Ghi góp ý vào backlog giai đoạn 2–5, không chèn vào MVP |
| Trình soạn phiên bản quá lớn cho 1 dev | Lưu JSONB; dùng chung validation giữa client/server; làm Checklist trước Khung NL |

---

## 11. Verification (cách kiểm chứng)

- **Unit (shared):** `pnpm -F shared test` – bộ T-L01..T-L08, T-X01..T-X09 dạng hàm thuần; KNL/CK, change-kind ở giai đoạn 3.
- **API:** `pnpm -F api test` – quyền và phạm vi (T-U05, T-U03, T-U04), quy tắc xác nhận, T-V06 (sửa bản đã ban hành bị từ chối).
- **Chạy thật trên máy local (không Docker):** `cp .env.example .env && pnpm install && pnpm build && pnpm start` → mở `http://localhost:3000`, đi hết kịch bản demo MVP (mục 5.6), sau giai đoạn 5 là kịch bản 15 phút (14.13).
- **Giao diện điện thoại:** DevTools chế độ thiết bị ≤ 620 px cho Hôm nay, Việc cần xử lý, Hồ sơ NV.
- **E2E (giai đoạn 5):** Playwright chạy tự động kịch bản 14.13.

## 12. File đầu tiên sẽ tạo (khi bắt đầu thực thi)

`package.json`, `pnpm-workspace.yaml`, `.env.example`, `scripts/setup-db.sql`, `packages/shared/src/{schemas,schedule,rules}/*`, `seed/extract-n2.ts`, `seed/v2.1.json`, `apps/api/src/{main.ts,app.module.ts,db/schema.ts,db/seed.ts,common/clock/*,modules/*}`, `apps/web/src/{styles/tokens.css,components/*,pages/*}`.
