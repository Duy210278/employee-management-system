import {
  addDays,
  type AlertsResponse,
  type AuditLogResponse,
  type InboxResponse,
  type JobResult,
  type NotificationsResponse,
  type RunManageResponse,
  type RunTasksResponse,
  type StaffListResponse,
  type StaffProfileResponse,
} from '@lotrinh/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../src/db/client';
import { runTasks, taskDateChanges } from '../src/db/schema';
import { API, runTasks as tasksOf, setupApp, type Agent, type TestApp } from './helpers';

let harness: TestApp;
const as = (key: string) => harness.as(key);
const inboxOf = async (agent: Agent) => (await agent.get(`${API}/me/inbox`).expect(200)).body as InboxResponse;
const notesOf = async (agent: Agent) => (await agent.get(`${API}/me/notifications`).expect(200)).body as NotificationsResponse;
const manageOf = async (agent: Agent, runId: number) => (await agent.get(`${API}/runs/${runId}/manage`).expect(200)).body as RunManageResponse;
async function staffOf(name: string) {
  const list = (await (await as('admin')).get(`${API}/staff`).expect(200)).body as StaffListResponse;
  const item = list.items.find((i) => i.staff.fullName === name)!;
  return { staffId: item.staff.id, runId: item.run!.id, item };
}
const setClock = async (body: { shiftDays?: number; date?: null }) => (body.shiftDays !== undefined ? harness.shiftDays(body.shiftDays) : harness.resetClock());

beforeAll(async () => {
  harness = await setupApp();
});
afterAll(() => harness.close());

describe('ký cuối giai đoạn (mục 10.2, R11, R12, T-X09)', () => {
  it('giai đoạn đã kết thúc, đủ mục bắt buộc: CHT thấy trong "Chữ ký chờ bạn" và ký được; Buddy không ký được', async () => {
    const { runId, staffId } = await staffOf('Hoàng Thùy Linh');
    const binh = await as('binh');
    const todo = (await inboxOf(binh)).signatures.find((s) => s.kind === 'stage' && s.staffId === staffId)!;
    expect(todo).toMatchObject({ label: 'Ký cuối Tháng 2 – Giai đoạn 2 (Tuần 9–12) · Cửa hàng trưởng ký', tab: 'check', overdue: false });

    const before = await tasksOf(binh, runId);
    const s6 = before.stages.find((s) => s.key === 'L1-S6')!;
    expect(s6.sign).toMatchObject({ ready: true, complete: false, blocked: null });
    expect(s6.sign!.steps[0]).toMatchObject({ role: 'cht', state: 'next', canSign: true });
    expect((await tasksOf(await as('thao'), runId)).stages.find((s) => s.key === 'L1-S6')!.sign!.steps[0].canSign).toBe(false);
    // Giai đoạn đã qua hạn ký có sẵn chữ ký trong dữ liệu mẫu
    expect(before.stages.find((s) => s.key === 'L1-S1')!.sign!.complete).toBe(true);

    const after = (await binh.post(`${API}/runs/${runId}/stages/L1-S6/sign`).send({ step: 0 }).expect(200)).body as RunTasksResponse;
    expect(after.stages.find((s) => s.key === 'L1-S6')!.sign).toMatchObject({ complete: true, steps: [{ state: 'signed', signedByName: 'Lê Văn Bình' }] });
    const again = await binh.post(`${API}/runs/${runId}/stages/L1-S6/sign`).send({ step: 0 }).expect(409);
    expect(again.body.code).toBe('STAGE_SIGNED');
    expect((await inboxOf(binh)).signatures.some((s) => s.kind === 'stage' && s.staffId === staffId)).toBe(false);
  });

  it('T-X09: ký khi còn mục bắt buộc chưa xong → không ký được, báo "Còn N mục bắt buộc chưa xong"', async () => {
    const { runId } = await staffOf('Nguyễn Thị Lan');
    await setClock({ shiftDays: 1 });
    try {
      const ha = await as('ha');
      const s4 = (await tasksOf(ha, runId)).stages.find((s) => s.key === 'L1-S4')!;
      expect(s4.sign!.blocked).toMatch(/^Còn \d+ mục bắt buộc chưa xong$/);
      expect(s4.sign!.steps[0].canSign).toBe(false);
      const res = await ha.post(`${API}/runs/${runId}/stages/L1-S4/sign`).send({ step: 0 }).expect(400);
      expect(res.body.message).toBe(`Chưa ký được: ${s4.sign!.blocked!.replace(/^C/, 'c')}`);
    } finally {
      await setClock({ date: null });
    }
  });
});

