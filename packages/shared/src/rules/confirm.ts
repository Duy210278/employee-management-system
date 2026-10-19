import type { AccountRole, TaskRole } from '../roles';
import type { TaskStatus } from '../schedule/state';

/**
 * Quy tắc xác nhận đầu việc (mục 3.3, 7.2, 12: R04–R10).
 * Tất cả là hàm thuần: API dùng để kiểm tra quyền khi ghi, giao diện dùng để hiện đúng nút.
 */

export interface Actor {
  userId: number;
  role: AccountRole;
}

/** Ai đang giữ vai trò nào trên một lượt Level */
export interface RunPeople {
  /** Tài khoản của NV; null khi NV chưa có tài khoản */
  staffUserId: number | null;
  buddyId: number | null;
  chtId: number | null;
  qlkvId: number | null;
  /** Người phụ trách Đào tạo của lượt (lượt CHT); null thì mọi BP ĐT cùng nhận việc của BP ĐT */
  trainerId?: number | null;
  /** NV (hoặc người thay) đã xác nhận đọc Tổng quan Level (mục 9.4) */
  acknowledged: boolean;
}

/** Một ô xác nhận người dùng được điền; proxyRole khác null khi điền thay vai trò khác */
export interface Slot {
  role: TaskRole;
  proxyRole: TaskRole | null;
}

export function requiredRoles(item: { verifiers: readonly TaskRole[]; requireNvFirst: boolean }): TaskRole[] {
  const roles: TaskRole[] = item.requireNvFirst ? ['nv', ...item.verifiers] : [...item.verifiers];
  return [...new Set(roles)];
}

export function missingRoles(required: readonly TaskRole[], confirmed: readonly TaskRole[]): TaskRole[] {
  return required.filter((r) => !confirmed.includes(r));
}

/** R04: đầu việc hoàn thành khi đủ mọi vai trò yêu cầu xác nhận */
export function isComplete(required: readonly TaskRole[], confirmed: readonly TaskRole[]): boolean {
  return missingRoles(required, confirmed).length === 0;
}

/**
 * Các ô xác nhận người dùng có thể điền trên lượt, chưa xét trạng thái đầu việc.
 * - Phần NV: chỉ NV tự bấm khi đã có tài khoản (R05); chưa có tài khoản thì Buddy, nếu không có Buddy thì CHT, bấm thay.
 * - Phần Buddy: Buddy của lượt; CHT được xác nhận thay và hệ thống ghi rõ là xác nhận thay (R06).
 * - CHT, QLKV: đúng người được phân công trên lượt. BP ĐT: mọi tài khoản BP ĐT.
 */
export function fillableSlots(actor: Actor, people: RunPeople): Slot[] {
  const slots: Slot[] = [];
  const isBuddy = people.buddyId !== null && actor.userId === people.buddyId;
  const isCht = people.chtId !== null && actor.userId === people.chtId;

  if (people.staffUserId !== null) {
    if (actor.userId === people.staffUserId) slots.push({ role: 'nv', proxyRole: null });
  } else if (isBuddy) {
    slots.push({ role: 'nv', proxyRole: 'buddy' });
  } else if (isCht) {
    slots.push({ role: 'nv', proxyRole: 'cht' });
  }

  if (isBuddy) slots.push({ role: 'buddy', proxyRole: null });
  else if (isCht) slots.push({ role: 'buddy', proxyRole: 'cht' });

  if (isCht) slots.push({ role: 'cht', proxyRole: null });
  if (people.qlkvId !== null && actor.userId === people.qlkvId) slots.push({ role: 'qlkv', proxyRole: null });
  if (actor.role === 'bp') slots.push({ role: 'bp', proxyRole: null });
  return slots;
}

/** CHT, QLKV của lượt hoặc BP ĐT: được yêu cầu làm lại, đánh N/A (R07, R09) */
export function isRunManager(actor: Actor, people: RunPeople): boolean {
  if (actor.role === 'bp') return true;
  if (actor.role === 'cht') return actor.userId === people.chtId;
  if (actor.role === 'qlkv') return actor.userId === people.qlkvId;
  return false;
}

export interface TaskSnapshot {
  required: readonly TaskRole[];
  requireNvFirst: boolean;
  /** Các xác nhận còn hiệu lực */
  confirmations: readonly { role: TaskRole; userId: number }[];
  status: TaskStatus;
  gpp: boolean;
  allowNa: boolean;
  /** Mã đầu việc phụ thuộc chưa xong (R10) */
  blockedBy: readonly string[];
}

export interface TaskActions {
  /** Ô người dùng xác nhận được ngay bây giờ; null nếu không có nút xác nhận */
  confirmAs: Slot | null;
  /** R08: chỉ hủy được xác nhận của chính mình */
  canUndo: boolean;
  canRework: boolean;
  canNa: boolean;
  canHelp: boolean;
  canClearHelp: boolean;
  missing: TaskRole[];
  /** Vai trò còn thiếu mà người xem không tự xác nhận được: hiện nhãn "Chờ …" */
  waitingFor: TaskRole[];
}

export function decideActions(actor: Actor, people: RunPeople, task: TaskSnapshot): TaskActions {
  const confirmed = task.confirmations.map((c) => c.role);
  const missing = missingRoles(task.required, confirmed);
  const closed = task.status === 'na' || task.status === 'void';
  const finished = closed || task.status === 'done' || missing.length === 0;
  const slots = fillableSlots(actor, people);
  const nvSlot = slots.find((s) => s.role === 'nv');
  const manager = isRunManager(actor, people);

  let confirmAs: Slot | null = null;
  if (!finished && task.blockedBy.length === 0) {
    for (const role of missing) {
      const slot = slots.find((s) => s.role === role);
      if (!slot) continue;
      if (role === 'nv' && !people.acknowledged) continue;
      if (role !== 'nv' && task.requireNvFirst && missing.includes('nv')) continue;
      confirmAs = slot;
      break;
    }
  }

  return {
    confirmAs,
    canUndo: !closed && task.confirmations.some((c) => c.userId === actor.userId),
    canRework: !closed && manager && task.confirmations.length > 0,
    canNa: !finished && manager && !task.gpp && task.allowNa,
    canHelp: !finished && task.status !== 'help' && nvSlot !== undefined && !confirmed.includes('nv') && people.acknowledged,
    canClearHelp: task.status === 'help' && (nvSlot !== undefined || manager),
    missing,
    waitingFor: confirmAs === null && task.confirmations.length > 0 && !finished ? missing : [],
  };
}

/** Trạng thái lưu sau khi tập xác nhận thay đổi (phụ lục 22.1) */
export function statusAfterConfirmations(
  required: readonly TaskRole[],
  confirmed: readonly TaskRole[],
  current: TaskStatus,
): TaskStatus {
  if (current === 'na' || current === 'void') return current;
  if (isComplete(required, confirmed)) return 'done';
  if (confirmed.length > 0) return 'doing';
  return current === 'help' ? 'help' : 'todo';
}
