import { diffDays, type IsoDate } from '../dates';
import { isChtTrack, type Track } from '../schemas/version';

/**
 * Quy tắc cảnh báo (mục 11.6, mặc định theo N3 và N1 F.2). Hàm thuần: API tính cho trang Cảnh báo, Nhân sự, Hồ sơ NV.
 * Chưa có: Buddy Score dưới ngưỡng (chưa làm Buddy Score).
 */

export type AlertSeverity = 'red' | 'yellow';

export type AlertKey =
  | 'gpp_overdue'
  | 'no_buddy'
  | 'overdue_escalate'
  | 'safety_error'
  | 'no_cht'
  | 'overdue'
  | 'sales_low'
  | 'rubric_low'
  | 'inactive'
  | 'level_overrun'
  | 'stage_sign_late'
  | 'attrition_high'
  | 'attrition_medium';

export interface Alert {
  key: AlertKey;
  severity: AlertSeverity;
  message: string;
}

/** Danh mục quy tắc, hiện làm chú thích trên trang Cảnh báo */
export const ALERT_RULES: { key: AlertKey; severity: AlertSeverity; label: string }[] = [
  { key: 'gpp_overdue', severity: 'red', label: 'Mục GPP quá hạn' },
  { key: 'no_buddy', severity: 'red', label: 'NV Level 1–2 chưa có Buddy sau 48 giờ' },
  { key: 'overdue_escalate', severity: 'red', label: 'Có mục trễ hạn quá số ngày leo thang (mặc định 7)' },
  { key: 'safety_error', severity: 'red', label: 'Ghi nhận lỗi an toàn thuốc nghiêm trọng (tiêu chí trọng yếu 1 điểm)' },
  { key: 'no_cht', severity: 'yellow', label: 'Chưa gắn Cửa hàng trưởng' },
  { key: 'overdue', severity: 'yellow', label: 'Có mục trễ hạn' },
  { key: 'sales_low', severity: 'yellow', label: 'DS tổng dưới 80% mức tham khảo 2 tháng liên tiếp' },
  { key: 'rubric_low', severity: 'yellow', label: 'Tỉ lệ ca Rubric đạt dưới mục tiêu (khi có đủ số ca)' },
  { key: 'inactive', severity: 'yellow', label: 'NV Level 1 không đăng nhập quá 5 ngày' },
  { key: 'level_overrun', severity: 'yellow', label: 'Quá thời gian Level 14 ngày chưa có quyết định' },
  { key: 'stage_sign_late', severity: 'yellow', label: 'Quá hạn ký cuối giai đoạn' },
  { key: 'attrition_high', severity: 'red', label: 'CHT mới có nguy cơ nghỉ việc cao (đánh giá tuần đầu)' },
  { key: 'attrition_medium', severity: 'yellow', label: 'CHT mới có nguy cơ nghỉ việc trung bình (đánh giá tuần đầu)' },
];

export const SALES_LOW_RATE = 0.8;
export const INACTIVE_DAYS = 5;
export const OVERRUN_DAYS = 14;
export const NO_BUDDY_DAYS = 2;

export interface AlertInput {
  today: IsoDate;
  levelKey: number;
  /** Ngày thứ mấy của lượt (0 là ngày đầu, âm khi chưa bắt đầu), đã trừ ngày tạm dừng */
  dayIndex: number;
  /** Lượt còn mở (chưa có kết quả) */
  open: boolean;
  plannedEnd: IsoDate;
  hasBuddy: boolean;
  hasCht: boolean;
  /** Đầu việc chưa xong đã quá hạn */
  overdue: { gpp: boolean; days: number }[];
  escalateDays: number;
  /** DS tổng theo tháng của Level, triệu đồng */
  sales: { month: number; total: number | null }[];
  salesReference: number;
  rubric: { count: number; rate: number | null; meetsTarget: boolean | null; target: number };
  /** Số ca quan sát có tiêu chí trọng yếu bị chấm 1 điểm */
  safetyErrors: number;
  hasAccount: boolean;
  /** Ngày đăng nhập gần nhất của NV (theo đồng hồ nghiệp vụ) */
  lastSeen: IsoDate | null;
  lateStageSigns: number;
  /** Loại lộ trình; lượt CHT không có CHT, Buddy bắt buộc */
  track?: Track;
  /** Nguy cơ nghỉ việc trong đánh giá tuần đầu của lượt CHT */
  attritionRisk?: 'low' | 'medium' | 'high' | null;
}

