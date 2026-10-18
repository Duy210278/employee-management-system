/**
 * Ngày nghiệp vụ luôn là chuỗi `YYYY-MM-DD` theo ngày lịch (mục 10.2, 14.9).
 * Phép cộng/trừ ngày làm trên mốc UTC để không bị lệch vì múi giờ hay giờ mùa hè.
 */
export type IsoDate = string;

export const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';
const DAY_MS = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_RE.test(value)) return false;
  return fromUtcMs(toUtcMs(value)) === value;
}

function toUtcMs(d: IsoDate): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}

function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return fromUtcMs(toUtcMs(d) + n * DAY_MS);
}

/** Số ngày từ `b` tới `a` (a − b). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtcMs(a) - toUtcMs(b)) / DAY_MS);
}

/** Ngày hôm nay theo múi giờ nghiệp vụ. */
export function todayIn(tz: string = DEFAULT_TZ, now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** `dd/mm`, thêm `/yyyy` khi khác năm tham chiếu (mặc định luôn có năm). */
export function fmtDate(d: IsoDate | null | undefined, refYear?: number): string {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  return refYear !== undefined && Number(y) === refYear ? `${day}/${m}` : `${day}/${m}/${y}`;
}

export function yearOf(d: IsoDate): number {
  return Number(d.slice(0, 4));
}
