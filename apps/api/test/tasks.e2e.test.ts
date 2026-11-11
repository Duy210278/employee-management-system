import { addDays, type InboxResponse, type OverviewResponse, type TaskView } from '@lotrinh/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, runTasks, setupApp, todayOf, type Agent, type TestApp } from './helpers';

let harness: TestApp;
let today: string;
const as = (key: string) => harness.as(key);
const taskIn = (tasks: TaskView[], id: number) => tasks.find((x) => x.id === id)!;
const isBuddyItem = (x: TaskView) => x.requiredRoles.join() === 'nv,buddy';

beforeAll(async () => {
  harness = await setupApp();
  today = harness.today;
});

afterAll(() => harness.close());

describe('xác thực SSO', () => {
  it('không có cookie của hệ thống chính thì không vào được API; endpoint đăng nhập riêng đã bỏ', async () => {
    const http = harness.anonymous();
    await http.get(`${API}/me/today`).expect(401);
    await http.post(`${API}/auth/login`).set('Origin', 'http://127.0.0.1').send({ email: 'lan@upharma.local', password: 'sai' }).expect(404);
    await http.post(`${API}/auth/register`).set('Origin', 'http://127.0.0.1').send({}).expect(404);
  });
});

describe('xác nhận hai phía (mục 20.2)', () => {
  let lan: Agent;
  let hung: Agent;
  let ha: Agent;
  let lanRunId: number;
  let reportedId: number;

  beforeAll(async () => {
    [lan, hung, ha] = await Promise.all([as('lan'), as('hung'), as('ha')]);
    lanRunId = (await todayOf(lan)).run!.id;
  });

  it('T-X01: NV báo "Tôi đã làm xong" → Đang thực hiện, chip NV ✓, Buddy thấy ở đầu hàng đợi', async () => {
    const task = (await todayOf(lan)).tasks.find((t) => isBuddyItem(t) && t.state.code === 'due_soon' && t.actions.confirmAs?.role === 'nv')!;
    const res = await lan.post(`${API}/tasks/${task.id}/confirm`).send({ rowVersion: task.rowVersion, note: 'Đã làm cùng anh Hùng' }).expect(200);
    expect(res.body).toMatchObject({ status: 'doing', confirmations: [{ role: 'nv' }] });
    reportedId = task.id;

    const inbox = (await hung.get(`${API}/me/inbox`).expect(200)).body as InboxResponse;
    const lanGroup = inbox.groups.find((g) => g.staff.fullName === 'Nguyễn Thị Lan')!;
    const item = lanGroup.items.find((i) => i.id === task.id)!;
    expect(item.priority).toBe(0);
    expect(item.actions.confirmAs).toEqual({ role: 'buddy', proxyRole: null });
  });

  it('T-X02: Buddy xác nhận → Xong, ngày hoàn thành là ngày Buddy xác nhận', async () => {
    const task = taskIn((await runTasks(hung, lanRunId)).tasks, reportedId);
    const res = await hung.post(`${API}/tasks/${task.id}/confirm`).send({ rowVersion: task.rowVersion }).expect(200);
    expect(res.body).toMatchObject({ status: 'done', doneDate: today, state: { code: 'done' } });
  });

  it('T-X05: NV có tài khoản thì Buddy không có nút xác nhận phần NV, gọi API cũng bị chặn', async () => {
    const task = (await runTasks(hung, lanRunId)).tasks.find((t) => isBuddyItem(t) && t.status === 'todo' && !t.rework)!;
    expect(task.actions.confirmAs).toBeNull();
    const res = await hung.post(`${API}/tasks/${task.id}/confirm`).send({ rowVersion: task.rowVersion, role: 'nv' }).expect(403);
    expect(res.body.code).toBe('CANNOT_CONFIRM');
  });

  it('R08: Buddy không hủy được xác nhận của NV', async () => {
    const task = (await runTasks(hung, lanRunId)).tasks.find((t) => t.status === 'doing' && t.confirmations.every((c) => c.role === 'nv'))!;
    expect(task.actions.canUndo).toBe(false);
    await hung.post(`${API}/tasks/${task.id}/undo`).send({ rowVersion: task.rowVersion }).expect(403);
  });

  it('T-X03: CHT yêu cầu làm lại mà không nhập lý do → bị chặn', async () => {
    const task = taskIn((await runTasks(ha, lanRunId)).tasks, reportedId);
    const res = await ha.post(`${API}/tasks/${task.id}/rework`).send({ rowVersion: task.rowVersion, note: '  ' }).expect(400);
    expect(res.body.message).toBe('Nhập lý do vào ô ghi chú trước khi yêu cầu làm lại');
  });

  it('T-X04: CHT yêu cầu làm lại có lý do → mọi xác nhận bị xóa, NV thấy cảnh báo kèm lý do', async () => {
    const task = taskIn((await runTasks(ha, lanRunId)).tasks, reportedId);
    expect(task.actions.canRework).toBe(true);
    const res = await ha.post(`${API}/tasks/${task.id}/rework`).send({ rowVersion: task.rowVersion, note: 'Chưa đạt, làm lại ca sau' }).expect(200);
    expect(res.body).toMatchObject({ status: 'todo', confirmations: [], doneDate: null });

    const mine = taskIn((await todayOf(lan)).tasks, reportedId);
    expect(mine.state.code).toBe('rework');
    expect(mine.rework).toMatchObject({ note: 'Chưa đạt, làm lại ca sau', byName: 'Phạm Thu Hà' });
    const events = (await lan.get(`${API}/tasks/${reportedId}/events`).expect(200)).body;
    expect(events.map((e: { action: string }) => e.action)).toEqual(['rework', 'confirm', 'report_done']);
  });

  it('chống ghi đè: rowVersion cũ → 409, báo tải lại', async () => {
    const task = taskIn((await todayOf(lan)).tasks, reportedId);
    const res = await lan.post(`${API}/tasks/${task.id}/confirm`).send({ rowVersion: task.rowVersion - 1 }).expect(409);
    expect(res.body.code).toBe('STALE');
  });

  it('NV báo cần hỗ trợ phải ghi chú; Buddy thấy ở đầu hàng đợi', async () => {
    const task = (await todayOf(lan)).tasks.find((t) => isBuddyItem(t) && t.status === 'todo' && t.actions.canHelp && !t.rework)!;
    await lan.post(`${API}/tasks/${task.id}/status`).send({ status: 'help', rowVersion: task.rowVersion }).expect(400);
    const res = await lan.post(`${API}/tasks/${task.id}/status`).send({ status: 'help', note: 'Chưa biết làm', rowVersion: task.rowVersion }).expect(200);
    expect(res.body.state.code).toBe('help');
    const inbox = (await hung.get(`${API}/me/inbox`).expect(200)).body as InboxResponse;
    expect(inbox.groups.flatMap((g) => g.items).find((i) => i.id === task.id)?.priority).toBe(0);
  });
});

