import {
  ASSIGNMENT_LABEL,
  ROLE_LABEL,
  canHoldAssignment,
  type AssignmentRole,
  type AssignmentView,
  type HandoverItemT,
  type IsoDate,
  type PersonOption,
} from '@lotrinh/shared';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { badRequest, conflict } from '../../common/errors';
import type { DbLike } from '../../db/client';
import { levelRuns, runAssignments, staff, stores, users, userScopes } from '../../db/schema';
import { OPEN_RUN_STATUSES } from './task-views';

/** Phân công đang hiệu lực của một tài khoản trên các lượt Level còn mở */
export async function activeAssignmentsOf(db: DbLike, userId: number): Promise<AssignmentView[]> {
  const rows = await db
    .select({
      runId: runAssignments.runId,
      role: runAssignments.role,
      staffId: staff.id,
      staffName: staff.fullName,
      staffUserId: staff.userId,
      storeName: stores.name,
      levelKey: levelRuns.levelKey,
    })
    .from(runAssignments)
    .innerJoin(levelRuns, eq(levelRuns.id, runAssignments.runId))
    .innerJoin(staff, eq(staff.id, levelRuns.staffId))
    .innerJoin(stores, eq(stores.id, staff.storeId))
    .where(and(eq(runAssignments.userId, userId), isNull(runAssignments.toDate), inArray(levelRuns.status, [...OPEN_RUN_STATUSES])))
    .orderBy(asc(staff.fullName));
  return rows;
}

/** Đổi người giữ một vai trò trên lượt: đóng phân công cũ, mở phân công mới từ hôm nay. Lịch không đổi (mục 9.3) */
export async function reassign(tx: DbLike, runId: number, role: AssignmentRole, toUserId: number, today: IsoDate): Promise<void> {
  await tx
    .update(runAssignments)
    .set({ toDate: today })
    .where(and(eq(runAssignments.runId, runId), eq(runAssignments.role, role), isNull(runAssignments.toDate)));
  await tx.insert(runAssignments).values({ runId, role, userId: toUserId, fromDate: today });
}

/**
 * Chuyển giao (mục 5.4 điều 3, R20): mọi phân công bị ảnh hưởng phải có người thay hợp lệ, nếu không thì chặn lưu.
 * Trả về mô tả từng chuyển giao để ghi lịch sử.
 */
export async function applyHandover(
  tx: DbLike,
  affected: AssignmentView[],
  handover: HandoverItemT[],
  today: IsoDate,
  leavingUserId: number,
): Promise<string[]> {
  const pick = (a: AssignmentView) => handover.find((h) => h.runId === a.runId && h.role === a.role);
  const missing = affected.filter((a) => !pick(a));
  if (missing.length) {
    throw conflict(
      'HANDOVER_REQUIRED',
      `Chọn người thay cho ${missing.length} phân công trước khi lưu: ${missing.map((m) => `${m.staffName} (${ASSIGNMENT_LABEL[m.role]})`).join(', ')}`,
    );
  }
  if (!affected.length) return [];
  const ids = [...new Set(affected.map((a) => pick(a)!.userId))];
  const targets = new Map((await tx.select().from(users).where(inArray(users.id, ids))).map((u) => [u.id, u]));
  const out: string[] = [];
  for (const a of affected) {
    const t = targets.get(pick(a)!.userId);
    const label = ASSIGNMENT_LABEL[a.role];
    if (!t || t.id === leavingUserId || !canHoldAssignment(a.role, t)) {
      throw badRequest('INVALID_HANDOVER', `${t?.fullName ?? 'Người được chọn'} không nhận được vai trò ${label} của ${a.staffName}`);
    }
    if (a.role === 'buddy' && t.id === a.staffUserId) throw badRequest('INVALID_HANDOVER', `${a.staffName} không thể là Buddy của chính mình`);
    await reassign(tx, a.runId, a.role, t.id, today);
    out.push(`${a.staffName} · ${label} → ${t.fullName}`);
  }
  return out;
}

/** Người nhận được từng vai trò phân công: Buddy (quyền Buddy hoặc CHT), CHT, QLKV đang hoạt động */
export async function assignmentCandidates(db: DbLike): Promise<Record<AssignmentRole, PersonOption[]>> {
  const active = await db.select().from(users).where(eq(users.status, 'active')).orderBy(asc(users.fullName));
  const storeRows = await db
    .select({ userId: userScopes.userId, name: stores.name })
    .from(userScopes)
    .innerJoin(stores, eq(stores.id, userScopes.storeId));
  const ownStore = await db.select({ userId: staff.userId, name: stores.name }).from(staff).innerJoin(stores, eq(stores.id, staff.storeId));
  const storeOf = (id: number) =>
    [...storeRows.filter((s) => s.userId === id).map((s) => s.name), ...ownStore.filter((s) => s.userId === id).map((s) => s.name)].join(', ');
  const opt = (u: (typeof active)[number]): PersonOption => ({ id: u.id, fullName: u.fullName, note: [ROLE_LABEL[u.role], storeOf(u.id)].filter(Boolean).join(' · ') });
  return {
    buddy: active.filter((u) => canHoldAssignment('buddy', u)).map(opt),
    cht: active.filter((u) => u.role === 'cht').map(opt),
    qlkv: active.filter((u) => u.role === 'qlkv').map(opt),
    trainer: active.filter((u) => u.role === 'bp').map(opt),
  };
}
