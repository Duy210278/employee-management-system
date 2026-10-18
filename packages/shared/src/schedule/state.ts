import { diffDays, fmtDate, yearOf, type IsoDate } from '../dates';

/** Trạng thái lưu trong run_tasks (phụ lục 22.1) */
export const TASK_STATUSES = ['todo', 'doing', 'help', 'na', 'done', 'void'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Chưa bắt đầu',
  doing: 'Đang thực hiện',
  help: 'Cần hỗ trợ',
  na: 'Bỏ qua / N-A',
  done: 'Đã hoàn thành',
  void: 'Không áp dụng do đổi phiên bản',
};

export type StateCode =
  | 'done'
  | 'na'
  | 'void'
  | 'upcoming'
  | 'blocked'
  | 'rework'
  | 'help'
  | 'pos_wait'
  | 'overdue'
  | 'due_today'
  | 'due_soon'
  | 'scheduled';

export type Tone = 'ok' | 'neutral' | 'bad' | 'warn' | 'info';

export interface TaskStateInput {
  status: TaskStatus;
  openDate: IsoDate;
  dueDate: IsoDate;
  doneDate?: IsoDate | null;
  /** Có yêu cầu làm lại chưa được xử lý */
  reworkPending?: boolean;
  /** Mã các đầu việc phụ thuộc chưa xong */
  blockedBy?: string[];
  /** Ngày có số liệu POS, chỉ với đầu việc nguồn POS */
  posDataDate?: IsoDate | null;
}

export interface TaskState {
  code: StateCode;
  label: string;
  tone: Tone;
  /** Số ngày trễ (> 0 khi đã quá hạn và chưa xong) */
  overdueDays: number;
}

/**
 * Trạng thái hiển thị của đầu việc tại ngày `today`, theo đúng thứ tự ưu tiên của mục 10.3.
 */
export function computeTaskState(input: TaskStateInput, today: IsoDate, params: { remindDays: number }): TaskState {
  const ref = yearOf(today);
  const untilDue = diffDays(input.dueDate, today);
  const finished = input.status === 'done' || input.status === 'na' || input.status === 'void';
  const overdueDays = !finished && untilDue < 0 ? -untilDue : 0;
  const s = (code: StateCode, label: string, tone: Tone): TaskState => ({ code, label, tone, overdueDays });

  if (input.status === 'void') return s('void', 'Không áp dụng do đổi phiên bản', 'neutral');
  if (input.status === 'done') return s('done', `Xong ${fmtDate(input.doneDate ?? null, ref)}`, 'ok');
  if (input.status === 'na') return s('na', 'Bỏ qua / N-A', 'neutral');
  if (diffDays(input.openDate, today) > 0) return s('upcoming', `Sắp mở (${fmtDate(input.openDate, ref)})`, 'neutral');
  if (input.blockedBy?.length) return s('blocked', `Chờ ${input.blockedBy.join(', ')}`, 'neutral');
  if (input.reworkPending) return s('rework', 'Cần làm lại', 'bad');
  if (input.status === 'help') return s('help', 'Cần hỗ trợ', 'bad');
  if (input.posDataDate && diffDays(input.posDataDate, today) > 0) return s('pos_wait', 'Chờ số liệu POS', 'info');
  if (untilDue < 0) return s('overdue', `Trễ ${-untilDue} ngày`, 'bad');
  if (untilDue === 0) return s('due_today', 'Hạn hôm nay', 'warn');
  if (untilDue <= params.remindDays) return s('due_soon', `Còn ${untilDue} ngày`, 'warn');
  return s('scheduled', `Hạn ${fmtDate(input.dueDate, ref)}`, 'neutral');
}
