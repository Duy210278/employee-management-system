import path from 'node:path';
import { config } from 'dotenv';

// Chạy trước mọi file test: luôn trỏ vào cơ sở dữ liệu test, không bao giờ đụng dữ liệu demo
config({ path: path.resolve(__dirname, '../../../.env') });
const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) throw new Error('Thiếu DATABASE_URL_TEST trong .env (xem .env.example)');
if (testUrl === process.env.DATABASE_URL) throw new Error('DATABASE_URL_TEST phải khác DATABASE_URL vì test xóa sạch dữ liệu');
process.env.DATABASE_URL = testUrl;
process.env.DEMO_MODE = 'true';
