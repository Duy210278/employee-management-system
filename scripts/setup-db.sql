-- Tạo user và cơ sở dữ liệu cho bản demo chạy local (mục 14.6 tài liệu thiết kế).
-- Chạy một lần bằng tài khoản quản trị PostgreSQL, chạy lại không lỗi:
--   Ubuntu:  sudo -u postgres psql -f scripts/setup-db.sql
--   macOS:   psql -d postgres -f scripts/setup-db.sql

SELECT 'CREATE ROLE lotrinh WITH LOGIN PASSWORD ''lotrinh'''
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lotrinh')\gexec

-- lotrinh: dữ liệu demo; lotrinh_test: dùng riêng cho kiểm thử API, không đụng dữ liệu demo
SELECT 'CREATE DATABASE lotrinh OWNER lotrinh'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lotrinh')\gexec

SELECT 'CREATE DATABASE lotrinh_test OWNER lotrinh'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lotrinh_test')\gexec

ALTER DATABASE lotrinh SET timezone TO 'Asia/Ho_Chi_Minh';
ALTER DATABASE lotrinh_test SET timezone TO 'Asia/Ho_Chi_Minh';
