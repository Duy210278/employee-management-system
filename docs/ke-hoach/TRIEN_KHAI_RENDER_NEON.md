# Triển khai miễn phí: Render (ứng dụng) + Neon (PostgreSQL)

Một dịch vụ web trên Render chạy cả API lẫn giao diện đã build (giống `pnpm build && pnpm start` trên máy). Cơ sở dữ liệu ở Neon, cùng vùng Singapore. Không dùng Docker.

Cấu hình Render nằm sẵn ở [render.yaml](../../render.yaml). Lần khởi động đầu, ứng dụng tự tạo bảng (migration) và nạp dữ liệu mẫu vì `DEMO_MODE=true`.

## 1. Đưa code lên GitHub

Render lấy code từ GitHub, nên mọi thay đổi (kể cả `render.yaml`) phải được commit và push lên nhánh `main` của repo. Nên để repo ở chế độ riêng tư vì có tài liệu nội bộ trong `docs/nguon` và `seed/v2.1.json`; Render vẫn triển khai được repo riêng tư.

## 2. Tạo cơ sở dữ liệu ở Neon

1. Đăng ký tại https://neon.com (đăng nhập bằng GitHub cho nhanh).
2. Tạo project: tên tùy ý (ví dụ `lotrinh-upharma`), Postgres bản mới nhất (từ 16 trở lên), vùng **AWS Asia Pacific (Singapore)**.
3. Bấm **Connect**, tắt **Connection pooling** để lấy chuỗi **Direct connection** (migration chạy ổn định hơn), rồi sao chép chuỗi dạng:
   ```
   postgresql://neondb_owner:MẬT_KHẨU@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
   Giữ nguyên `sslmode=require&channel_binding=require` ở cuối.
4. Nên làm: vào cấu hình compute của nhánh `main`, đặt kích thước cố định **0.25 CU**. Gói miễn phí có 100 CU-giờ mỗi tháng, ở 0.25 CU dùng được khoảng 400 giờ; để tự tăng lên 2 CU thì hết rất nhanh. Neon tự ngủ sau 5 phút không có truy vấn.

## 3. Tạo dịch vụ ở Render

1. Đăng ký tại https://render.com bằng GitHub, cho phép Render đọc repo `employee-management-system`.
2. **New → Blueprint**, chọn repo. Render đọc `render.yaml` và hiện dịch vụ `lotrinh-upharma` (gói Free, vùng Singapore).
3. Ô **DATABASE_URL**: dán chuỗi Neon ở bước 2. `JWT_SECRET` được Render tự sinh ngẫu nhiên.
4. Bấm **Apply** (hoặc **Deploy Blueprint**). Lần build đầu mất vài phút. Trong Logs thấy hai dòng sau là xong:
   ```
   Cơ sở dữ liệu còn trống: đã nạp dữ liệu mẫu (mốc ngày …)
   Mở http://localhost:10000 (API: /api/v1, DEMO_MODE=true)
   ```
5. Mở địa chỉ Render cấp, dạng `https://lotrinh-upharma.onrender.com` (tên có thể có thêm hậu tố nếu bị trùng). Kiểm tra nhanh: `…/api/v1/health` trả `{"ok":true,"db":true,…}`.

## 4. Khi đã chạy

- **Ngủ khi không dùng:** sau 15 phút không ai truy cập, Render cho dịch vụ ngủ; lần mở kế tiếp chờ khoảng 1 phút. Job bản tin, nhắc việc chạy lại ngay khi thức dậy.
- **Cập nhật:** mỗi lần push lên `main`, Render tự build và triển khai lại. Migration mới tự chạy khi khởi động; dữ liệu giữ nguyên (chỉ nạp dữ liệu mẫu khi cơ sở dữ liệu trống).
- **Khôi phục dữ liệu mẫu, ngày giả lập:** đăng nhập BP Đào tạo → Quản trị → Cấu hình, công cụ demo.
- **Sao lưu:** `pg_dump "CHUỖI_NEON" > backup.sql` trên máy có cài PostgreSQL. Gói miễn phí của Neon chỉ giữ lịch sử khôi phục 6 giờ.
- **Giới hạn miễn phí:** Render 750 giờ chạy mỗi tháng (đủ cho một dịch vụ), 512 MB RAM. Neon 1 GB dữ liệu; hết 100 CU-giờ thì cơ sở dữ liệu tạm ngưng đến kỳ sau.

## 5. Lỗi thường gặp

| Hiện tượng trong Logs | Cách xử lý |
|---|---|
| `EROFS: read-only file system, unlink '/usr/bin/pnpm'` ở bước `corepack enable` (ảnh Node của Render để `/usr` chỉ đọc; `npm install -g` cũng hỏng vì lý do này) | Dùng lệnh trong `render.yaml`: corepack đặt `pnpm` vào `.corepack-bin` trong dự án rồi thêm vào PATH; Start Command là `cd apps/api && node dist/main.js`. Dịch vụ tạo tay (không qua Blueprint) thì chép hai lệnh này vào Settings → Build & Deploy |
| `Cấu hình .env không hợp lệ: DATABASE_URL…` | Chưa nhập biến DATABASE_URL: Environment → thêm rồi Manual Deploy |
| `Không kết nối được PostgreSQL` hoặc hết thời gian chờ | Kiểm tra lại chuỗi Neon (Direct connection, còn `sslmode=require`); xem project Neon có đang bị tạm ngưng do hết CU-giờ không |
| `SECURITY WARNING: The SSL modes 'prefer', 'require'…` | Vô hại (thư viện vẫn kiểm tra chứng chỉ đầy đủ). Muốn tắt thì đổi `sslmode=require` thành `sslmode=verify-full` trong DATABASE_URL |

## Lưu ý bảo mật

Với `DEMO_MODE=true`, ai có địa chỉ cũng đăng nhập nhanh được mọi tài khoản (kể cả BP Đào tạo), đổi ngày giả lập và xóa dữ liệu bằng "Khôi phục dữ liệu mẫu". Chỉ chia sẻ địa chỉ trong nhóm.
