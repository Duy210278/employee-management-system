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
  /** Đường dẫn gốc khi chạy sau proxy chung tên miền với dự án lớn, ví dụ /lo-trinh; mặc định chạy ở gốc / */
  BASE_PATH: z
    .string()
    .default('/')
    .refine((v) => /^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?\/?$/.test(v), 'BASE_PATH dạng /ten-duong-dan')
    .transform((v) => v.replace(/\/+$/, '')),
  /** Địa chỉ công khai, ví dụ https://webA.upharma.vn (kiểm Origin chống CSRF, cookie Secure khi https) */
  PUBLIC_URL: z.string().url().optional(),

  // ---------- Danh tính ----------
  /** local: đăng nhập nội bộ bằng email, mật khẩu · external: lấy người dùng từ cookie dùng chung của dự án lớn (Web A) */
  AUTH_MODE: z.enum(['local', 'external']).default('local'),
  /** Cách đọc cookie Web A: jwt (tự kiểm chữ ký) hoặc introspect (gọi API người dùng hiện tại của Web A) */
  HOST_AUTH_MODE: z.enum(['jwt', 'introspect']).default('jwt'),
  HOST_COOKIE_NAME: z.string().default('hostsid'),
  /** jwt: khóa HS256 dùng chung, hoặc địa chỉ JWKS (RS256) */
  HOST_JWT_SECRET: z.string().optional(),
  HOST_JWKS_URL: z.string().url().optional(),
  HOST_JWT_ISSUER: z.string().optional(),
  HOST_JWT_AUDIENCE: z.string().optional(),
  /** introspect: API trả người dùng hiện tại khi gửi kèm cookie */
  HOST_ME_URL: z.string().url().optional(),
  /** Tên trường của Web A, JSON; trường nào bỏ trống dùng tên mặc định (xem adapters/identity) */
  HOST_CLAIM_MAP: z.string().default('{}'),
  /** Chức danh Web A → vai trò module, JSON */
  HOST_ROLE_MAP: z.string().default('{"NVBH":"nv","CHT":"cht","QLKV":"qlkv","DAO_TAO":"bp"}'),
  /** Người lần đầu vào chưa có trong module: auto (tự tạo) hoặc deny (báo chưa được cấp quyền) */
  HOST_PROVISION: z.enum(['auto', 'deny']).default('auto'),
  /** Phút giữ phiên module trước khi đọc lại cookie Web A và đồng bộ lại vai trò, phạm vi */
  HOST_RECHECK_MINUTES: z.coerce.number().int().positive().default(10),
  HOST_LOGIN_URL: z.string().optional(),
  HOST_LOGOUT_URL: z.string().optional(),
  /** Đồng bộ hàng loạt: API danh sách nhân sự của Web A (và token nếu cần) */
  HOST_DIRECTORY_URL: z.string().url().optional(),
  HOST_DIRECTORY_TOKEN: z.string().optional(),

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
    const e = parsed.data;
    if (e.AUTH_MODE === 'external') {
      if (e.HOST_AUTH_MODE === 'jwt' && !e.HOST_JWT_SECRET && !e.HOST_JWKS_URL) throw new Error('AUTH_MODE=external, HOST_AUTH_MODE=jwt cần HOST_JWT_SECRET hoặc HOST_JWKS_URL');
      if (e.HOST_AUTH_MODE === 'introspect' && !e.HOST_ME_URL) throw new Error('HOST_AUTH_MODE=introspect cần HOST_ME_URL');
      for (const key of ['HOST_CLAIM_MAP', 'HOST_ROLE_MAP'] as const) {
        try {
          JSON.parse(e[key]);
        } catch {
          throw new Error(`${key} phải là JSON hợp lệ`);
        }
      }
    }
    cached = e;
  }
  return cached;
}

/** Chỉ dùng trong test: đọc lại biến môi trường sau khi thay đổi */
export function resetEnvCache(): void {
  cached = undefined;
}

/** Tiền tố route của API, không có dấu / ở đầu: "api/v1" hoặc "lo-trinh/api/v1" */
export const apiPrefix = (): string => `${env().BASE_PATH.replace(/^\//, '')}${env().BASE_PATH ? '/' : ''}api/v1`;
