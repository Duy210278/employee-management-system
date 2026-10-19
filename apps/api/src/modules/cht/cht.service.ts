import { Inject, Injectable } from '@nestjs/common';
import {
  addDays,
  canHoldAssignment,
  diffDays,
  findChtTrack,
  fmtDate,
  isChtTrack,
  ROLE_LABEL,
  shiftByPauses,
  TRACK_LABEL,
  type ChtEvaluationBodyT,
  type ChtFormOptions,
  type ChtJournalBodyT,
  type ChtOnboardingResponse,
  type ChtTrack,
  type ChtTrackKey,
  type CreateChtRunBodyT,
  type PersonOption,
} from '@lotrinh/shared';
import { and, asc, desc, eq, inArray, notInArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ClockService } from '../../adapters/clock/clock.service';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors';
import type { SessionUser } from '../../common/session';
import type { Db } from '../../db/client';
import { DB } from '../../db/db.provider';
import { areas, levelRuns, runEvaluations, runJournal, runTasks, staff, stores, userAreaScopes, users, userStoreScopes } from '../../db/schema';
import { AccessService } from '../access/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { createRun, findVersionForDate } from '../runs/run-factory';
import { RunContextService, type RunContext } from '../runs/run-context.service';
import { isOpenRun, OPEN_RUN_STATUSES } from '../runs/task-views';

const monthsBetween = (from: string, to: string) => Math.max(0, Math.floor(diffDays(to, from) / 30));

/**
 * Onboarding Cửa hàng trưởng (docs/nguon/Onboarding_CHT_*.xlsx): gán checklist CHT mới tuyển / thăng tiến từ NVBH,
 * nhật ký check-in hằng ngày của Đào tạo, đánh giá tổng kết tuần đầu và xác nhận của quản lý cấp trên.
 * Đầu việc, xác nhận, thông báo, cảnh báo dùng chung bộ máy lượt Level.
 */