describe('vai trò phối hợp và N/A', () => {
  it('T-X06: mục phối hợp L2 (CHT + QLKV), CHT đã xác nhận → hiện "Chờ QLKV", QLKV có nút xác nhận', async () => {
    const [nam, binh, huy] = await Promise.all([as('nam'), as('binh'), as('huy')]);
    const mine = await todayOf(nam);
    const task = mine.tasks.find((t) => t.requiredRoles.join() === 'nv,cht,qlkv' && t.actions.confirmAs?.role === 'nv')!;
    await nam.post(`${API}/tasks/${task.id}/confirm`).send({ rowVersion: task.rowVersion }).expect(200);

    const forCht = taskIn((await runTasks(binh, mine.run!.id)).tasks, task.id);
    expect(forCht.actions.confirmAs).toEqual({ role: 'cht', proxyRole: null });
    await binh.post(`${API}/tasks/${task.id}/confirm`).send({ rowVersion: forCht.rowVersion }).expect(200);

    const after = taskIn((await runTasks(binh, mine.run!.id)).tasks, task.id);
    expect(after.actions).toMatchObject({ confirmAs: null, waitingFor: ['qlkv'] });
    const forQlkv = taskIn((await runTasks(huy, mine.run!.id)).tasks, task.id);
    expect(forQlkv.actions.confirmAs).toEqual({ role: 'qlkv', proxyRole: null });
  });

  it('T-X07: mục GPP không có lựa chọn N/A; mục thường CHT đánh N/A được (bắt buộc lý do)', async () => {
    const [mai, ha] = await Promise.all([as('mai'), as('ha')]);
    const run = await runTasks(ha, (await todayOf(mai)).run!.id);
    const gpp = run.tasks.find((t) => t.gpp)!;
    expect(gpp.actions.canNa).toBe(false);
    const denied = await ha.post(`${API}/tasks/${gpp.id}/status`).send({ status: 'na', note: 'thử', rowVersion: gpp.rowVersion }).expect(403);
    expect(denied.body.code).toBe('CANNOT_NA');

    const normal = run.tasks.find((t) => !t.gpp)!;
    expect(normal.actions.canNa).toBe(true);
    const res = await ha.post(`${API}/tasks/${normal.id}/status`).send({ status: 'na', note: 'Cửa hàng không có khu TBYT', rowVersion: normal.rowVersion }).expect(200);
    expect(res.body).toMatchObject({ status: 'na', naReason: 'Cửa hàng không có khu TBYT' });
  });
});

