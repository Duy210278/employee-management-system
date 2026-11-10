# Kết quả thử Drizzle 1.0 với SQL Server (giai đoạn 1)

Ngày 10/11/2026, trên SQL Server 2022 Developer (16.0.4305.5), CSDL `lotrinh_test`, collation `Vietnamese_100_CI_AS`, bật `READ_COMMITTED_SNAPSHOT`.
Gói thử: `drizzle-orm@1.0.0-rc.5`, `drizzle-kit@1.0.0-rc.5`, `mssql@11.0.2`.

**Kết luận: dùng Drizzle 1.0.0-rc.5.** Cả 9 điểm trong kế hoạch đều đạt, không cần đổi thư viện.

| # | Điểm thử | Kết quả |
|---|---|---|
| 1 | Kết nối bằng chuỗi kết nối, schema riêng (`mssqlSchema`) | Đạt |
| 2 | Thêm nhiều dòng, lấy lại id qua `OUTPUT` | Đạt |
| 2b | `OUTPUT` trên bảng có trigger (`versions`) | Bị chặn (lỗi 334) như dự kiến; ghi bình thường rồi đọc lại thì được |
| 2c | Trigger chặn sửa nội dung bản ban hành | Đạt (lỗi 50001) |
| 3 | Upsert bằng "sửa, nếu không có dòng nào thì thêm" | Đạt; lệnh sửa trả `rowsAffected` |
| 4 | Khóa dòng | Đạt bằng lệnh sửa giả đầu giao dịch; giao dịch thứ hai chờ đúng |
| 4b | Người đọc không bị chặn khi có người giữ khóa ghi | Đạt (2 ms) |
| 5 | `DATE` về chuỗi `YYYY-MM-DD`, `DATETIMEOFFSET` đúng thời điểm, JSON tiếng Việt | Đạt |
| 6 | `top()`, `offset().fetch()`, `like` có dấu | Đạt |
| 7 | Rollback khi lỗi | Đạt |
| 8 | Vượt 2100 tham số | 600 dòng × 4 cột báo lỗi 8003; chia lô thì được |
| 9 | `drizzle-kit generate` dialect mssql, rồi `migrate` | Sinh đúng CHECK, filtered index, khóa ngoại, mặc định; chạy lại không làm lại |

## Khác biệt cần áp dụng khi chuyển code

| PostgreSQL (Drizzle 0.44) | SQL Server (Drizzle 1.0 rc) |
|---|---|
| `insert(t).values(v).returning()` | `insert(t).output().values(v)` (`output()` đặt **trước** `values()`) |
| `update(t).set(v).where(w).returning()` | `update(t).set(v).output().where(w)` |
| `.returning()` trên `versions` | Không dùng `output()` vì bảng có trigger; ghi xong đọc lại |
| `onConflictDoUpdate`, `onConflictDoNothing` | Hàm `upsert()`: sửa trước, `rowsAffected[0] === 0` thì thêm; bắt lỗi trùng 2601/2627 khi hai người cùng thêm |
| `.for('update')` | Hàm `lockForUpdate()`: `UPDATE ... SET row_version = row_version WHERE ...` ở đầu giao dịch |
| `.limit(n)` | `select().top(n).from(t)` |
| `.limit(n).offset(x)` | `.orderBy(...).offset(x).fetch(n)` (bắt buộc có `orderBy`) |
| `count(*)::int` | `count()` hoặc `sql<number>\`count(*)\`` (đều trả kiểu number) |
| Thêm nhiều dòng | Chia lô, mỗi lô dưới 2100 tham số (`insertChunked()`) |
| Mã lỗi | Nằm ở `e.cause.number`: 2601/2627 trùng khóa, 547 CHECK hoặc khóa ngoại, 50001 trigger R03, 334 OUTPUT trên bảng có trigger |

## Ghi chú khác

- Migration của drizzle-kit 1.0 là thư mục theo thời điểm (`<thời điểm>_<tên>/migration.sql` và `snapshot.json`). Bảng theo dõi nằm ở `drizzle.__drizzle_migrations`.
- Giá trị mặc định dạng chuỗi được sinh là `'active'`, không có tiền tố `N`. Với giá trị không dấu thì không sao. Giá trị mặc định có dấu phải viết bằng `sql\`N'...'\``.
- `sqlcmd` mặc định tắt `QUOTED_IDENTIFIER`, nên phải chạy với cờ `-I` khi bảng có filtered index. Thư viện Node `mssql` bật sẵn tùy chọn này.
