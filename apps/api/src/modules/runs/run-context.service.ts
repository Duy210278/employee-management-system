import { Inject, Injectable } from '@nestjs/common';
import { findLevel, type Level, type RunPeople, type StaffSummary, type VersionContent } from '@lotrinh/shared';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { notFound } from '../../common/errors';
import type { Db } from '../../db/client';
import { areas, levelRuns, runAssignments, staff, stores, users, versions } from '../../db/schema';
import { DB } from '../../db/db.provider';
import { ClockService } from '../../adapters/clock/clock.service';
import { VersionsService } from '../versions/versions.service';

export type LevelRunRow = typeof levelRuns.$inferSelect;

export interface RunContext {
  run: LevelRunRow;
  staff: StaffSummary & { userId: number | null; storeId: number; areaId: number };
  people: RunPeople;
  names: { buddy: string | null; cht: string | null; qlkv: string | null; ackBy: string | null };
  /** Phiên bản gắn với lượt */
  versionCode: string;
  /** Nội dung mới nhất trong dòng tiêu chí của lượt (R02) */
  content: VersionContent;
  level: Level;
}

/** Nạp mọi thứ cần để tính lịch, trạng thái và quyền trên một hoặc nhiều lượt Level */
@Injectable()
export class RunContextService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly versions: VersionsService,
    private readonly clock: ClockService,
  ) {}

  async load(runId: number): Promise<RunContext> {
    const [ctx] = await this.loadMany([runId]);
    if (!ctx) throw notFound('RUN_NOT_FOUND', 'Không tìm thấy lượt Level');
    return ctx;
  }

  async loadMany(runIds: number[]): Promise<RunContext[]> {
    if (runIds.length === 0) return [];
    const rows = await this.db
      .select({
        run: levelRuns,
        staffId: staff.id,
        staffUserId: staff.userId,
        staffName: staff.fullName,
        employeeCode: staff.employeeCode,
        storeId: stores.id,
        storeName: stores.name,
        areaId: areas.id,
        areaName: areas.name,
        versionCode: versions.code,
      })
      .from(levelRuns)
      .innerJoin(staff, eq(staff.id, levelRuns.staffId))
      .innerJoin(stores, eq(stores.id, staff.storeId))
      .innerJoin(areas, eq(areas.id, stores.areaId))
      .innerJoin(versions, eq(versions.id, levelRuns.versionId))
      .where(inArray(levelRuns.id, runIds));

    const assignments = await this.db
      .select({ runId: runAssignments.runId, role: runAssignments.role, userId: runAssignments.userId, name: users.fullName })
      .from(runAssignments)
      .innerJoin(users, eq(users.id, runAssignments.userId))
      .where(and(inArray(runAssignments.runId, runIds), isNull(runAssignments.toDate)));

    const ackIds = [...new Set(rows.map((r) => r.run.ackBy).filter((id): id is number => id !== null))];
    const ackNames = new Map(
      ackIds.length
        ? (await this.db.select({ id: users.id, name: users.fullName }).from(users).where(inArray(users.id, ackIds))).map((u) => [u.id, u.name])
        : [],
    );

    const today = await this.clock.today();
    const out: RunContext[] = [];
    for (const r of rows) {
      const assigned = (role: 'buddy' | 'cht' | 'qlkv') => assignments.find((a) => a.runId === r.run.id && a.role === role);
      const latest = await this.versions.contentForRun(r.run, today);
      out.push({
        run: r.run,
        staff: {
          id: r.staffId,
          fullName: r.staffName,
          employeeCode: r.employeeCode,
          storeName: r.storeName,
          areaName: r.areaName,
          hasAccount: r.staffUserId !== null,
          userId: r.staffUserId,
          storeId: r.storeId,
          areaId: r.areaId,
        },
        people: {
          staffUserId: r.staffUserId,
          buddyId: assigned('buddy')?.userId ?? null,
          chtId: assigned('cht')?.userId ?? null,
          qlkvId: assigned('qlkv')?.userId ?? null,
          acknowledged: r.run.ackAt !== null,
        },
        names: {
          buddy: assigned('buddy')?.name ?? null,
          cht: assigned('cht')?.name ?? null,
          qlkv: assigned('qlkv')?.name ?? null,
          ackBy: r.run.ackBy ? (ackNames.get(r.run.ackBy) ?? null) : null,
        },
        versionCode: r.versionCode ?? '',
        content: latest.content,
        level: findLevel(latest.content, r.run.levelKey),
      });
    }
    return out.sort((a, b) => runIds.indexOf(a.run.id) - runIds.indexOf(b.run.id));
  }
}
