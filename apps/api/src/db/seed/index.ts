import fs from 'node:fs';
import path from 'node:path';
import {
  addDays,
  DEFAULT_CHT_TRACKS,
  levelItems,
  requiredRoles,
  VersionContentSchema,
  type IsoDate,
  type Item,
  type Level,
  type TaskRole,
} from '@lotrinh/shared';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { createRun } from '../../modules/runs/run-factory';
import { dropAll, runMigrations, type Db, type Tx } from '../client';
import {
  areas,
  credentials,
  levelRuns,
  observations,
  runJournal,
  runPauses,
  runTasks,
  salesMonthly,
  stageSignoffs,
  staff,
  stores,
  taskConfirmations,
  taskEvents,
  userAreaScopes,
  users,
  userStoreScopes,
  versions,
} from '../schema';
import {
  HELP_NOTE,
  HIRE_BEFORE_LEVEL_START,
  LAST_SEEN_DAYS_AGO,
  SEED_CHT,
  SEED_PAUSE,
  REWORK_NOTE,
  SEED_AREAS,
  SEED_OBSERVATIONS,
  SEED_SALES,
  SEED_PASSWORD,
  SEED_STAFF,
  SEED_STORES,
  SEED_USERS,
  type ProgressPlan,
} from './seed-data';

const SEED_CONTENT_PATH = path.resolve(__dirname, '../../../../../seed/v2.1.json');