describe('tạm dừng lượt Level (mục 9.3, T-L05)', () => {
  it('CHT đề xuất → chờ QLKV duyệt, lịch chưa đổi; CHT không tự duyệt được', async () => {
    const { runId, staffId } = await staffOf('Nguyễn Thị Lan');
    const ha = await as('ha');
    const before = await tasksOf(ha, runId);
    const from = addDays(harness.today, 5);
    const to = addDays(harness.today, 14);
    const m = (await ha.post(`${API}/runs/${runId}/pauses`).send({ from, to, reason: 'Nghỉ ốm dài ngày' }).expect(200)).body as RunManageResponse;
    expect(m.pauses[0]).toMatchObject({ status: 'pending', days: 10, requestedByName: 'Phạm Thu Hà' });
    expect(m.permissions).toMatchObject({ requestPause: true, decidePause: false });
    expect((await tasksOf(ha, runId)).run.plannedEnd).toBe(before.run.plannedEnd);
    await ha.post(`${API}/runs/${runId}/pauses/${m.pauses[0].id}/decision`).send({ approve: true }).expect(403);

    const huy = await as('huy');
    expect((await inboxOf(huy)).signatures.filter((s) => s.kind === 'pause').map((s) => s.staffId)).toContain(staffId);
    expect((await notesOf(huy)).items.some((n) => n.title === 'Đề xuất tạm dừng lộ trình Nguyễn Thị Lan chờ duyệt')).toBe(true);
    const overlap = await ha.post(`${API}/runs/${runId}/pauses`).send({ from: addDays(from, 2), to: addDays(to, 2), reason: 'Trùng' }).expect(409);
    expect(overlap.body.code).toBe('PAUSE_OVERLAP');
  });

  it('QLKV duyệt: mọi mốc chưa xong từ ngày dừng lùi 10 ngày, có log task_date_changes; mốc trước đó giữ nguyên', async () => {
    const { runId } = await staffOf('Nguyễn Thị Lan');
    const huy = await as('huy');
    const before = await tasksOf(huy, runId);
    const pause = (await manageOf(huy, runId)).pauses[0];
    const decided = (await huy.post(`${API}/runs/${runId}/pauses/${pause.id}/decision`).send({ approve: true }).expect(200)).body as RunManageResponse;
    expect(decided.pauses[0]).toMatchObject({ status: 'approved', decidedByName: 'Ngô Quang Huy' });

    const after = await tasksOf(huy, runId);
    expect(after.run.plannedEnd).toBe(addDays(before.run.plannedEnd, 10));
    expect(after.run.pausedDays).toBe(10);
    let shifted = 0;
    for (const t of before.tasks) {
      const now = after.tasks.find((x) => x.id === t.id)!;
      const open = !['done', 'na', 'void'].includes(t.status);
      const expectDue = open && t.dueDate >= pause.from ? addDays(t.dueDate, 10) : t.dueDate;
      expect(now.dueDate).toBe(expectDue);
      if (expectDue !== t.dueDate) shifted++;
    }
    expect(shifted).toBeGreaterThan(0);
    // Giai đoạn cuối cũng lùi theo
    const last = (s: RunTasksResponse) => s.stages.at(-1)!;
    expect(last(after).to).toBe(addDays(last(before).to, 10));

    const { pool, db } = createDb(process.env.DATABASE_URL!);
    try {
      const logs = await db
        .select()
        .from(taskDateChanges)
        .innerJoin(runTasks, eq(runTasks.id, taskDateChanges.taskId))
        .where(and(eq(runTasks.runId, runId), eq(taskDateChanges.reason, 'pause')));
      expect(logs).toHaveLength(shifted);
    } finally {
      await pool.end();
    }

    // Trong thời gian dừng, ngày thứ N đứng yên và hồ sơ báo đang tạm dừng
    await setClock({ shiftDays: 7 });
    try {
      const during = await tasksOf(huy, runId);
      expect(during.run.pause).toEqual({ from: pause.from, to: pause.to });
      expect(during.run.dayIndex).toBe(before.run.dayIndex + 5);
    } finally {
      await setClock({ date: null });
    }
  });

  it('từ chối đề xuất phải có lý do', async () => {
    const { runId } = await staffOf('Đặng Văn Nam');
    const huy = await as('huy');
    const p = (await manageOf(huy, runId)).pauses.find((x) => x.status === 'pending')!;
    await huy.post(`${API}/runs/${runId}/pauses/${p.id}/decision`).send({ approve: false }).expect(400);
    const m = (await huy.post(`${API}/runs/${runId}/pauses/${p.id}/decision`).send({ approve: false, note: 'Trùng đợt kiểm kê' }).expect(200)).body as RunManageResponse;
    expect(m.pauses[0]).toMatchObject({ status: 'rejected', decisionNote: 'Trùng đợt kiểm kê' });
  });
});

