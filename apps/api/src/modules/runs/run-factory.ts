import { findLevel, planRunTasks, plannedEnd, VersionContentSchema, type IsoDate, type VersionContent } from '@lotrinh/shared';
import { and, desc, eq, inArray, lte } from 'drizzle-orm';
import type { DbLike } from '../../db/client';
import { levelRuns, runAssignments, runTasks, versions } from '../../db/schema';

/** Bản đã ban hành (đang, sắp hoặc hết hiệu lực) */
export const PUBLISHED = inArray(versions.status, ['active', 'expired']);

/**
 * R01: phiên bản hiệu lực tại ngày bắt đầu Level.
 * Chọn dòng tiêu chí trước (bản đầu dòng có code = criteria_line, ngày hiệu lực ≤ ngày, mới nhất),
 * rồi lấy bản mới nhất trong dòng đó; nhờ vậy bản sửa diễn đạt của dòng cũ không thành phiên bản cho lượt mới.
 */
export async function findVersionForDate(db: DbLike, date: IsoDate) {
  const [head] = await db
    .select({ line: versions.criteriaLine })
    .from(versions)
    .where(and(PUBLISHED, lte(versions.effectiveFrom, date), eq(versions.code, versions.criteriaLine)))
    .orderBy(desc(versions.effectiveFrom), desc(versions.id))
    .limit(1);
  if (!head?.line) throw new Error(`Không có phiên bản nào hiệu lực tại ngày ${date}`);
  const [row] = await db
    .select()
    .from(versions)
    .where(and(PUBLISHED, eq(versions.criteriaLine, head.line), lte(versions.effectiveFrom, date)))
    .orderBy(desc(versions.effectiveFrom), desc(versions.id))
    .limit(1);
  return { ...row, criteriaLine: head.line, content: VersionContentSchema.parse(row.content) as VersionContent };
}

export interface CreateRunInput {
  staffId: number;
  levelKey: number;
  startDate: IsoDate;
  version: { id: number; criteriaLine: string; content: VersionContent };
  people: { buddy?: number | null; cht?: number | null; qlkv?: number | null };
  createdBy: number | null;
}

/**
 * Tạo lượt Level (mục 9.2): sinh toàn bộ đầu việc và lưu cứng ngày mở, hạn của từng việc.
 * Gọi trong transaction để lượt, phân công và đầu việc cùng thành công hoặc cùng hủy.
 */
export async function createRun(tx: DbLike, input: CreateRunInput) {
  const level = findLevel(input.version.content, input.levelKey);
  const [run] = await tx
    .insert(levelRuns)
    .values({
      staffId: input.staffId,
      levelKey: input.levelKey,
      versionId: input.version.id,
      criteriaLine: input.version.criteriaLine,
      startDate: input.startDate,
      plannedEnd: plannedEnd(level, input.startDate),
      status: 'active',
      createdBy: input.createdBy,
    })
    .returning();

  const assignments = (['buddy', 'cht', 'qlkv'] as const)
    .filter((role) => input.people[role])
    .map((role) => ({ runId: run.id, role, userId: input.people[role]!, fromDate: input.startDate }));
  if (assignments.length) await tx.insert(runAssignments).values(assignments);

  const planned = planRunTasks(level, input.startDate);
  const tasks = await tx
    .insert(runTasks)
    .values(planned.map((p) => ({ runId: run.id, itemKey: p.itemKey, openDate: p.openDate, dueDate: p.dueDate })))
    .returning({ id: runTasks.id, itemKey: runTasks.itemKey });

  return { run, level, tasks };
}
