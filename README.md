# Lộ trình Upharma

Quản lý khung năng lực, checklist onboarding và lộ trình 4 Level cho nhân viên bán hàng nhà thuốc Upharma.
Bản demo chạy trên một máy tính, không dùng Docker.

- Đặc tả: [docs/thiet-ke/Upharma_Lo_trinh_NVBH_Tai_lieu_thiet_ke.md](docs/thiet-ke/Upharma_Lo_trinh_NVBH_Tai_lieu_thiet_ke.md)
- Kế hoạch triển khai và tiến độ: [docs/ke-hoach/KE_HOACH_TRIEN_KHAI.md](docs/ke-hoach/KE_HOACH_TRIEN_KHAI.md)
- Tài liệu nguồn N1, N2, N3: [docs/nguon/](docs/nguon/)

## Cài đặt (một lần)

Cần Node.js 20 trở lên, pnpm 9, PostgreSQL 16 trở lên cài trực tiếp trên máy.

```bash
# Tạo user và cơ sở dữ liệu lotrinh (demo), lotrinh_test (test)
sudo -u postgres psql < scripts/setup-db.sql

cp .env.example .env          # đổi JWT_SECRET thành chuỗi ngẫu nhiên
pnpm install
```

## Chạy bản demo

```bash
pnpm build
pnpm start
```

Mở http://localhost:3000. Lần chạy đầu, API tự tạo bảng và nạp dữ liệu mẫu nếu cơ sở dữ liệu còn trống. Giữ cửa sổ terminal mở trong buổi demo; `Ctrl+C` để dừng.

Màn đăng nhập có **đăng nhập nhanh** các tài khoản mẫu (mật khẩu chung `Demo@123`); sau khi vào có thể đổi tài khoản ở thanh trên cùng.
Đăng nhập BP Đào tạo (Ngô Quốc Bảo) để tua ngày giả lập (dải dưới thanh tab) và khôi phục dữ liệu mẫu (tab Quản trị).

## Chạy khi phát triển

```bash
pnpm dev
```

Mở http://localhost:5173 (Vite, tự nạp lại khi sửa mã; `/api` được chuyển sang API ở cổng 3000).

| Lệnh | Việc |
|---|---|
| `pnpm dev` | Chạy shared (theo dõi thay đổi), API, web cùng lúc |
| `pnpm build` / `pnpm start` | Build cả 3 gói / chạy API phục vụ luôn giao diện ở cổng 3000 |
| `pnpm test` | Test lõi nghiệp vụ (shared) và test API (trên `lotrinh_test`, bị xóa sạch mỗi lần chạy) |
| `pnpm typecheck` | Kiểm tra kiểu cả 3 gói |
| `pnpm db:reset` | Xóa sạch, chạy migration, nạp lại dữ liệu mẫu (ngày bắt đầu Level tính lùi từ hôm nay) |
| `pnpm db:generate` | Sinh migration SQL sau khi sửa `apps/api/src/db/schema.ts` |
| `pnpm seed:extract` | Trích lại `seed/v2.1.json` từ giao diện tham chiếu N3 |
| `pg_dump -h localhost -U lotrinh lotrinh > backup.sql` | Sao lưu nhanh trạng thái demo |

## Tài khoản mẫu

| Tài khoản | Vai trò | Tình huống |
|---|---|---|
| admin@upharma.local | BP Đào tạo | Quản trị, ngày giả lập, khôi phục dữ liệu mẫu |
| huy@upharma.local | QLKV Hà Nội 1 | Thấy mọi cửa hàng trong khu vực; người duyệt phiên bản |
| ha@upharma.local | CHT Nhà thuốc A | |
| binh@upharma.local | CHT Nhà thuốc B | Đồng thời là Buddy của Nam |
| hung@upharma.local | NV Level 3 | Buddy của Lan, Tuấn, Mai: tab "Việc kèm cặp" |
| thao@upharma.local | NV Level 3 | Buddy của Linh |
| lan@upharma.local | NV Level 1, ngày thứ 27 | Có mục quá hạn, mục bị yêu cầu làm lại |
| tuan@upharma.local | NV Level 1, ngày thứ 10 | Có mục cần hỗ trợ |
| mai@upharma.local | NV Level 1, bắt đầu sau 2 ngày | Việc ở trạng thái "Sắp mở" |
| linh@upharma.local | NV Level 1, ngày thứ 62 | Đã xong checklist, đủ doanh số và Rubric: demo phiếu đánh giá, lên Level 2 |
| nam@upharma.local | NV Level 2, ngày thứ 139 | Có doanh số 4 tháng, 4 ca Rubric (1 ca trượt) |
| hanh@upharma.local | NV, chưa có hồ sơ | Dùng để demo "Thêm nhân viên" |
| moi@upharma.local | Chờ duyệt | Chưa đăng nhập được |

## Kịch bản demo MVP (khoảng 7 phút)

1. **BP ĐT** → Quản trị: thấy ngày hiện tại trong Công cụ demo.
2. **BP ĐT** → Nhân sự → Thêm nhân viên: chọn tài khoản Bùi Thị Hạnh, ngày nhận việc là ngày mai, Buddy Hùng. Đăng nhập **Hạnh**: "Lộ trình Level 1 bắt đầu ngày … (còn 1 ngày)".
3. **BP ĐT** tua +1 ngày → **Hùng** → Việc kèm cặp: có việc tuần 1 của Hạnh.
4. **Lan** (chế độ điện thoại trong DevTools): mở một mục → "Tôi đã làm xong".
5. **Hùng**: mục của Lan ở đầu hàng đợi → "Xác nhận đạt (Buddy)".
6. **CHT Hà** → Nhân sự → Lan → Checklist: "Yêu cầu làm lại" (bắt buộc nhập lý do); Lan thấy cảnh báo đỏ.
7. **BP ĐT** tua +1 tuần: mục trễ tăng. Hà mở hồ sơ một NV Nhà thuốc B qua URL: bị từ chối.

