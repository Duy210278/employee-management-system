import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { env } from '../../config';

/**
 * Người dùng do dự án lớn (Web A) xác nhận, đã đổi về một dạng chung. Mọi trường đọc theo HOST_CLAIM_MAP
 * nên khi biết tên trường thật của Web A chỉ cần sửa cấu hình.
 */
export interface ExternalIdentity {
  /** Mã định danh bất biến của người dùng ở Web A */
  externalId: string;
  employeeCode: string;
  fullName: string;
  email: string | null;
  titles: string[];
  storeCodes: string[];
  areaCodes: string[];
  /** false: đã nghỉ việc hoặc bị khóa ở Web A */
  active: boolean;
  /** undefined: Web A không quản lý quyền Buddy, module giữ nguyên giá trị BP Đào tạo đặt */
  canBuddy?: boolean;
}

const DEFAULT_CLAIMS = {
  externalId: 'sub',
  employeeCode: 'employeeCode',
  fullName: 'name',
  email: 'email',
  titles: 'titles',
  storeCodes: 'stores',
  areaCodes: 'areas',
  active: 'active',
  canBuddy: 'canBuddy',
} as const;
type ClaimKey = keyof typeof DEFAULT_CLAIMS;

/** Lỗi danh tính: cookie có nhưng không hợp lệ (sai chữ ký, hết hạn, thiếu trường bắt buộc) */
export class InvalidIdentityError extends Error {}

const list = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [])
    .map((x) => String(x).trim())
    .filter(Boolean);

/** Đổi bản ghi của Web A (claim JWT hoặc JSON của API) về ExternalIdentity theo HOST_CLAIM_MAP */
export function readIdentity(raw: Record<string, unknown>, claimMap: Partial<Record<ClaimKey, string>> = JSON.parse(env().HOST_CLAIM_MAP)): ExternalIdentity {
  const key = (k: ClaimKey) => claimMap[k] ?? DEFAULT_CLAIMS[k];
  const get = (k: ClaimKey) => raw[key(k)];
  const externalId = get('externalId');
  const employeeCode = get('employeeCode');
  if (externalId === undefined || externalId === null || String(externalId) === '') throw new InvalidIdentityError(`Thiếu trường ${key('externalId')}`);
  if (typeof employeeCode !== 'string' || !employeeCode.trim()) throw new InvalidIdentityError(`Thiếu trường ${key('employeeCode')}`);
  const email = get('email');
  const active = get('active');
  const canBuddy = get('canBuddy');
  return {
    externalId: String(externalId),
    employeeCode: employeeCode.trim(),
    fullName: String(get('fullName') ?? employeeCode).trim(),
    email: typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null,
    titles: list(get('titles')),
    storeCodes: list(get('storeCodes')),
    areaCodes: list(get('areaCodes')),
    active: active === undefined ? true : active === true || active === 'true' || active === 1,
    canBuddy: canBuddy === undefined || canBuddy === null ? undefined : canBuddy === true || canBuddy === 'true' || canBuddy === 1,
  };
}

/**
 * Đọc người dùng hiện tại từ cookie dùng chung của Web A (chỉ dùng khi AUTH_MODE=external).
 * jwt: tự kiểm chữ ký, hạn, iss, aud. introspect: gọi HOST_ME_URL kèm cookie, cache 60 giây.
 */
@Injectable()
export class IdentityService {
  private readonly logger = new Logger('Identity');
  private jwks?: JWTVerifyGetKey;
  private readonly cache = new Map<string, { at: number; identity: ExternalIdentity | null }>();

  /** Giá trị cookie Web A trong request, hoặc null */
  token(req: Request): string | null {
    const value = req.cookies?.[env().HOST_COOKIE_NAME];
    return typeof value === 'string' && value ? value : null;
  }

  /** Dấu vân tay của cookie Web A: đổi người, đăng nhập lại ở Web A thì đổi theo */
  fingerprint(token: string): string {
    return createHash('sha256').update(token).digest('hex').slice(0, 32);
  }

  /** null: không có cookie hoặc Web A báo chưa đăng nhập; ném InvalidIdentityError nếu cookie sai */
  async resolve(req: Request): Promise<ExternalIdentity | null> {
    const token = this.token(req);
    if (!token) return null;
    return env().HOST_AUTH_MODE === 'jwt' ? this.fromJwt(token) : this.fromIntrospect(token);
  }

  private async fromJwt(token: string): Promise<ExternalIdentity> {
    const e = env();
    let key: Uint8Array | JWTVerifyGetKey;
    if (e.HOST_JWKS_URL) key = this.jwks ??= createRemoteJWKSet(new URL(e.HOST_JWKS_URL));
    else key = new TextEncoder().encode(e.HOST_JWT_SECRET);
    try {
      const { payload } = await jwtVerify(token, key as Uint8Array, {
        issuer: e.HOST_JWT_ISSUER || undefined,
        audience: e.HOST_JWT_AUDIENCE || undefined,
        algorithms: e.HOST_JWKS_URL ? ['RS256', 'ES256'] : ['HS256'],
      });
      return readIdentity(payload as Record<string, unknown>);
    } catch (err) {
      if (err instanceof InvalidIdentityError) throw err;
      throw new InvalidIdentityError(`Cookie Web A không hợp lệ: ${(err as Error).message}`);
    }
  }

  private async fromIntrospect(token: string): Promise<ExternalIdentity | null> {
    const fp = this.fingerprint(token);
    const hit = this.cache.get(fp);
    if (hit && Date.now() - hit.at < 60_000) return hit.identity;
    const e = env();
    let res: Response;
    try {
      res = await fetch(e.HOST_ME_URL!, { headers: { cookie: `${e.HOST_COOKIE_NAME}=${token}`, accept: 'application/json' }, signal: AbortSignal.timeout(3000) });
    } catch (err) {
      this.logger.error(`Không gọi được ${e.HOST_ME_URL}: ${(err as Error).message}`);
      throw new InvalidIdentityError('Không kiểm tra được đăng nhập với Web A');
    }
    let identity: ExternalIdentity | null = null;
    if (res.ok) identity = readIdentity((await res.json()) as Record<string, unknown>);
    else if (res.status !== 401 && res.status !== 403) throw new InvalidIdentityError(`Web A trả lỗi ${res.status}`);
    this.cache.set(fp, { at: Date.now(), identity });
    if (this.cache.size > 5000) this.cache.delete(this.cache.keys().next().value!);
    return identity;
  }
}
