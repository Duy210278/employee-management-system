-- Tạo cơ sở dữ liệu và tài khoản ứng dụng cho bản chạy local trên SQL Server.
-- Chạy một lần bằng tài khoản sa, chạy lại không lỗi (lần sau chỉ đặt lại mật khẩu):
--   sqlcmd -S localhost -U sa -C -b -v APP_PASSWORD="<mật khẩu>" -i scripts/setup-sqlserver.sql
-- Mật khẩu chỉ truyền qua dòng lệnh, không lưu trong file này. Không dùng dấu nháy đơn trong mật khẩu.
-- Mật khẩu phải đủ mạnh theo chính sách của SQL Server: từ 8 ký tự, có ít nhất 3 trong 4 loại
-- (chữ hoa, chữ thường, số, ký hiệu).

SET NOCOUNT ON;
GO

-- lotrinh: dữ liệu chạy thử; lotrinh_test: dùng riêng cho kiểm thử API, bị xóa sạch mỗi lần chạy test
IF DB_ID(N'lotrinh') IS NULL CREATE DATABASE lotrinh COLLATE Vietnamese_100_CI_AS;
GO
IF DB_ID(N'lotrinh_test') IS NULL CREATE DATABASE lotrinh_test COLLATE Vietnamese_100_CI_AS;
GO

-- Người đọc không bị chặn khi có người đang ghi (gần với cách PostgreSQL hoạt động)
ALTER DATABASE lotrinh SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
ALTER DATABASE lotrinh_test SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
GO

IF SUSER_ID(N'lotrinh_app') IS NULL
  CREATE LOGIN lotrinh_app WITH PASSWORD = N'$(APP_PASSWORD)', DEFAULT_DATABASE = lotrinh;
ELSE
  ALTER LOGIN lotrinh_app WITH PASSWORD = N'$(APP_PASSWORD)';
GO

USE lotrinh;
IF USER_ID(N'lotrinh_app') IS NULL CREATE USER lotrinh_app FOR LOGIN lotrinh_app;
ALTER ROLE db_owner ADD MEMBER lotrinh_app;
GO

USE lotrinh_test;
IF USER_ID(N'lotrinh_app') IS NULL CREATE USER lotrinh_app FOR LOGIN lotrinh_app;
ALTER ROLE db_owner ADD MEMBER lotrinh_app;
GO

PRINT N'Xong: lotrinh, lotrinh_test, tài khoản lotrinh_app (db_owner).';
GO