Xong thì BP ĐT → Quản trị → "Khôi phục dữ liệu mẫu".

## Đánh giá và lên Level (Hồ sơ NV)

Hồ sơ NV có các tab **Doanh số**, **Quan sát Rubric**, **Chuyển Level**; bộ chọn Level bên phải để xem lại Level đã qua.

- **Doanh số:** CHT, QLKV (trong phạm vi) hoặc BP ĐT nhập DS tổng và DS hệ số 1 theo tháng của Level (triệu đồng). Bảng có dòng Tổng cộng, Trung bình/tháng và Cửa sổ xét KPI: L1 mọi tháng 1–2 phải đạt; L2–L4 trung bình 2 tháng cuối Level.
- **Quan sát Rubric:** Buddy, CHT, QLKV của lượt chấm 5 tiêu chí 1–3 (Phụ lục C). Ca đạt khi tổng ≥ 10/15 và không tiêu chí nào 1 điểm; mục tiêu ≥ 80% ca đạt, tối thiểu 3 ca/tháng.
- **Chuyển Level:** phiếu mở từ ngày mở giai đoạn cuối. Buddy (L1), CHT hoặc BP ĐT điền; ký theo thứ tự CHT → QLKV → BP ĐT → NV. Khi **BP ĐT ký**, hệ thống tự áp dụng kết quả: lên Level mới từ hôm nay (tạo checklist Level mới), gia hạn 1 tháng (tối đa 2 lần, mở vòng phiếu mới), hoặc đóng lượt Không đạt.

Kịch bản thử: **CHT Bình** → Việc cần xử lý → "Chữ ký chờ bạn" → phiếu của **Linh** (đã đủ doanh số và Rubric) → điền, lưu, ký → **QLKV Huy** ký → **BP ĐT** ký → Linh lên Level 2 → **Linh** đăng nhập, ký nhận kết quả.

## Quản lý checklist (tab "Thiết kế lộ trình")

Khung năng lực và Checklist được phát hành chung một số phiên bản (mục 8 đặc tả). Bản đã ban hành không sửa được; muốn thay đổi thì tạo bản nháp.

1. **BP ĐT** → Thiết kế lộ trình: dữ liệu mẫu có sẵn một bản nháp với 2 thay đổi. Sửa giai đoạn, đầu việc (nội dung, người xác nhận, hạn, cờ GPP, phụ thuộc), thêm/xóa/sắp xếp, chuyển giai đoạn. `Ctrl+S` để lưu.
2. Khung **"Kiểm tra trước khi gửi duyệt"** chạy ngay khi gõ (CK-01..CK-11); bấm vào lỗi để nhảy tới đúng dòng. Còn lỗi thì không gửi duyệt được.
3. **Dải tác động** cho biết đây là *sửa diễn đạt* (số 2.1.1, NV đang chạy thấy câu mới ngay) hay *thay đổi tiêu chí* (số 2.2, chỉ áp dụng cho lượt Level bắt đầu từ ngày hiệu lực).
4. Nhập ghi chú thay đổi → **Gửi duyệt**.
5. **QLKV Huy** (quyền "Người duyệt phiên bản") → tab "Duyệt phiên bản" → chọn ngày hiệu lực → **Duyệt và ban hành**, hoặc **Trả về nháp** kèm lý do. BP ĐT không tự duyệt được bản mình soạn.

Lưu ý có sẵn: CK-09 báo mục L1-6-5 nhắc "3 tháng" trong khi Level 1 dài 2 tháng (vấn đề V1) — có thể sửa bằng một bản sửa diễn đạt.

## Cấu trúc

```
apps/api/src      NestJS (mục 14.4–14.5 đặc tả)
  adapters/         phần hạ tầng tối giản thay được khi chạy thật: clock (ngày giả lập)
  common/           lỗi { code, message }, kiểm tra dữ liệu vào bằng Zod, phiên đăng nhập
  db/               schema Drizzle, migration SQL, dữ liệu mẫu, lệnh db:*
  modules/          access (ma trận quyền CASL + lọc phạm vi), audit, auth, demo, health,
                    me (Hôm nay, Việc cần xử lý), runs, staff, tasks, versions (vòng đời phiên bản),
                    sales, observations, reviews (phiếu đánh giá, chuỗi ký, lên Level)
  db/migrations/    SQL; 0002 là trigger chặn sửa, xóa bản đã ban hành (R03)
apps/web/src      Vue 3: api, components (ItemRow, StageChecklist, design/ trình soạn checklist…), designer/ (thao tác soạn),
                  pages, styles (bảng màu N3)
packages/shared   Lõi nghiệp vụ dùng chung API ↔ giao diện: schema phiên bản, tính lịch, trạng thái đầu việc,
                  quy tắc xác nhận và giao việc, kiểm tra hợp lệ CK (validation/), phân loại thay đổi (change-kind/)
seed/             Bộ lộ trình v2.1 (trích từ N3) và script trích
scripts/          setup-db.sql
docs/             thiet-ke/ (đặc tả) · ke-hoach/ (kế hoạch, tiến độ) · nguon/ (N1, N2, N3)
```

Nguyên tắc: mọi phép tính ngày và quyền nằm trong `packages/shared` (chạy giống nhau ở API và giao diện) hoặc `modules/access`;
"hôm nay" luôn lấy từ `ClockService` (không gọi `new Date()` trong nghiệp vụ); phạm vi dữ liệu luôn kiểm tra ở máy chủ.