/** Thời điểm theo giờ Việt Nam của một ngày nghiệp vụ */
const at = (date: IsoDate, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`);

/** Bộ lộ trình khởi tạo: 4 Level NVBH (trích từ N3) và hai checklist onboarding CHT (trích từ Excel của BP ĐT) */
export function loadSeedContent() {
  return VersionContentSchema.parse({ ...JSON.parse(fs.readFileSync(SEED_CONTENT_PATH, 'utf8')), chtTracks: structuredClone(DEFAULT_CHT_TRACKS) });
}

/** Nạp dữ liệu mẫu vào cơ sở dữ liệu trống. Ngày bắt đầu Level tính lùi từ `today`. */
export async function seedDatabase(db: Db, today: IsoDate): Promise<void> {
  const content = loadSeedContent();
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  await db.transaction(async (tx) => {
    const areaRows = await tx.insert(areas).values(SEED_AREAS).returning();
    const areaId = new Map(areaRows.map((a) => [a.code, a.id]));
    const storeRows = await tx
      .insert(stores)
      .values(SEED_STORES.map((s) => ({ code: s.code, name: s.name, address: s.address, areaId: areaId.get(s.area)! })))
      .returning();
    const storeId = new Map(storeRows.map((s) => [s.code, s.id]));

    const userRows = await tx
      .insert(users)
      .values(
        SEED_USERS.map((u) => ({
          employeeCode: u.employeeCode,
          fullName: u.fullName,
          email: u.email,
          role: u.role,
          status: u.status,
          canBuddy: !!u.canBuddy,
          canApproveVersions: !!u.canApproveVersions,
          requestedRole: u.status === 'pending' ? u.role : null,
          // Lần vào cuối: mặc định hôm qua; một số người để trống hoặc lâu ngày để có cảnh báo "không đăng nhập" (mục 11.6)
          lastSeenAt: u.status === 'active' && LAST_SEEN_DAYS_AGO[u.key] !== null ? at(addDays(today, -(LAST_SEEN_DAYS_AGO[u.key] ?? 1)), '20:00') : null,
        })),
      )
      .returning();
    const byEmail = new Map(userRows.map((u) => [u.email, u]));
    const user = (key: string) => {
      const def = SEED_USERS.find((u) => u.key === key);
      const row = def && byEmail.get(def.email);
      if (!row) throw new Error(`Thiếu tài khoản mẫu ${key}`);
      return row;
    };
    await tx.insert(credentials).values(userRows.map((u) => ({ userId: u.id, passwordHash })));
    const pendingStore = SEED_USERS.filter((u) => u.status === 'pending' && u.stores?.length);
    for (const u of pendingStore) await tx.update(users).set({ requestedStoreId: storeId.get(u.stores![0])! }).where(eq(users.id, user(u.key).id));
    const storeScopes = SEED_USERS.filter((u) => u.status === 'active').flatMap((u) => (u.stores ?? []).map((s) => ({ userId: user(u.key).id, storeId: storeId.get(s)! })));
    const areaScopes = SEED_USERS.flatMap((u) => (u.areas ?? []).map((a) => ({ userId: user(u.key).id, areaId: areaId.get(a)! })));
    if (storeScopes.length) await tx.insert(userStoreScopes).values(storeScopes);
    if (areaScopes.length) await tx.insert(userAreaScopes).values(areaScopes);

    const adminId = user('admin').id;
    const [version] = await tx
      .insert(versions)
      .values({
        code: '2.1',
        criteriaLine: '2.1',
        status: 'active',
        effectiveFrom: '2025-01-01',
        changeNote: 'Bản khởi tạo từ Checklist Onboarding v2.1 (N2) và giao diện tham chiếu (N3), áp dụng giả định mục 16',
        content,
        approvedBy: adminId,
        approvedAt: at(today, '08:00'),
      })
      .returning();

    const runOf = new Map<string, { id: number; start: IsoDate; observer: number }>();
    for (const s of SEED_STAFF) {
      const u = user(s.user);
      const start = addDays(today, s.startOffset);
      const [st] = await tx
        .insert(staff)
        .values({
          userId: u.id,
          employeeCode: u.employeeCode,
          fullName: u.fullName,
          storeId: storeId.get(s.store)!,
          hireDate: addDays(start, -HIRE_BEFORE_LEVEL_START[s.level]),
          currentLevel: s.level,
        })
        .returning();
      const people = { buddy: s.buddy ? user(s.buddy).id : null, cht: user(s.cht).id, qlkv: user(s.qlkv).id };
      const { run, level, tasks } = await createRun(tx, {
        staffId: st.id,
        levelKey: s.level,
        startDate: start,
        version: { id: version.id, criteriaLine: version.criteriaLine!, content },
        people,
        createdBy: adminId,
      });
      runOf.set(s.user, { id: run.id, start, observer: s.level === 1 && people.buddy ? people.buddy : people.cht });
      const day = -s.startOffset;
      if (day >= 0) await tx.update(levelRuns).set({ ackBy: u.id, ackAt: at(start, '08:30') }).where(eq(levelRuns.id, run.id));
      await seedProgress(tx, { level, start, today, day, tasks, plan: s.plan, staffUserId: u.id, people, adminId, runId: run.id, signOff: content.scheduleParams.signDueAfter });
    }

    // Onboarding CHT mới tuyển đang chạy (docs/nguon/Onboarding_CHT_MoiTuyen_[TenCHT].xlsx)
    {
      const u = user(SEED_CHT.user);
      const start = addDays(today, SEED_CHT.startOffset);
      const [st] = await tx
        .insert(staff)
        .values({ userId: u.id, employeeCode: u.employeeCode, fullName: u.fullName, storeId: storeId.get(SEED_CHT.store)!, hireDate: start, currentLevel: 1 })
        .returning();
      // Checklist CHT không có bước "CHT xác nhận"; seedProgress cần đủ người cho mọi vai trò nên điền BP ĐT
      const people = { buddy: null, cht: adminId, qlkv: user(SEED_CHT.qlkv).id };
      const { run, level, tasks } = await createRun(tx, {
        staffId: st.id,
        levelKey: 1,
        track: SEED_CHT.track,
        meta: { trainingMode: SEED_CHT.trainingMode, previousStoreName: null, seniorityMonths: null },
        startDate: start,
        version: { id: version.id, criteriaLine: version.criteriaLine!, content },
        people: { qlkv: people.qlkv, trainer: user(SEED_CHT.trainer).id },
        createdBy: adminId,
      });
      await tx.update(levelRuns).set({ ackBy: u.id, ackAt: at(start, '08:30') }).where(eq(levelRuns.id, run.id));
      await seedProgress(tx, { level, start, today, day: -SEED_CHT.startOffset, tasks, plan: { waiting: 1 }, staffUserId: u.id, people, adminId, runId: run.id, signOff: 0 });
      const trainerId = user(SEED_CHT.trainer).id;
      await tx.insert(runJournal).values(
        SEED_CHT.journal.map((j) => ({
          runId: run.id,
          day: j.day,
          mood: j.mood,
          difficulties: j.difficulties,
          actions: j.actions,
          managerNote: j.managerNote,
          updatedBy: trainerId,
          updatedAt: at(addDays(start, j.day), '17:45'),
          managerBy: j.managerNote ? people.qlkv : null,
          managerAt: j.managerNote ? at(addDays(start, j.day), '20:00') : null,
        })),
      );
    }

    // Một đề xuất tạm dừng đang chờ QLKV duyệt (mục 9.3)
    const pauseRun = runOf.get(SEED_PAUSE.user)!;
    await tx.insert(runPauses).values({
      runId: pauseRun.id,
      fromDate: addDays(today, SEED_PAUSE.fromOffset),
      toDate: addDays(today, SEED_PAUSE.toOffset),
      reason: SEED_PAUSE.reason,
      status: 'pending',
      requestedBy: user(SEED_PAUSE.by).id,
      requestedAt: at(addDays(today, -1), '16:30'),
    });

    // Doanh số tháng và ca quan sát Rubric đã qua (mục 11.5)
    const sales = Object.entries(SEED_SALES).flatMap(([key, months]) =>
      months.map(([total, coef1], i) => ({ runId: runOf.get(key)!.id, monthIndex: i + 1, total, coef1, enteredBy: user(SEED_STAFF.find((x) => x.user === key)!.cht).id, at: at(today, '08:00') })),
    );
    if (sales.length) await tx.insert(salesMonthly).values(sales);
    const keys = (content.rubric ?? { criteria: [] }).criteria.map((c) => c.key);
    const obs = Object.entries(SEED_OBSERVATIONS).flatMap(([key, rows]) =>
      rows.map(([dayNo, points, note]) => {
        const r = runOf.get(key)!;
        return { runId: r.id, obsDate: addDays(r.start, dayNo), scores: Object.fromEntries(keys.map((k, i) => [k, points[i]])), note: note || null, observerId: r.observer };
      }),
    );
    if (obs.length) await tx.insert(observations).values(obs);

    // Bản nháp có sẵn 2 thay đổi để demo luồng phiên bản (mục 14.12)
    const draft = structuredClone(content);
    const items = draft.levels.flatMap((l) => l.stages.flatMap((s) => s.items));
    items.find((i) => i.key === 'L1-1-1')!.verifiers = ['buddy', 'cht'];
    items.find((i) => i.key === 'L1-1-2')!.guidance += ' Chỉ rõ khu thuốc kê đơn và lối thoát hiểm.';
    await tx.insert(versions).values({
      status: 'draft',
      parentId: version.id,
      content: draft,
      changeNote: 'Bổ sung CHT cùng xác nhận mục "Nhận việc"; làm rõ hướng dẫn tham quan mặt bằng',
      createdBy: adminId,
      updatedBy: adminId,
    });
  });
}

interface ProgressInput {
  level: Level;
  start: IsoDate;
  today: IsoDate;
  day: number;
  tasks: { id: number; itemKey: string }[];
  plan: ProgressPlan;
  staffUserId: number | null;
  people: { buddy: number | null; cht: number; qlkv: number };
  adminId: number;
  runId: number;
  /** signDueAfter: giai đoạn đã quá hạn ký mà đủ mục bắt buộc thì coi như đã ký */
  signOff: number;
}

/** Tạo sẵn tiến độ: mục đã qua hạn phần lớn đã xong, chừa lại vài mục quá hạn, làm lại, chờ xác nhận, cần hỗ trợ */
async function seedProgress(tx: Tx, p: ProgressInput): Promise<void> {
  if (p.day < 0) return;
  const taskId = new Map(p.tasks.map((t) => [t.itemKey, t.id]));
  const ordered = levelItems(p.level)
    .map((x) => x.item)
    .sort((a, b) => a.dueOffset - b.dueOffset);

  const past = ordered.filter((i) => i.dueOffset < p.day);
  const candidates = past.filter((i) => p.day - i.dueOffset >= (p.plan.overdueMinDays ?? 0));
  const leave = p.plan.overdue ? candidates.slice(-p.plan.overdue) : [];
  const leaveKeys = new Set(leave.map((i) => i.key));
  const future = ordered.filter((i) => i.dueOffset >= p.day);
  const nWait = p.plan.waiting ?? 0;
  const waiting = future.slice(0, nWait);
  const help = future.slice(nWait, nWait + (p.plan.help ?? 0));

  const filler = (role: TaskRole): { userId: number; proxyRole: TaskRole | null } => {
    switch (role) {
      case 'nv':
        if (p.staffUserId) return { userId: p.staffUserId, proxyRole: null };
        return p.people.buddy ? { userId: p.people.buddy, proxyRole: 'buddy' } : { userId: p.people.cht, proxyRole: 'cht' };
      case 'buddy':
        return p.people.buddy ? { userId: p.people.buddy, proxyRole: null } : { userId: p.people.cht, proxyRole: 'cht' };
      case 'cht':
        return { userId: p.people.cht, proxyRole: null };
      case 'qlkv':
        return { userId: p.people.qlkv, proxyRole: null };
      case 'bp':
        return { userId: p.adminId, proxyRole: null };
    }
  };

  const confirmations: (typeof taskConfirmations.$inferInsert)[] = [];
  const events: (typeof taskEvents.$inferInsert)[] = [];
  const confirm = (item: Item, roles: TaskRole[], date: IsoDate) => {
    const times = ['10:00', '15:00', '17:30'];
    roles.forEach((role, idx) => {
      const who = filler(role);
      const when = at(date, times[Math.min(idx, times.length - 1)]);
      const id = taskId.get(item.key)!;
      confirmations.push({ taskId: id, role, userId: who.userId, proxyRole: who.proxyRole, at: when });
      events.push({ taskId: id, userId: who.userId, role, proxyRole: who.proxyRole, action: role === 'nv' ? 'report_done' : 'confirm', at: when });
    });
  };

  for (const item of past) {
    if (leaveKeys.has(item.key)) continue;
    const doneDate = addDays(p.start, Math.min(item.dueOffset, p.day - 1));
    confirm(item, requiredRoles(item), doneDate);
    await tx.update(runTasks).set({ status: 'done', doneDate }).where(eq(runTasks.id, taskId.get(item.key)!));
  }

  const reported = addDays(p.today, -3);
  const reworked = addDays(p.today, -2);
  for (const item of leave.slice(0, p.plan.rework ?? 0)) {
    const id = taskId.get(item.key)!;
    const nv = filler('nv');
    confirmations.push({ taskId: id, role: 'nv', userId: nv.userId, proxyRole: nv.proxyRole, at: at(reported, '16:00'), revokedAt: at(reworked, '09:15'), revokedBy: p.people.cht });
    events.push({ taskId: id, userId: nv.userId, role: 'nv', proxyRole: nv.proxyRole, action: 'report_done', at: at(reported, '16:00') });
    events.push({ taskId: id, userId: p.people.cht, role: 'cht', action: 'rework', note: REWORK_NOTE, at: at(reworked, '09:15') });
    await tx
      .update(runTasks)
      .set({ status: 'todo', reworkNote: REWORK_NOTE, reworkBy: p.people.cht, reworkAt: at(reworked, '09:15') })
      .where(eq(runTasks.id, id));
  }

  const yesterday = addDays(p.today, -1);
  for (const item of waiting) {
    confirm(item, ['nv'], yesterday);
    await tx.update(runTasks).set({ status: 'doing' }).where(eq(runTasks.id, taskId.get(item.key)!));
  }

  for (const item of help) {
    const id = taskId.get(item.key)!;
    const nv = filler('nv');
    events.push({ taskId: id, userId: nv.userId, role: 'nv', proxyRole: nv.proxyRole, action: 'help', note: HELP_NOTE, at: at(yesterday, '18:00') });
    await tx.update(runTasks).set({ status: 'help' }).where(eq(runTasks.id, id));
  }

  if (confirmations.length) await tx.insert(taskConfirmations).values(confirmations);
  if (events.length) await tx.insert(taskEvents).values(events);

  // Ký cuối giai đoạn (mục 10.2) cho giai đoạn đã qua hạn ký và đủ mục bắt buộc; giai đoạn vừa kết thúc để trống cho CHT ký thử
  const signoffs: (typeof stageSignoffs.$inferInsert)[] = [];
  for (const stage of p.level.stages) {
    if (stage.offsetEnd + p.signOff >= p.day) continue;
    const complete = stage.items.filter((i) => i.required).every((i) => i.dueOffset < p.day && !leaveKeys.has(i.key));
    if (!complete) continue;
    stage.signers.forEach((role, step) => {
      signoffs.push({ runId: p.runId, stageKey: stage.key, step, role, userId: filler(role).userId, at: at(addDays(p.start, stage.offsetEnd), '17:00') });
    });
  }
  if (signoffs.length) await tx.insert(stageSignoffs).values(signoffs);
}

/** Xóa sạch, chạy migration, nạp lại dữ liệu mẫu */
export async function resetDatabase(db: Db, today: IsoDate): Promise<void> {
  await dropAll(db);
  await runMigrations(db);
  await seedDatabase(db, today);
}

export async function isDatabaseEmpty(db: Db): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows.length === 0;
}
