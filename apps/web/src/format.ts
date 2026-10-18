import { DEFAULT_TZ } from '@lotrinh/shared';

export { fmtDate, yearOf, diffDays } from '@lotrinh/shared';

const dtFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: DEFAULT_TZ,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Thời điểm thao tác: dd/mm HH:mm giờ Việt Nam (ghép từng phần vì vi-VN tự đảo thứ tự giờ và ngày) */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const part = Object.fromEntries(dtFormat.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${part.day}/${part.month} ${part.hour}:${part.minute}`;
}

/** Tên gọi thân mật: chữ cuối của họ tên tiếng Việt */
export const givenName = (fullName: string) => fullName.trim().split(/\s+/).slice(-1)[0] ?? fullName;