describe('đổi phân công (mục 9.3)', () => {
  it('CHT đổi Buddy: người mới nhận việc chưa xác nhận và được thông báo; vai trò không hợp lệ bị chặn', async () => {
    const { runId, staffId } = await staffOf('Phạm Minh Tuấn');
    const ha = await as('ha');
    const m = await manageOf(ha, runId);
    const thao = m.options.buddies.find((b) => b.fullName === 'Đỗ Thị Thảo')!;
    const lan = (await staffOf('Nguyễn Thị Lan')).item;
    expect(m.options.buddies.some((b) => b.fullName === lan.staff.fullName)).toBe(false);

    const res = await ha.post(`${API}/runs/${runId}/assignments`).send({ role: 'cht', userId: thao.id }).expect(400);
    expect(res.body.code).toBe('INVALID_ASSIGNEE');
    await ha.post(`${API}/runs/${runId}/assignments`).send({ role: 'buddy', userId: thao.id }).expect(200);

    const profile = (await ha.get(`${API}/staff/${staffId}`).expect(200)).body as StaffProfileResponse;
    expect(profile.people.buddy).toBe('Đỗ Thị Thảo');
    const thaoAgent = await as('thao');
    expect((await inboxOf(thaoAgent)).groups.some((g) => g.staff.id === staffId)).toBe(true);
    expect((await notesOf(thaoAgent)).items[0].title).toBe('Bạn được phân công làm Buddy của Phạm Minh Tuấn');
    await (await as('binh')).post(`${API}/runs/${runId}/assignments`).send({ role: 'buddy', userId: thao.id }).expect(403);
  });
});

describe('cảnh báo (mục 11.6, T-L08)', () => {
  it('trang Cảnh báo: đỏ trước vàng sau, theo phạm vi; NV không xem được', async () => {
    const huy = (await (await as('huy')).get(`${API}/alerts`).expect(200)).body as AlertsResponse;
    const pairs = huy.items.map((a) => `${a.staffName}:${a.key}`);
    expect(pairs).toEqual(expect.arrayContaining(['Trần Văn Hùng:overdue_escalate', 'Đặng Văn Nam:safety_error', 'Phạm Minh Tuấn:inactive']));
    const firstYellow = huy.items.findIndex((a) => a.severity === 'yellow');
    expect(huy.items.slice(firstYellow).every((a) => a.severity === 'yellow')).toBe(true);
    expect(huy.counts.red).toBeGreaterThan(0);

    const ha = (await (await as('ha')).get(`${API}/alerts`).expect(200)).body as AlertsResponse;
    expect(new Set(ha.items.map((a) => a.storeName))).toEqual(new Set(['Nhà thuốc A']));
    await (await as('lan')).get(`${API}/alerts`).expect(403);
  });

  it('T-L08: quá hạn hơn 7 ngày → QLKV thấy ở "Cảnh báo trong khu vực"', async () => {
    const inbox = await inboxOf(await as('huy'));
    const hung = inbox.areaAlerts.find((a) => a.staffName === 'Trần Văn Hùng')!;
    expect(hung.overdueDays).toBeGreaterThan(7);
    expect(hung.waitingFor.length).toBeGreaterThan(0);
    expect((await inboxOf(await as('ha'))).areaAlerts).toEqual([]);
  });

  it('hồ sơ NV có danh sách cảnh báo; bảng Nhân sự xếp nhân sự có cảnh báo đỏ trước', async () => {
    const { staffId } = await staffOf('Trần Văn Hùng');
    const p = (await (await as('ha')).get(`${API}/staff/${staffId}`).expect(200)).body as StaffProfileResponse;
    expect(p.alerts.map((a) => a.key)).toContain('overdue_escalate');
    const list = (await (await as('huy')).get(`${API}/staff`).expect(200)).body as StaffListResponse;
    const reds = list.items.map((i) => i.alerts.some((a) => a.severity === 'red'));
    expect(reds.indexOf(false)).toBeGreaterThan(0);
    expect(reds.slice(reds.indexOf(false)).every((r) => !r)).toBe(true);
  });
});

