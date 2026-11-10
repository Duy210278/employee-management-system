# Kế hoạch chuyển cơ sở dữ liệu từ PostgreSQL sang SQL Server

## Kết quả (10/11/2026, nhánh `sqlserver`)

Đã làm xong giai đoạn 0–6; giai đoạn 7 (chuyển dữ liệu) không cần vì chỉ dùng dữ liệu mẫu.

| Hạng mục | Kết quả |
|---|---|
| Thư viện | Drizzle `1.0.0-rc.5` với `mssql` 11; thử 9 điểm đều đạt ([KET_QUA_THU_DRIZZLE.md](../thiet-ke/sqlserver/KET_QUA_THU_DRIZZLE.md)) |
| CSDL | SQL Server 2022, schema `lotrinh`, 21 bảng (từ 26), CHECK cho mọi cột trạng thái, filtered unique index, trigger R03 |
| Kiểm thử | Typecheck sạch; 88 test `shared` và 104 test e2e (11 file) xanh trên SQL Server, bằng mốc PostgreSQL ở tag `pg-cuoi-cung` |
| Dữ liệu mẫu | Số dòng từng bảng khớp bản PostgreSQL (345 đầu việc, 293 xác nhận, 295 sự kiện…) |
| Chạy thật | `pnpm build && pnpm start`: kết nối CSDL, đăng nhập, Hôm nay, trang web chạy được |

Lỗi tìm ra trong lúc chuyển (đã sửa):
- Đổi Buddy của lượt chưa bắt đầu ghi phân công cũ có ngày kết thúc trước ngày bắt đầu (ràng buộc mới bắt được).
- Hai truy vấn chạy song song trong một giao dịch: `node-mssql` chỉ cho một yêu cầu một lúc.
- Hằng `true`/`false` trong câu SQL không tồn tại ở SQL Server.
- Trigger xóa phải là `INSTEAD OF DELETE` để chạy trước kiểm tra khóa ngoại như `BEFORE DELETE` của PostgreSQL.

Đi kèm: [KE_HOACH_LAM_SACH.md](KE_HOACH_LAM_SACH.md) (gom bảng, gộp API) và [01_tao_bang.sql](../thiet-ke/sqlserver/01_tao_bang.sql) (script tạo bảng SQL Server, chưa chạy thử).

## 1. Hiện trạng đã đo

Số liệu lấy bằng cách tìm trong `apps/api/src` và `apps/api/test`.

| Hạng mục | Số lượng | Ý nghĩa khi chuyển |
|---|---|---|
| File service, controller dùng Drizzle | 36 | Phạm vi sửa code |
| Driver | `pg` 8 và `drizzle-orm/node-postgres` (Drizzle 0.44) | Đổi sang driver `mssql` |
| Upsert `onConflictDoUpdate`, `onConflictDoNothing` | 7 chỗ | SQL Server không có cú pháp này, phải viết lại |
| `.returning()` | 21 chỗ | Đổi sang `OUTPUT` |
| Khóa dòng `.for('update')` | 5 chỗ | Đổi sang gợi ý `WITH (UPDLOCK, ROWLOCK)` |
| `count(*)::int` | 7 chỗ | Đổi thành `count(*)` |
| `sql` thô khác (`sql\`false\``, `DROP SCHEMA ... CASCADE`...) | vài chỗ | Sửa từng chỗ |
| Giao dịch `transaction(...)` | 23 chỗ | Giữ, nhưng cách khóa dòng khác PostgreSQL |
| Cột JSONB | 8 cột | Đọc, ghi qua kiểu tùy biến (chuỗi JSON) |
| Bắt mã lỗi của PostgreSQL | 0 chỗ | Tin tốt: không phải sửa. Trigger `versions_guard` chỉ là lớp bảo vệ cuối, code đã tự kiểm tra trạng thái bản nháp trước khi ghi |

Cải chính: lần trước tôi nói code API đang bắt mã lỗi PostgreSQL. Tìm lại thì không có chỗ nào.

Phần phụ thuộc PostgreSQL ít hơn dự tính ở mức code truy vấn. Phần nặng nhất là thay lớp truy cập dữ liệu và dựng lại hạ tầng test.

## 2. Quyết định về thư viện truy cập dữ liệu