@Injectable()
export class ChtService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly clock: ClockService,
    private readonly runs: RunContextService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  /** BP ĐT gán cho mọi cửa hàng; QLKV gán cho cửa hàng trong khu vực mình */
  private async canAssignAt(user: SessionUser, store: { id: number; areaId: number }) {
    if (user.role === 'bp') return true;
    if (user.role !== 'qlkv') return false;
    return (await this.access.scopesOf(user)).areaIds.includes(store.areaId);
  }

  private async assertAssigner(user: SessionUser) {
    if (user.role !== 'bp' && user.role !== 'qlkv') throw forbidden('FORBIDDEN', 'Chỉ BP Đào tạo hoặc QLKV gán checklist cho Cửa hàng trưởng');
  }

  async formOptions(user: SessionUser, userId: number): Promise<ChtFormOptions> {
    await this.assertAssigner(user);
    const today = await this.clock.today();
    const [account] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!account) throw notFound('USER_NOT_FOUND', 'Không tìm thấy tài khoản');
    const [storeScopes, active, storeRows, areaScopes, staffRow, version] = await Promise.all([
      this.db.select({ id: userStoreScopes.storeId }).from(userStoreScopes).where(eq(userStoreScopes.userId, userId)),
      this.db.select().from(users).where(eq(users.status, 'active')).orderBy(asc(users.fullName)),
      this.db
        .select({ id: stores.id, name: stores.name, areaId: stores.areaId, areaName: areas.name })
        .from(stores)
        .innerJoin(areas, eq(areas.id, stores.areaId))
        .where(eq(stores.active, true))
        .orderBy(asc(stores.name)),
      this.db.select().from(userAreaScopes),
      this.db.select({ s: staff, storeName: stores.name }).from(staff).innerJoin(stores, eq(stores.id, staff.storeId)).where(eq(staff.userId, userId)),
      findVersionForDate(this.db, today),
    ]);

    let staffInfo: ChtFormOptions['staff'] = null;
    let openChtRun: ChtFormOptions['openChtRun'] = null;
    let hadNvbh = false;
    if (staffRow[0]) {
      const { s, storeName } = staffRow[0];
      const runRows = await this.db.select().from(levelRuns).where(eq(levelRuns.staffId, s.id)).orderBy(desc(levelRuns.startDate));
      const open = runRows.find((r) => isOpenRun(r.status));
      hadNvbh = runRows.some((r) => r.track === 'nvbh');
      const openCht = runRows.find((r) => isOpenRun(r.status) && isChtTrack(r.track));
      if (openCht) openChtRun = { runId: openCht.id, staffId: s.id, track: openCht.track as ChtTrackKey };
      staffInfo = {
        id: s.id,
        storeName,
        hireDate: s.hireDate,
        seniorityMonths: monthsBetween(s.hireDate, today),
        currentRun: open ? { runId: open.id, track: open.track, levelKey: open.levelKey, status: open.status } : null,
      };
    }

    const opt = (u: (typeof active)[number]): PersonOption => ({ id: u.id, fullName: u.fullName, note: ROLE_LABEL[u.role] });
    const assignable = [];
    for (const st of storeRows) if (await this.canAssignAt(user, st)) assignable.push(st);
    return {
      today,
      user: { id: account.id, fullName: account.fullName, employeeCode: account.employeeCode, role: account.role, status: account.status, storeIds: storeScopes.map((x) => x.id) },
      staff: staffInfo,
      openChtRun,
      tracks: (version.content.chtTracks ?? []).map((t) => ({ key: t.key, name: t.name, title: t.title, days: t.totalDays, items: t.stages.reduce((a, x) => a + x.items.length, 0) })),
      suggestedTrack: hadNvbh ? 'cht_thang_tien' : 'cht_moi_tuyen',
      stores: assignable.map((st) => ({
        id: st.id,
        name: st.name,
        areaName: st.areaName,
        defaultQlkvId: active.find((u) => u.role === 'qlkv' && areaScopes.some((x) => x.userId === u.id && x.areaId === st.areaId))?.id ?? null,
      })),
      trainers: active.filter((u) => u.role === 'bp').map(opt),
      qlkvs: active.filter((u) => u.role === 'qlkv').map(opt),
      buddies: active.filter((u) => u.id !== userId && canHoldAssignment('buddy', u)).map(opt),
    };
  }

  /**
   * Gán checklist CHT: tài khoản phải có vai trò CHT. Người đã có hồ sơ đào tạo (NVBH thăng chức) dùng lại hồ sơ đó:
   * lượt NVBH đang mở đóng với trạng thái "Thăng chức CHT", hồ sơ chuyển sang cửa hàng mới.
   */
  async create(user: SessionUser, body: CreateChtRunBodyT): Promise<{ staffId: number; runId: number }> {
    await this.assertAssigner(user);
    const [store] = await this.db.select().from(stores).where(and(eq(stores.id, body.storeId), eq(stores.active, true)));
    if (!store) throw badRequest('STORE_NOT_FOUND', 'Cửa hàng không tồn tại hoặc đã ngừng hoạt động');
    if (!(await this.canAssignAt(user, store))) throw forbidden('OUT_OF_SCOPE', 'Cửa hàng nằm ngoài khu vực của bạn');

    const ids = [body.userId, body.trainerId, body.qlkvId, body.buddyId].filter((id): id is number => !!id);
    const people = new Map((await this.db.select().from(users).where(inArray(users.id, ids))).map((u) => [u.id, u]));
    const account = people.get(body.userId);
    if (!account || account.role !== 'cht' || account.status !== 'active') {
      throw badRequest('NOT_CHT', 'Chỉ gán checklist CHT cho tài khoản vai trò Cửa hàng trưởng đang hoạt động. Đổi vai trò ở trang chi tiết tài khoản trước');
    }
    const trainer = people.get(body.trainerId);
    if (!trainer || !canHoldAssignment('trainer', trainer)) throw badRequest('INVALID_TRAINER', 'Người phụ trách Đào tạo phải là tài khoản BP Đào tạo đang hoạt động');
    const qlkv = people.get(body.qlkvId);
    if (!qlkv || !canHoldAssignment('qlkv', qlkv)) throw badRequest('INVALID_QLKV', 'QLKV phải là tài khoản QLKV đang hoạt động');
    const buddy = body.buddyId ? people.get(body.buddyId) : undefined;
    if (body.buddyId && (!buddy || buddy.id === account.id || !canHoldAssignment('buddy', buddy))) {
      throw badRequest('INVALID_BUDDY', 'Buddy phải là tài khoản đang hoạt động có quyền "Có thể làm Buddy" hoặc là CHT, không phải chính người được đào tạo');
    }

    const version = await findVersionForDate(this.db, body.startDate);
    if (!findChtTrack(version.content, body.track)) {
      throw badRequest('NO_CHT_CHECKLIST', `Bộ lộ trình hiệu lực ngày ${fmtDate(body.startDate)} (v${version.code}) chưa có checklist ${TRACK_LABEL[body.track]}. BP Đào tạo thêm ở Thiết kế lộ trình rồi ban hành`);
    }

    const [existing] = await this.db.select().from(staff).where(eq(staff.userId, account.id));
    const previousRuns = existing ? await this.db.select().from(levelRuns).where(eq(levelRuns.staffId, existing.id)) : [];
    if (previousRuns.some((r) => isOpenRun(r.status) && isChtTrack(r.track))) throw conflict('CHT_RUN_OPEN', `${account.fullName} đang có checklist CHT chưa hoàn thành`);

    const result = await this.db.transaction(async (tx) => {
      let staffId: number;
      let previousStoreName: string | null = null;
      let seniorityMonths: number | null = body.seniorityMonths ?? null;
      if (existing) {
        staffId = existing.id;
        const [prev] = await tx.select({ name: stores.name }).from(stores).where(eq(stores.id, existing.storeId));
        previousStoreName = prev?.name ?? null;
        if (previousRuns.some((r) => r.track === 'nvbh')) seniorityMonths = monthsBetween(existing.hireDate, body.startDate);
        await tx.update(staff).set({ storeId: store.id, active: true, stopReason: null, stoppedAt: null, stoppedBy: null }).where(eq(staff.id, staffId));
        // NVBH thăng chức: lượt NVBH đang mở đóng lại
        await tx
          .update(levelRuns)
          .set({ status: 'promoted' })
          .where(and(eq(levelRuns.staffId, staffId), eq(levelRuns.track, 'nvbh'), inArray(levelRuns.status, [...OPEN_RUN_STATUSES])));
      } else {
        const [st] = await tx
          .insert(staff)
          .values({ userId: account.id, employeeCode: account.employeeCode, fullName: account.fullName, storeId: store.id, hireDate: body.startDate, currentLevel: 1 })
          .returning();
        staffId = st.id;
      }
      const { run } = await createRun(tx, {
        staffId,
        levelKey: 1,
        track: body.track,
        meta: { trainingMode: body.trainingMode, previousStoreName, seniorityMonths },
        startDate: body.startDate,
        version: { id: version.id, criteriaLine: version.criteriaLine, content: version.content },
        people: { buddy: buddy?.id ?? null, qlkv: qlkv.id, trainer: trainer.id },
        createdBy: user.id,
      });
      return { staffId, runId: run.id };
    });

    await this.notifications.notify([account.id, trainer.id, qlkv.id, buddy?.id], {
      type: 'run_start',
      title: `Onboarding ${TRACK_LABEL[body.track]}: ${account.fullName} bắt đầu ngày ${fmtDate(body.startDate)}`,
      body: `${store.name} · Người phụ trách Đào tạo: ${trainer.fullName}`,
      link: `/nhan-su/${result.staffId}`,
    }, user.id);
    return result;
  }

  private async load(user: SessionUser, runId: number): Promise<{ ctx: RunContext; track: ChtTrack }> {
    const ctx = await this.runs.load(runId);
    await this.access.assertCanViewRun(user, ctx);
    if (!isChtTrack(ctx.track)) throw badRequest('NOT_CHT_RUN', 'Lượt này không phải onboarding Cửa hàng trưởng');
    const track = findChtTrack(ctx.content, ctx.track);
    if (!track) throw notFound('CHT_TRACK_NOT_FOUND', 'Phiên bản của lượt không còn checklist CHT');
    return { ctx, track };
  }

  /** Đào tạo (BP ĐT) ghi nhật ký, đánh giá; quản lý cấp trên (QLKV của lượt, hoặc BP ĐT) ghi chú và xác nhận */
  private rights(user: SessionUser, ctx: RunContext, confirmed: boolean) {
    const open = isOpenRun(ctx.run.status) && !confirmed;
    const manager = user.role === 'bp' || user.id === ctx.people.qlkvId;
    return { journal: open && user.role === 'bp', managerNote: open && manager, evaluate: open && user.role === 'bp', confirm: open && manager };
  }

  async get(user: SessionUser, runId: number): Promise<ChtOnboardingResponse> {
    const { ctx, track } = await this.load(user, runId);
    const by = alias(users, 'by');
    const mgr = alias(users, 'mgr');
    const [journalRows, [evaluation], unfinished] = await Promise.all([
      this.db
        .select({ j: runJournal, byName: by.fullName, mgrName: mgr.fullName })
        .from(runJournal)
        .leftJoin(by, eq(by.id, runJournal.updatedBy))
        .leftJoin(mgr, eq(mgr.id, runJournal.managerBy))
        .where(eq(runJournal.runId, runId)),
      this.db.select().from(runEvaluations).where(eq(runEvaluations.runId, runId)),
      this.db
        .select({ key: runTasks.itemKey })
        .from(runTasks)
        .where(and(eq(runTasks.runId, runId), notInArray(runTasks.status, ['done', 'na', 'void']))),
    ]);
    // Tổng kết tuần đầu chỉ xác nhận khi mọi việc bắt buộc của checklist đã xong (hoặc N/A)
    const required = new Set(track.stages.flatMap((s) => s.items.filter((i) => i.required).map((i) => i.key)));
    const openRequired = unfinished.filter((t) => required.has(t.key)).length;
    const names = new Map(
      evaluation
        ? (await this.db.select({ id: users.id, n: users.fullName }).from(users).where(inArray(users.id, [evaluation.savedBy ?? 0, evaluation.confirmedBy ?? 0]))).map((u) => [u.id, u.n])
        : [],
    );
    const confirmed = !!evaluation?.confirmedAt;
    const ratings = evaluation?.ratings ?? {};
    const problems = [
      ...(openRequired ? [`Hoàn thành checklist tuần đầu (còn ${openRequired} việc bắt buộc chưa xong)`] : []),
      ...track.ratings.filter((r) => !ratings[r.key]).map((r) => `Chấm "${r.label}"`),
      ...(evaluation?.risk ? [] : ['Đánh giá nguy cơ nghỉ việc']),
    ];

    return {
      today: await this.clock.today(),
      runId,
      staffId: ctx.staff.id,
      track: track.key,
      trackName: track.name,
      title: track.title,
      goal: track.goal,
      tip: track.tip,
      notes: track.notes,
      moods: track.moods,
      ratings: track.ratings,
      startDate: ctx.run.startDate,
      plannedEnd: ctx.run.plannedEnd,
      runStatus: ctx.run.status,
      meta: {
        trainingMode: ctx.run.meta.trainingMode ?? null,
        previousStoreName: ctx.run.meta.previousStoreName ?? null,
        seniorityMonths: ctx.run.meta.seniorityMonths ?? null,
        managerNote: ctx.run.meta.managerNote ?? '',
      },
      people: { learner: ctx.staff.fullName, trainer: ctx.names.trainer, qlkv: ctx.names.qlkv, buddy: ctx.names.buddy },
      journal: Array.from({ length: track.totalDays }, (_, day) => {
        const row = journalRows.find((r) => r.j.day === day);
        return {
          day,
          label: track.stages.find((s) => s.offsetStart === day)?.label ?? `Ngày D+${day}`,
          date: shiftByPauses(addDays(ctx.run.startDate, day), ctx.pauses),
          mood: row?.j.mood ?? null,
          difficulties: row?.j.difficulties ?? '',
          actions: row?.j.actions ?? '',
          managerNote: row?.j.managerNote ?? '',
          updatedByName: row?.byName ?? null,
          updatedAt: row?.j.updatedAt?.toISOString() ?? null,
          managerByName: row?.mgrName ?? null,
          managerAt: row?.j.managerAt?.toISOString() ?? null,
        };
      }),
      evaluation: {
        ratings,
        risk: evaluation?.risk ?? null,
        suggestion: evaluation?.suggestion ?? '',
        savedByName: evaluation?.savedBy ? (names.get(evaluation.savedBy) ?? null) : null,
        savedAt: evaluation?.savedAt?.toISOString() ?? null,
        confirmedByName: evaluation?.confirmedBy ? (names.get(evaluation.confirmedBy) ?? null) : null,
        confirmedAt: evaluation?.confirmedAt?.toISOString() ?? null,
        confirmNote: evaluation?.confirmNote ?? null,
      },
      permissions: this.rights(user, ctx, confirmed),
      problems,
    };
  }

  private async confirmedOf(runId: number) {
    const [e] = await this.db.select({ at: runEvaluations.confirmedAt }).from(runEvaluations).where(eq(runEvaluations.runId, runId));
    return !!e?.at;
  }

  async saveJournal(user: SessionUser, runId: number, day: number, body: ChtJournalBodyT): Promise<ChtOnboardingResponse> {
    const { ctx, track } = await this.load(user, runId);
    if (day < 0 || day >= track.totalDays) throw badRequest('INVALID_DAY', 'Ngày nhật ký nằm ngoài tuần onboarding');
    const r = this.rights(user, ctx, await this.confirmedOf(runId));
    const trainerPart = body.mood !== undefined || body.difficulties !== undefined || body.actions !== undefined;
    if (trainerPart && !r.journal) throw forbidden('CANNOT_WRITE_JOURNAL', 'Chỉ Đào tạo (BP ĐT) ghi nhật ký check-in, khi lượt còn mở và chưa xác nhận tổng kết');
    if (body.managerNote !== undefined && !r.managerNote) throw forbidden('CANNOT_WRITE_NOTE', 'Chỉ QLKV phụ trách hoặc BP ĐT ghi chú quản lý');
    if (body.mood && !track.moods.includes(body.mood)) throw badRequest('INVALID_MOOD', 'Chọn cảm xúc trong danh sách');

    const now = await this.clock.now();
    // Chỉ ghi tên người sửa cho phần thực sự thay đổi (BP ĐT lưu nhật ký không thành người "ghi chú quản lý")
    const [old] = await this.db.select().from(runJournal).where(and(eq(runJournal.runId, runId), eq(runJournal.day, day)));
    const trainerChanged =
      (body.mood !== undefined && (body.mood || null) !== (old?.mood ?? null)) ||
      (body.difficulties !== undefined && body.difficulties !== (old?.difficulties ?? '')) ||
      (body.actions !== undefined && body.actions !== (old?.actions ?? ''));
    const noteChanged = body.managerNote !== undefined && body.managerNote !== (old?.managerNote ?? '');
    if (!trainerChanged && !noteChanged) return this.get(user, runId);
    const values = {
      ...(body.mood !== undefined ? { mood: body.mood || null } : {}),
      ...(body.difficulties !== undefined ? { difficulties: body.difficulties } : {}),
      ...(body.actions !== undefined ? { actions: body.actions } : {}),
      ...(trainerChanged ? { updatedBy: user.id, updatedAt: now } : {}),
      ...(noteChanged ? { managerNote: body.managerNote, managerBy: user.id, managerAt: now } : {}),
    };
    await this.db
      .insert(runJournal)
      .values({ runId, day, ...values })
      .onConflictDoUpdate({ target: [runJournal.runId, runJournal.day], set: values });
    return this.get(user, runId);
  }

  async saveEvaluation(user: SessionUser, runId: number, body: ChtEvaluationBodyT): Promise<ChtOnboardingResponse> {
    const { ctx, track } = await this.load(user, runId);
    if (!this.rights(user, ctx, await this.confirmedOf(runId)).evaluate) {
      throw forbidden('CANNOT_EVALUATE', 'Chỉ Đào tạo (BP ĐT) đánh giá tổng kết, khi lượt còn mở và chưa được xác nhận');
    }
    const keys = new Set(track.ratings.map((r) => r.key));
    const unknown = Object.keys(body.ratings).filter((k) => !keys.has(k));
    if (unknown.length) throw badRequest('INVALID_RATING', `Tiêu chí không có trong checklist: ${unknown.join(', ')}`);
    const values = { ratings: body.ratings, risk: body.risk, suggestion: body.suggestion, savedBy: user.id, savedAt: await this.clock.now() };
    await this.db.insert(runEvaluations).values({ runId, ...values }).onConflictDoUpdate({ target: runEvaluations.runId, set: values });
    if (body.risk === 'high' && ctx.people.qlkvId) {
      await this.notifications.notify([ctx.people.qlkvId], {
        type: 'escalation',
        title: `CHT ${ctx.staff.fullName}: nguy cơ nghỉ việc cao`,
        body: 'Đánh giá tổng kết tuần đầu của Đào tạo. Cần can thiệp ngay',
        link: `/nhan-su/${ctx.staff.id}?tab=cht-review&run=${runId}`,
        dedupeKey: `attrition-high:${runId}`,
      }, user.id);
    }
    return this.get(user, runId);
  }

  /** Quản lý cấp trên xác nhận tổng kết tuần đầu: lượt onboarding hoàn thành */
  async confirm(user: SessionUser, runId: number, note: string): Promise<ChtOnboardingResponse> {
    const view = await this.get(user, runId);
    if (!view.permissions.confirm) throw forbidden('CANNOT_CONFIRM', 'Chỉ QLKV phụ trách hoặc BP ĐT xác nhận tổng kết, khi lượt còn mở và chưa được xác nhận');
    if (view.problems.length) throw badRequest('EVALUATION_INCOMPLETE', `Chưa xác nhận được: còn thiếu ${view.problems.join(', ').toLowerCase()}`);
    const now = await this.clock.now();
    await this.db.transaction(async (tx) => {
      await tx.update(runEvaluations).set({ confirmedBy: user.id, confirmedAt: now, confirmNote: note || null }).where(eq(runEvaluations.runId, runId));
      await tx.update(levelRuns).set({ status: 'passed' }).where(eq(levelRuns.id, runId));
    });
    const ctx = await this.runs.load(runId);
    await this.notifications.notify([ctx.staff.userId, ctx.people.trainerId, ctx.people.buddyId], {
      type: 'account',
      title: `Hoàn thành onboarding tuần đầu: ${ctx.staff.fullName}`,
      body: note || null,
      link: `/nhan-su/${ctx.staff.id}?tab=cht-review&run=${runId}`,
    }, user.id);
    return this.get(user, runId);
  }

  async saveManagerNote(user: SessionUser, runId: number, managerNote: string): Promise<ChtOnboardingResponse> {
    const { ctx } = await this.load(user, runId);
    if (!this.rights(user, ctx, await this.confirmedOf(runId)).managerNote) throw forbidden('CANNOT_WRITE_NOTE', 'Chỉ QLKV phụ trách hoặc BP ĐT ghi chú quản lý cấp trên');
    await this.db
      .update(levelRuns)
      .set({ meta: { ...ctx.run.meta, managerNote } })
      .where(eq(levelRuns.id, runId));
    return this.get(user, runId);
  }
}