describe('thông báo và job (mục 10.6, 14.11)', () => {
  it('bản tin sáng: mỗi người một bản tin, chạy lại không tạo trùng (T-L07)', async () => {
    const admin = await as('admin');
    const first = (await admin.post(`${API}/demo/jobs/daily-digest/run`).expect(200)).body as JobResult;
    expect(first.created).toBeGreaterThan(0);
    const again = (await admin.post(`${API}/demo/jobs/daily-digest/run`).expect(200)).body as JobResult;
    expect(again.created).toBe(0);
    const lan = (await notesOf(await as('lan'))).items.find((n) => n.type === 'digest')!;
    expect(lan.title).toMatch(/^Bản tin \d{2}\/\d{2}\/\d{4}: \d+ việc quá hạn/);
    expect(lan.link).toBe('/hom-nay');
    await (await as('ha')).post(`${API}/demo/jobs/daily-digest/run`).expect(403);
    await admin.post(`${API}/demo/jobs/khong-co/run`).expect(400);
  });

  it('NV báo xong → người xác nhận kế tiếp được báo ngay; yêu cầu làm lại → NV được báo', async () => {
    const lan = await as('lan');
    const today = (await lan.get(`${API}/me/today`).expect(200)).body as { tasks: RunTasksResponse['tasks'] };
    const t = today.tasks.find((x) => x.actions.confirmAs?.role === 'nv' && x.requiredRoles.includes('buddy'))!;
    await lan.post(`${API}/tasks/${t.id}/confirm`).send({ rowVersion: t.rowVersion }).expect(200);
    const hung = await notesOf(await as('hung'));
    expect(hung.items[0].title).toContain('Nguyễn Thị Lan đã báo xong, chờ bạn xác nhận');

    const ha = await as('ha');
    const view = (await ha.get(`${API}/runs/${t.runId}/tasks`).expect(200)).body as RunTasksResponse;
    const fresh = view.tasks.find((x) => x.id === t.id)!;
    await ha.post(`${API}/tasks/${t.id}/rework`).send({ rowVersion: fresh.rowVersion, note: 'Làm lại cùng Buddy' }).expect(200);
    const mine = await notesOf(lan);
    expect(mine.items[0]).toMatchObject({ type: 'rework', body: 'Làm lại cùng Buddy', link: '/hom-nay' });

    const read = (await lan.post(`${API}/me/notifications/read`).send({ all: true }).expect(200)).body as NotificationsResponse;
    expect(read.unread).toBe(0);
  });

  it('tua ngày tự chạy job: lượt bắt đầu ngày mai được nhắc NV, Buddy, CHT; QLKV nhận báo quá hạn lâu', async () => {
    await setClock({ shiftDays: 1 });
    try {
      const mai = (await notesOf(await as('mai'))).items.find((n) => n.type === 'run_start');
      expect(mai?.title).toBe(`Lộ trình Level 1 của Vũ Thị Mai bắt đầu ngày mai ${addDays(harness.today, 2).split('-').reverse().join('/')}`);
      expect((await notesOf(await as('ha'))).items.some((n) => n.type === 'run_start')).toBe(true);
      expect((await notesOf(await as('huy'))).items.some((n) => n.type === 'escalation')).toBe(true);
    } finally {
      await setClock({ date: null });
    }
  });
});