Drizzle đã có hỗ trợ SQL Server trong nhánh v1.0 (còn ở giai đoạn beta, rc), dùng driver `mssql` và `drizzle-orm/node-mssql`. Dự án đang dùng Drizzle 0.44 bản ổn định cho PostgreSQL. Tôi chưa xác nhận được bản v1.0 đã ra chính thức chưa, và thiếu RQBv2 (dự án có dùng hay không cần kiểm tra).

| Phương án | Ưu | Nhược |
|---|---|---|
| A. Drizzle v1.0 (mssql-core) | Giữ cấu trúc code, `schema.ts` đổi sang `mssql-core`, ít sửa nhất | Bản chưa ổn định; lỗi cũ như INSERT dính cột tính toán (lỗi 271) cho thấy còn nhiều chỗ thô |
| B. Kysely + `mssql` | Ổn định, kiểu chặt | Phải viết lại gần toàn bộ truy vấn của 36 file |
| C. TypeORM hoặc Prisma | Hỗ trợ SQL Server tốt | Viết lại toàn bộ lớp dữ liệu, mô hình khác hẳn |

**Đề xuất:** thử phương án A trong một ngày (mục 3, giai đoạn 1). Nếu qua được thì dùng. Nếu không thì chuyển sang B.

## 3. Các giai đoạn

| GĐ | Việc | Ngày | Cổng kiểm tra |
|---|---|---|---|
| 0 | **Chuẩn bị.** Cài SQL Server, tạo CSDL `lotrinh` và `lotrinh_test`, bật `READ_COMMITTED_SNAPSHOT` cho cả hai. Chạy thử `01_tao_bang.sql` và sửa lỗi. Đặt tag git `pg-cuoi-cung` và chạy toàn bộ e2e trên PostgreSQL để có mốc so sánh | 0,5 | Script chạy sạch; e2e xanh trên PostgreSQL |
| 1 | **Thử nghiệm thư viện.** Dựng thử trên một nhánh riêng: 3 bảng, một giao dịch, upsert, `OUTPUT`, khóa dòng, cột JSON, ngày dạng chuỗi. Dùng đúng các kiểu truy vấn của `tasks.service` và `versions` | 1 | Quyết định A hoặc B |
| 2 | **Làm sạch trên PostgreSQL trước** theo `KE_HOACH_LAM_SACH.md`: gom bảng, siết ràng buộc, gộp API, bỏ đồng hồ demo. Gom trước để chỉ phải chuyển sang SQL Server một lần | 5 | e2e xanh trên PostgreSQL |
| 3 | **Chuyển lớp dữ liệu.** `schema.ts` sang `mssql-core`; `client.ts` (kết nối, đọc ngày về dạng chuỗi, múi giờ); kiểu JSON tùy biến; migration lấy từ `01_tao_bang.sql` và trigger; seed; `dropAll` | 2 | Seed chạy sạch, API khởi động được |
| 4 | **Chuyển truy vấn.** Viết hàm dùng chung cho upsert; đổi `.returning()` sang `OUTPUT`; đổi khóa dòng; sửa `count(*)::int` và `sql` thô; rà thứ tự sắp xếp có NULL | 3 | Từng module qua e2e |
| 5 | **Hạ tầng test.** Reset CSDL giữa các lần chạy trên SQL Server; cập nhật `helpers.ts` và các test đang tự tạo kết nối (`operations`, `versions`) | 1,5 | Cả 11 file e2e xanh trên SQL Server |
| 6 | **Triển khai và tài liệu.** Chỗ chạy demo (mục 5), `render.yaml`, biến môi trường, `CO_SO_DU_LIEU.md`, sơ đồ DB | 1 | Bản demo chạy được |
| 7 | **Chuyển dữ liệu** từ PostgreSQL sang SQL Server (chỉ khi có dữ liệu thật cần giữ) | 1 | Số dòng từng bảng khớp |

Phần riêng của việc chuyển SQL Server (GĐ 0, 1, 3–7) là khoảng **8–12 ngày**. GĐ 2 là việc đã có trong kế hoạch làm sạch.

## 4. Các điểm kỹ thuật dễ lỗi