describe('phạm vi dữ liệu (R22)', () => {
  it('T-U05: CHT Nhà thuốc A gọi API hồ sơ NV Nhà thuốc B → bị từ chối ở máy chủ', async () => {
    const [linh, ha] = await Promise.all([as('linh'), as('ha')]);
    const linhRun = await todayOf(linh);
    const res = await ha.get(`${API}/runs/${linhRun.run!.id}/tasks`).expect(403);
    expect(res.body.code).toBe('OUT_OF_SCOPE');
    const task = linhRun.tasks[0];
    await ha.post(`${API}/tasks/${task.id}/rework`).send({ rowVersion: task.rowVersion, note: 'x' }).expect(403);
  });

  it('QLKV xem được mọi cửa hàng trong khu vực', async () => {
    const [linh, huy] = await Promise.all([as('linh'), as('huy')]);
    await huy.get(`${API}/runs/${(await todayOf(linh)).run!.id}/tasks`).expect(200);
  });
});

describe('tổng quan Level và sang ngày mới', () => {
  it('mục 9.4: NV phải xác nhận đã đọc; người khác không xác nhận thay khi NV đã có tài khoản', async () => {
    const [mai, hung] = await Promise.all([as('mai'), as('hung')]);
    const runId = (await todayOf(mai)).run!.id;
    const forHung = (await hung.get(`${API}/runs/${runId}/overview`).expect(200)).body as OverviewResponse;
    expect(forHung.canAck).toBe(false);
    await hung.post(`${API}/runs/${runId}/ack`).expect(403);

    const forMai = (await mai.get(`${API}/runs/${runId}/overview`).expect(200)).body as OverviewResponse;
    expect(forMai).toMatchObject({ canAck: true, people: { buddy: 'Trần Văn Hùng', cht: 'Phạm Thu Hà' } });
    expect(forMai.overview.goals.length).toBeGreaterThan(0);
    await mai.post(`${API}/runs/${runId}/ack`).expect(200);
    expect((await todayOf(mai)).run!.acknowledged).toBe(true);
  });

  it('không còn API đặt ngày giả lập; sang ngày mới thì trạng thái đầu việc đổi theo', async () => {
    const [admin, lan] = await Promise.all([as('admin'), as('lan')]);
    await admin.put(`${API}/demo/clock`).send({ shiftDays: 7 }).expect(404);

    const before = await todayOf(lan);
    expect(await harness.shiftDays(7)).toBe(addDays(today, 7));
    try {
      const after = await todayOf(lan);
      expect(after.today).toBe(addDays(today, 7));
      expect(after.run!.dayIndex).toBe(before.run!.dayIndex + 7);
      expect(after.run!.counts.overdue).toBeGreaterThan(before.run!.counts.overdue);
    } finally {
      await harness.resetClock();
    }
    expect((await todayOf(lan)).today).toBe(today);
  });
});
