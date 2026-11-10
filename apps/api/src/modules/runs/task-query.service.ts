import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { runTasks, signoffs, taskConfirmations, users } from '../../db/schema';
import { DB } from '../../db/db.provider';
import type { RunTaskData, SignoffRow } from './task-views';

@Injectable()
export class TaskQueryService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Chữ ký cuối giai đoạn của các lượt, kèm tên người ký */
  async loadSignoffs(runIds: number[]): Promise<Map<number, SignoffRow[]>> {
    const out = new Map<number, SignoffRow[]>(runIds.map((id) => [id, []]));
    if (!runIds.length) return out;
    const rows = await this.db
      .select({ s: signoffs, userName: users.fullName })
      .from(signoffs)
      .innerJoin(users, eq(users.id, signoffs.userId))
      .where(and(inArray(signoffs.runId, runIds), isNotNull(signoffs.stageKey)))
      .orderBy(asc(signoffs.step));
    for (const { s, userName } of rows) out.get(s.runId)?.push({ ...s, userName });
    return out;
  }

  /** Đầu việc, xác nhận còn hiệu lực và tên người liên quan của các lượt */
  async loadForRuns(runIds: number[]): Promise<Map<number, RunTaskData>> {
    const result = new Map<number, RunTaskData>();
    if (runIds.length === 0) return result;

    const tasks = await this.db
      .select()
      .from(runTasks)
      .where(inArray(runTasks.runId, runIds))
      .orderBy(asc(runTasks.dueDate), asc(runTasks.id));
    const taskIds = tasks.map((t) => t.id);
    const confirmations = taskIds.length
      ? await this.db
          .select({ conf: taskConfirmations, userName: users.fullName })
          .from(taskConfirmations)
          .innerJoin(users, eq(users.id, taskConfirmations.userId))
          .where(and(inArray(taskConfirmations.taskId, taskIds), isNull(taskConfirmations.revokedAt)))
          .orderBy(asc(taskConfirmations.at))
      : [];

    const reworkIds = [...new Set(tasks.map((t) => t.reworkBy).filter((id): id is number => id !== null))];
    const userNames = new Map(
      reworkIds.length
        ? (await this.db.select({ id: users.id, name: users.fullName }).from(users).where(inArray(users.id, reworkIds))).map((u) => [u.id, u.name])
        : [],
    );

    const runOfTask = new Map(tasks.map((t) => [t.id, t.runId]));
    for (const runId of runIds) result.set(runId, { tasks: [], confirmations: [], userNames });
    for (const t of tasks) result.get(t.runId)!.tasks.push(t);
    for (const c of confirmations) {
      result.get(runOfTask.get(c.conf.taskId)!)!.confirmations.push({ ...c.conf, userName: c.userName });
    }
    return result;
  }
}