1. **`OUTPUT` và trigger.** SQL Server không cho dùng `OUTPUT` thường trên bảng có trigger đang bật. Bảng `versions` có hai trigger, nên các lệnh sửa hoặc xóa trên bảng này không dùng `.returning()` được. Phải đọc lại sau khi ghi, hoặc dùng `OUTPUT ... INTO`.
2. **Khóa dòng.** Mặc định SQL Server chặn người đọc khi có người đang ghi. Đã bật `READ_COMMITTED_SNAPSHOT` ở giai đoạn 0 để hành xử gần với PostgreSQL. Năm chỗ `.for('update')` (tasks, versions, users, run-manage, reviews) đổi sang gợi ý `UPDLOCK, ROWLOCK` trong giao dịch.
3. **Upsert.** Bảy chỗ upsert đổi sang một hàm chung: thử sửa, không có dòng nào thì thêm, tất cả trong một giao dịch với khóa `UPDLOCK, HOLDLOCK` để tránh hai người cùng thêm. Các chỗ liên quan: `sales`, `cht` (nhật ký, đánh giá), `reviews`, `runs`, `notifications`.
4. **Ngày dạng chuỗi.** Hiện `client.ts` ép kiểu `date` về chuỗi `YYYY-MM-DD`. Driver `mssql` trả `DATE` thành đối tượng ngày theo múi giờ, dễ lệch một ngày. Phải cấu hình đọc về chuỗi từ giai đoạn 3, và có test riêng cho ranh giới nửa đêm.
5. **JSON.** SQL Server không có kiểu JSON bản ổn định ở các phiên bản cũ. Dùng `NVARCHAR(MAX)` và một kiểu tùy biến chuyển qua lại với đối tượng. Code hiện chỉ đọc cả tài liệu, không truy vấn sâu vào JSON nên không mất chức năng.
6. **Thứ tự NULL.** PostgreSQL xếp NULL sau cùng khi sắp tăng dần, SQL Server xếp đầu tiên. Cần rà các `orderBy` trên cột có thể trống và các test kiểm thứ tự.
7. **Không phân biệt hoa thường.** SQL Server mặc định so sánh không phân biệt hoa thường. Mã nhân viên `UP001` và `up001` sẽ coi là trùng. Với dữ liệu của dự án, đây là hành vi mong muốn, nhưng cần kiểm tra không có test nào dựa vào ngược lại.
8. **Giới hạn index.** Khóa unique trên cột `NVARCHAR` quá dài bị giới hạn kích thước. Script hiện dùng độ dài ngắn cho các cột unique, cần giữ khi sửa.
9. **Phân trang.** `OFFSET ... FETCH` của SQL Server bắt buộc có `ORDER BY`. Rà các truy vấn danh sách có giới hạn dòng.
10. **Hàng loạt.** Nhập 300 nhân viên tạo hàng chục nghìn dòng `run_tasks`. SQL Server giới hạn 2100 tham số mỗi câu lệnh, nên các lệnh thêm nhiều dòng phải chia lô.

## 5. Các quyết định đã chốt (10/11/2026)

1. **Không còn bản demo trên mạng.** Chỉ chạy và test trên máy cá nhân; bỏ Render và Neon.
2. **Bỏ hẳn PostgreSQL.** Tag git `pg-cuoi-cung` là mốc để quay lại.
3. **Giữ bảng `credentials`** và đăng nhập bằng mật khẩu cho tới khi tích hợp SSO.
4. **SQL Server 2022** (16.0.4305.5) cài trực tiếp trên Ubuntu 22.04. Tạo CSDL bằng `scripts/setup-sqlserver.sql`.

Kế hoạch thực hiện chi tiết theo giai đoạn: `/home/pc/.claude/plans/expressive-cuddling-shell.md`. Giai đoạn 7 (chuyển dữ liệu) không làm vì chỉ dùng dữ liệu mẫu.

## 6. Cách kiểm chứng và quay lại

- Mỗi giai đoạn là một hoặc vài commit riêng trên nhánh `sqlserver`, chỉ gộp vào `main` sau khi cả 11 file e2e xanh trên SQL Server.
- So kết quả API giữa hai bản (PostgreSQL ở tag `pg-cuoi-cung`, SQL Server ở nhánh mới) trên cùng bộ dữ liệu mẫu: danh sách việc, tổng hợp quá hạn, bảng điểm.
- Chạy Playwright qua các màn chính, không có lỗi console.
- Quay lại: PostgreSQL và Neon giữ nguyên, chưa xóa cho tới khi bản SQL Server chạy ổn định ít nhất một chu kỳ sử dụng.