describe('nhật ký hệ thống và xuất CSV (mục 5.7, 11.4)', () => {
  it('BP ĐT xem nhật ký có nhãn tiếng Việt, lọc theo người; người khác bị chặn', async () => {
    const admin = await as('admin');
    const all = (await admin.get(`${API}/audit-logs`).expect(200)).body as AuditLogResponse;
    // Trang đầu đủ min(tổng, cỡ trang) bản ghi (không phụ thuộc số thao tác của các test trước)
    expect(all.total).toBeGreaterThan(0);
    expect(all.items.length).toBe(Math.min(all.total, all.pageSize));
    expect(all.actions.map((a) => a.label)).toEqual(expect.arrayContaining(['Xác nhận đầu việc', 'Yêu cầu làm lại', 'Tạm dừng lượt Level']));
    const pauseAction = all.actions.find((a) => a.label === 'Tạm dừng lượt Level')!.value;
    const pauses = (await admin.get(`${API}/audit-logs?action=${encodeURIComponent(pauseAction)}`).expect(200)).body as AuditLogResponse;
    expect(pauses.items.map((i) => i.userName)).toEqual(['Phạm Thu Hà']);
    const huyId = all.users.find((u) => u.fullName === 'Ngô Quang Huy')!.id;
    const byHuy = (await admin.get(`${API}/audit-logs?userId=${huyId}`).expect(200)).body as AuditLogResponse;
    expect(byHuy.items.every((i) => i.userName === 'Ngô Quang Huy')).toBe(true);
    expect(byHuy.items.some((i) => i.label === 'Duyệt / từ chối tạm dừng')).toBe(true);
    await (await as('huy')).get(`${API}/audit-logs`).expect(403);
  });

  it('xuất CSV đúng phạm vi: CHT Nhà thuốc A chỉ có nhân viên cửa hàng mình; NV không xuất được', async () => {
    const res = await (await as('ha')).get(`${API}/reports/progress.csv`).expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0].startsWith('Mã NV,Họ tên,Cửa hàng')).toBe(true);
    expect(lines.slice(1).map((l) => l.split(',')[1]).sort()).toEqual(['Nguyễn Thị Lan', 'Phạm Minh Tuấn', 'Trần Văn Hùng', 'Vũ Thị Mai']);
    await (await as('lan')).get(`${API}/reports/progress.csv`).expect(403);
  });
});

describe('ngừng theo dõi (mục 9.3)', () => {
  it('NV đang là Buddy của người khác phải chuyển giao trước; sau đó lượt Dừng, không còn trong danh sách', async () => {
    const { staffId } = await staffOf('Đỗ Thị Thảo');
    const binh = await as('binh');
    const blocked = await binh.post(`${API}/staff/${staffId}/stop`).send({ reason: 'Nghỉ việc' }).expect(409);
    expect(blocked.body.code).toBe('HANDOVER_REQUIRED');
    const runId = (await staffOf('Đỗ Thị Thảo')).runId;
    const m = await manageOf(binh, runId);
    expect(m.buddyOf.map((a) => a.staffName).sort()).toEqual(['Hoàng Thùy Linh', 'Phạm Minh Tuấn']);
    const handover = m.buddyOf.map((a) => ({ runId: a.runId, role: a.role, userId: m.options.buddies.find((b) => b.fullName === 'Lê Văn Bình')!.id }));
    const after = (await binh.post(`${API}/staff/${staffId}/stop`).send({ reason: 'Nghỉ việc', handover }).expect(200)).body as RunManageResponse;
    expect(after).toMatchObject({ active: false, runStatus: 'stopped' });
    const list = (await binh.get(`${API}/staff`).expect(200)).body as StaffListResponse;
    expect(list.items.some((i) => i.staff.id === staffId)).toBe(false);
    const p = (await binh.get(`${API}/staff/${staffId}`).expect(200)).body as StaffProfileResponse;
    expect(p.staff).toMatchObject({ active: false, stopReason: 'Nghỉ việc' });
  });
});
