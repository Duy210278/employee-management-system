import { diffDays, type IsoDate } from '../dates';
import type { TaskRole } from '../roles';
import type { TaskStatus } from '../schedule/state';
import type { Actor, RunPeople } from './confirm';

/**
 * Giao việc theo người (mục 10.5): vai trò trên đầu việc được phân giải ra người tại thời điểm hiển thị.
 * Khác với quyền xác nhận: CHT được xác nhận thay Buddy, nhưng việc của Buddy chỉ vào hàng đợi CHT khi lượt chưa có Buddy.
 */
export function isAssignee(actor: Actor, role: TaskRole, people: RunPeople): boolean {
  switch (role) {
    case 'nv':
      return actor.userId === (people.staffUserId ?? people.buddyId ?? people.chtId);
    case 'buddy':
      return actor.userId === (people.buddyId ?? people.chtId);
    case 'cht':
      return actor.userId === people.chtId;
    case 'qlkv':
      return actor.userId === people.qlkvId;
    case 'bp':
      // Lượt có người phụ trách Đào tạo thì việc của BP ĐT về đúng người đó; mọi BP ĐT vẫn xác nhận được
      return actor.role === 'bp' && (!people.trainerId || people.trainerId === actor.userId);
  }
}

/** 0: NV đã báo xong hoặc cần hỗ trợ, đang chờ người này · 1: quá hạn · 2: đến hạn trong 7 ngày · 3: lượt sắp bắt đầu */
export type InboxPriority = 0 | 1 | 2 | 3;

export function inboxPriority(
  input: {
    myMissing: readonly TaskRole[];
    confirmed: readonly TaskRole[];
    status: TaskStatus;
    dueDate: IsoDate;
    runStarted: boolean;
  },
  today: IsoDate,
): InboxPriority | null {
  if (input.myMissing.length === 0) return null;
  if (input.status === 'done' || input.status === 'na' || input.status === 'void') return null;
  if (!input.runStarted) return 3;
  const waitingMe = input.myMissing.some((r) => r !== 'nv') && (input.confirmed.includes('nv') || input.status === 'help');
  if (waitingMe) return 0;
  const untilDue = diffDays(input.dueDate, today);
  if (untilDue < 0) return 1;
  if (untilDue <= 7) return 2;
  return null;
}