export function computeAlerts(i: AlertInput): Alert[] {
  const out: Alert[] = [];
  const add = (key: AlertKey, severity: AlertSeverity, message: string) => out.push({ key, severity, message });
  const started = i.dayIndex >= 0;
  const cht = !!i.track && isChtTrack(i.track);

  const gpp = i.overdue.filter((t) => t.gpp).length;
  if (gpp) add('gpp_overdue', 'red', `${gpp} mục GPP quá hạn`);
  if (!cht && i.open && i.levelKey <= 2 && !i.hasBuddy && i.dayIndex >= NO_BUDDY_DAYS) add('no_buddy', 'red', `Level ${i.levelKey} chưa có Buddy sau 48 giờ`);
  const late = i.overdue.filter((t) => t.days > i.escalateDays);
  if (late.length) add('overdue_escalate', 'red', `${late.length} mục trễ hạn hơn ${i.escalateDays} ngày (trễ nhất ${Math.max(...late.map((t) => t.days))} ngày)`);
  if (i.safetyErrors) add('safety_error', 'red', `${i.safetyErrors} ca quan sát có lỗi an toàn thuốc nghiêm trọng`);

  if (i.attritionRisk === 'high') add('attrition_high', 'red', 'Đánh giá tuần đầu: nguy cơ nghỉ việc cao, cần can thiệp ngay');

  if (!cht && i.open && !i.hasCht) add('no_cht', 'yellow', 'Chưa gắn Cửa hàng trưởng');
  if (i.attritionRisk === 'medium') add('attrition_medium', 'yellow', 'Đánh giá tuần đầu: nguy cơ nghỉ việc trung bình, cần theo dõi');
  if (!late.length && i.overdue.length) add('overdue', 'yellow', `${i.overdue.length} mục trễ hạn`);

  const entered = i.sales.filter((s) => s.total !== null).sort((a, b) => a.month - b.month);
  const threshold = i.salesReference * SALES_LOW_RATE;
  for (let k = entered.length - 1; k > 0; k--) {
    const [a, b] = [entered[k - 1], entered[k]];
    if (b.month === a.month + 1 && a.total! < threshold && b.total! < threshold) {
      add('sales_low', 'yellow', `DS tổng tháng ${a.month}, ${b.month} dưới 80% mức tham khảo ${i.salesReference} triệu`);
      break;
    }
  }
  if (i.rubric.meetsTarget === false) add('rubric_low', 'yellow', `Rubric đạt ${i.rubric.rate}% (${i.rubric.count} ca), dưới mục tiêu ${i.rubric.target}%`);

  if (i.open && started && i.levelKey === 1 && i.hasAccount) {
    const idle = i.lastSeen ? diffDays(i.today, i.lastSeen) : i.dayIndex;
    if (idle > INACTIVE_DAYS) add('inactive', 'yellow', i.lastSeen ? `Không đăng nhập ${idle} ngày` : `Chưa đăng nhập lần nào sau ${idle} ngày`);
  }
  const over = diffDays(i.today, i.plannedEnd);
  if (i.open && over > OVERRUN_DAYS) add('level_overrun', 'yellow', `Quá thời gian Level ${over} ngày chưa có quyết định`);
  if (i.lateStageSigns) add('stage_sign_late', 'yellow', `${i.lateStageSigns} giai đoạn quá hạn ký`);

  return out;
}

export const countAlerts = (alerts: readonly Alert[]) => ({
  red: alerts.filter((a) => a.severity === 'red').length,
  yellow: alerts.filter((a) => a.severity === 'yellow').length,
});
