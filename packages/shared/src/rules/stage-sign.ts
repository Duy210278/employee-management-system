import { addDays, fmtDate, type IsoDate } from '../dates';
import type { TaskRole } from '../roles';
import { nextSignStep } from '../evaluation/review';

/**
 * Ký cuối giai đoạn (mục 10.2, R11, R12): mở từ (kết thúc giai đoạn − signOpenBefore), hạn (kết thúc + signDueAfter),
 * chỉ ký được khi mọi mục bắt buộc của giai đoạn đã xong hoặc N/A; chuỗi ký đi theo thứ tự.
 */

export interface StageSignInput {
  signers: readonly TaskRole[];
  signedSteps: readonly number[];
  /** Khoảng ngày của giai đoạn (đã tính tạm dừng) */
  window: { from: IsoDate; to: IsoDate };
  params: { signOpenBefore: number; signDueAfter: number };
  /** Số mục bắt buộc của giai đoạn chưa xong hoặc chưa N/A */
  requiredLeft: number;
}

export interface StageSignState {
  opensOn: IsoDate;
  dueOn: IsoDate;
  isOpen: boolean;
  /** Bước kế tiếp; null khi đã ký đủ hoặc giai đoạn không cần ký */
  next: number | null;
  complete: boolean;
  /** Ký được ngay: cửa sổ đã mở và không còn mục bắt buộc dở (R11) */
  ready: boolean;
  overdue: boolean;
  /** Lý do chưa ký được, hiện cho người dùng */
  blocked: string | null;
}

export function stageSignState(input: StageSignInput, today: IsoDate): StageSignState {
  const opensOn = addDays(input.window.to, -input.params.signOpenBefore);
  const dueOn = addDays(input.window.to, input.params.signDueAfter);
  const next = nextSignStep(input.signers, input.signedSteps);
  const complete = next === null;
  const isOpen = today >= opensOn;
  let blocked: string | null = null;
  if (!complete) {
    if (!isOpen) blocked = `Mở ký từ ${fmtDate(opensOn)}`;
    else if (input.requiredLeft > 0) blocked = `Còn ${input.requiredLeft} mục bắt buộc chưa xong`;
  }
  return { opensOn, dueOn, isOpen, next, complete, ready: !complete && blocked === null, overdue: !complete && today > dueOn, blocked };
}

export const STAGE_SIGN_LABEL: Record<TaskRole, string> = {
  nv: 'Nhân viên ký',
  buddy: 'Buddy ký',
  cht: 'Cửa hàng trưởng ký',
  qlkv: 'QLKV ký',
  bp: 'BP Đào tạo ký',
};
