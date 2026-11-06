import { DEFAULT_TZ } from '@lotrinh/shared';

export { fmtDate, yearOf, diffDays } from '@lotrinh/shared';

/** Chuẩn hóa để tìm kiếm không phân biệt hoa thường và dấu tiếng Việt: "Trần Văn Hùng" → "tran van hung" */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');

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

/** Chữ viết tắt cho vòng tròn đại diện: chữ đầu của họ và của tên ("Phạm Thu Hà" → "PH") */
export function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const first = words[0]![0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]![0] ?? '') : '';
  return (first + last).toLocaleUpperCase('vi');
}
