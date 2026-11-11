import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// .env nằm ở gốc monorepo; biến môi trường đã có sẵn được ưu tiên
loadDotenv({ path: path.resolve(__dirname, '../../../.env') });

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'Thiếu DATABASE_URL'),
  DATABASE_URL_TEST: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET cần ít nhất 16 ký tự'),
  TZ: z.string().default('Asia/Ho_Chi_Minh'),
  DEMO_MODE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  STORAGE_DIR: z.string().default('./storage'),
  /** Cho phép xóa sạch CSDL không phải *_test (db:reset, "Khôi phục dữ liệu mẫu"); chỉ bật trên máy dev */
  ALLOW_RESET: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  /** Tự chạy migration khi API khởi động; đặt false khi DBA tự chạy script */
  AUTO_MIGRATE: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),
  /** Trang Swagger /api/docs; đặt false để tắt */
  API_DOCS: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Cấu hình .env không hợp lệ: ${issues}. Xem .env.example`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Chỉ dùng trong test: đọc lại biến môi trường sau khi thay đổi */
export function resetEnvCache(): void {
  cached = undefined;
}
