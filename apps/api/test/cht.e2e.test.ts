import type {
  AlertsResponse,
  ChtFormOptions,
  ChtOnboardingResponse,
  InboxResponse,
  NotificationsResponse,
  RunManageResponse,
  RunTasksResponse,
  StaffListResponse,
  StaffProfileResponse,
  TodayResponse,
  UserDetailResponse,
  UserListResponse,
  VersionDetailResponse,
  VersionListResponse,
} from '@lotrinh/shared';
import { addDays, DEFAULT_CHT_TRACKS, type VersionContent } from '@lotrinh/shared';
import { and, eq, ne } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/client';
import { DB } from '../src/db/db.provider';
import { runTasks } from '../src/db/schema';
import { API, setupApp, type Agent, type TestApp } from './helpers';

let harness: TestApp;
let admin: Agent;
let huy: Agent;
const as = (key: string) => harness.as(key);
const userId = async (email: string) => ((await admin.get(`${API}/users`).expect(200)).body as UserListResponse).items.find((u) => u.email === email)!.id;
const staffItem = async (agent: Agent, name: string) => ((await agent.get(`${API}/staff`).expect(200)).body as StaffListResponse).items.find((i) => i.staff.fullName === name)!;
const onboarding = async (agent: Agent, runId: number) => (await agent.get(`${API}/runs/${runId}/cht`).expect(200)).body as ChtOnboardingResponse;
const notes = async (agent: Agent) => ((await agent.get(`${API}/me/notifications`).expect(200)).body as NotificationsResponse).items;

beforeAll(async () => {
  harness = await setupApp();
  [admin, huy] = await Promise.all([as('admin'), as('huy')]);
});
afterAll(() => harness.close());

describe('onboarding CHT mới tuyển có sẵn trong dữ liệu mẫu (Phương, Nhà thuốc C)', () => {
  it('lượt CHT: 26 việc trong 5 ngày; 2 ngày đầu đã xong; không có thanh 4 Level', async () => {
    const item = await staffItem(admin, 'Trịnh Thu Phương');
    expect(item.run).toMatchObject({ track: 'cht_moi_tuyen', dayIndex: 2, progress: { done: 11, total: 26 } });
    expect(item.alerts).toEqual([]);
    const profile = (await admin.get(`${API}/staff/${item.staff.id}`).expect(200)).body as StaffProfileResponse;
    expect(profile.path).toEqual([]);
    expect(profile.level).toMatchObject({ name: 'CHT mới tuyển', totalDays: 5 });
    const tasks = (await admin.get(`${API}/runs/${item.run!.id}/tasks`).expect(200)).body as RunTasksResponse;
    expect(tasks.stages.map((s) => s.label)).toEqual(['Ngày D', 'Ngày D+1', 'Ngày D+2', 'Ngày D+3', 'Ngày D+4']);
    expect(tasks.stages.every((s) => s.sign === null)).toBe(true);
    expect(tasks.tasks.find((t) => t.itemKey === 'CM-1-3')).toMatchObject({ session: 'sang', supporter: 'QLKV / CHT bàn giao', track: 'cht_moi_tuyen' });
  });

  it('thông tin onboarding, nhật ký 2 ngày đầu; quyền: Đào tạo ghi nhật ký, QLKV ghi chú và xác nhận, CHT chỉ xem', async () => {
    const { run } = await staffItem(admin, 'Trịnh Thu Phương');
    const view = await onboarding(admin, run!.id);
    expect(view).toMatchObject({ trackName: 'CHT mới tuyển', meta: { trainingMode: 'offline' }, people: { trainer: 'Ngô Quốc Bảo', qlkv: 'Ngô Quang Huy', buddy: null } });
    expect(view.journal.map((j) => [j.label, j.mood !== null])).toEqual([
      ['Ngày D', true],
      ['Ngày D+1', true],
      ['Ngày D+2', false],
      ['Ngày D+3', false],
      ['Ngày D+4', false],
    ]);
    expect(view.journal[1].managerNote).toBe('Theo dõi thêm phần POS, cuối tuần báo lại');
    expect(view.permissions).toEqual({ journal: true, managerNote: true, evaluate: true, confirm: true });
    expect((await onboarding(huy, run!.id)).permissions).toEqual({ journal: false, managerNote: true, evaluate: false, confirm: true });
    expect((await onboarding(await as('phuong'), run!.id)).permissions).toEqual({ journal: false, managerNote: false, evaluate: false, confirm: false });
    await (await as('ha')).get(`${API}/runs/${run!.id}/cht`).expect(403);
  });

  it('CHT tự làm checklist của mình: báo xong → Đào tạo xác nhận; check-in do Đào tạo tự xác nhận; không tự quản lý lượt', async () => {
    const phuong = await as('phuong');
    const me = (await phuong.get(`${API}/me`).expect(200)).body as { staffId: number | null };
    expect(me.staffId).not.toBeNull();
    const today = (await phuong.get(`${API}/me/today`).expect(200)).body as TodayResponse;
    expect(today.run).toMatchObject({ track: 'cht_moi_tuyen' });
    const t = today.tasks.find((x) => x.stageKey === 'CM-S3' && x.actions.confirmAs?.role === 'nv')!;
    await phuong.post(`${API}/tasks/${t.id}/confirm`).send({ rowVersion: t.rowVersion }).expect(200);
    expect((await notes(admin)).some((n) => n.title.startsWith('Trịnh Thu Phương đã báo xong'))).toBe(true);

    const view = ((await admin.get(`${API}/runs/${t.runId}/tasks`).expect(200)).body as RunTasksResponse).tasks;
    const reported = view.find((x) => x.id === t.id)!;
    expect(reported.actions.confirmAs?.role).toBe('bp');
    await admin.post(`${API}/tasks/${t.id}/confirm`).send({ rowVersion: reported.rowVersion }).expect(200);
    const checkin = view.find((x) => x.itemKey === 'CM-3-5')!;
    expect(checkin.actions.confirmAs?.role).toBe('bp');

    expect(((await phuong.get(`${API}/runs/${t.runId}/manage`).expect(200)).body as RunManageResponse).permissions).toMatchObject({ assign: false, requestPause: false, stop: false });
    expect(((await phuong.get(`${API}/me/inbox`).expect(200)).body as InboxResponse).groups.some((g) => g.run.id === t.runId)).toBe(false);
    // Không có doanh số, Rubric, phiếu chuyển Level
    expect((await admin.get(`${API}/runs/${t.runId}/review`).expect(400)).body.code).toBe('NOT_FOR_CHT');
    await admin.get(`${API}/runs/${t.runId}/sales`).expect(400);
  });

  it('nhật ký: Đào tạo ghi cảm xúc, khó khăn; QLKV ghi chú; người khác bị chặn; cảm xúc phải trong danh sách', async () => {
    const { run } = await staffItem(admin, 'Trịnh Thu Phương');
    const url = `${API}/runs/${run!.id}/cht/journal/2`;
    await admin.put(url).send({ mood: 'Vui' }).expect(400);
    const v = (await admin.put(url).send({ mood: '😊 Tự tin', difficulties: 'Đã tự tư vấn 2 ca', actions: 'Khen ngợi, giao thêm ca đơn giản' }).expect(200)).body as ChtOnboardingResponse;
    expect(v.journal[2]).toMatchObject({ mood: '😊 Tự tin', updatedByName: 'Ngô Quốc Bảo' });
    await huy.put(url).send({ mood: '😐 Bình thường' }).expect(403);
    const n = (await huy.put(url).send({ managerNote: 'Tốt, giữ nhịp' }).expect(200)).body as ChtOnboardingResponse;
    expect(n.journal[2]).toMatchObject({ managerNote: 'Tốt, giữ nhịp', managerByName: 'Ngô Quang Huy', mood: '😊 Tự tin' });
    // Đào tạo lưu lại nhật ký (ghi chú quản lý không đổi) không thành người ghi chú quản lý
    const again = (await admin.put(url).send({ actions: 'Giao thêm ca chiều', managerNote: 'Tốt, giữ nhịp' }).expect(200)).body as ChtOnboardingResponse;
    expect(again.journal[2]).toMatchObject({ actions: 'Giao thêm ca chiều', updatedByName: 'Ngô Quốc Bảo', managerByName: 'Ngô Quang Huy' });
    await (await as('phuong')).put(url).send({ difficulties: 'x' }).expect(403);
    await admin.put(`${API}/runs/${run!.id}/cht/journal/7`).send({ actions: 'x' }).expect(400);
  });

  it('đánh giá tuần đầu: thiếu tiêu chí thì chưa xác nhận được; nguy cơ cao → QLKV được báo, cảnh báo đỏ; xác nhận xong lượt hoàn thành, khóa nhật ký', async () => {
    const { run, staff } = await staffItem(admin, 'Trịnh Thu Phương');
    const base = `${API}/runs/${run!.id}/cht/evaluation`;
    await admin.put(base).send({ ratings: { khong_co: 3 }, risk: null }).expect(400);
    const partial = (await admin.put(base).send({ ratings: { van_hanh: 4 }, risk: null }).expect(200)).body as ChtOnboardingResponse;
    expect(partial.problems).toEqual([
      'Hoàn thành checklist tuần đầu (còn 14 việc bắt buộc chưa xong)',
      'Chấm "Khả năng xử lý tình huống thực tế"',
      'Chấm "Mối quan hệ với đội nhóm"',
      'Đánh giá nguy cơ nghỉ việc',
    ]);
    expect((await huy.post(`${base}/confirm`).send({}).expect(400)).body.code).toBe('EVALUATION_INCOMPLETE');
    await huy.put(base).send({ ratings: { van_hanh: 4 }, risk: 'low' }).expect(403);

    await admin.put(base).send({ ratings: { van_hanh: 4, tinh_huong: 3, doi_nhom: 4 }, risk: 'high', suggestion: 'Kèm thêm phần điều hành ca' }).expect(200);
    expect((await notes(huy))[0].title).toBe('CHT Trịnh Thu Phương: nguy cơ nghỉ việc cao');
    const alerts = (await huy.get(`${API}/alerts`).expect(200)).body as AlertsResponse;
    expect(alerts.items.find((a) => a.staffId === staff.id)).toMatchObject({ key: 'attrition_high', severity: 'red' });

    // Đánh giá đủ nhưng checklist chưa xong thì vẫn chưa xác nhận được
    expect((await huy.post(`${base}/confirm`).send({}).expect(400)).body.message).toMatch(/hoàn thành checklist tuần đầu \(còn 14 việc/);
    const db = harness.app.get<Db>(DB);
    await db.update(runTasks).set({ status: 'done', doneDate: harness.today }).where(and(eq(runTasks.runId, run!.id), ne(runTasks.status, 'done')));
    expect((await onboarding(huy, run!.id)).problems).toEqual([]);

    const done = (await huy.post(`${base}/confirm`).send({ note: 'Đồng ý, tuần 2 tập trung điều hành ca' }).expect(200)).body as ChtOnboardingResponse;
    expect(done).toMatchObject({ runStatus: 'passed', evaluation: { confirmedByName: 'Ngô Quang Huy', risk: 'high' }, permissions: { journal: false, confirm: false } });
    await admin.put(`${API}/runs/${run!.id}/cht/journal/3`).send({ actions: 'x' }).expect(403);
  });
});

describe('gán checklist CHT', () => {
  it('QLKV gán CHT mới tuyển cho Minh (Nhà thuốc D): sinh 26 việc, báo cho CHT và người phụ trách Đào tạo; không gán trùng', async () => {
    const minhId = await userId('minh@upharma.local');
    const opt = (await huy.get(`${API}/cht/form-options/${minhId}`).expect(200)).body as ChtFormOptions;
    expect(opt).toMatchObject({ suggestedTrack: 'cht_moi_tuyen', staff: null, openChtRun: null });
    expect(opt.tracks.map((t) => [t.key, t.items])).toEqual([
      ['cht_moi_tuyen', 26],
      ['cht_thang_tien', 25],
    ]);
    const ntd = opt.stores.find((s) => s.name === 'Nhà thuốc D')!;
    const body = { userId: minhId, track: 'cht_moi_tuyen', storeId: ntd.id, startDate: addDays(harness.today, 1), trainingMode: 'online', trainerId: opt.trainers[0].id, qlkvId: ntd.defaultQlkvId };
    const res = (await huy.post(`${API}/cht/runs`).send(body).expect(201)).body as { staffId: number; runId: number };
    const tasks = (await huy.get(`${API}/runs/${res.runId}/tasks`).expect(200)).body as RunTasksResponse;
    expect(tasks).toMatchObject({ run: { track: 'cht_moi_tuyen', dayIndex: -1 }, staff: { fullName: 'Phan Đức Minh', storeName: 'Nhà thuốc D' } });
    expect(tasks.tasks).toHaveLength(26);
    expect((await notes(await as('minh')))[0].title).toMatch(/^Onboarding CHT mới tuyển: Phan Đức Minh bắt đầu ngày /);
    expect((await huy.post(`${API}/cht/runs`).send(body).expect(409)).body.code).toBe('CHT_RUN_OPEN');
  });

  it('chỉ gán cho tài khoản vai trò CHT; CHT, NV không gán được', async () => {
    const hanhId = await userId('hanh@upharma.local');
    const opt = (await admin.get(`${API}/cht/form-options/${hanhId}`).expect(200)).body as ChtFormOptions;
    const body = { userId: hanhId, track: 'cht_moi_tuyen', storeId: opt.stores[0].id, startDate: harness.today, trainingMode: 'offline', trainerId: opt.trainers[0].id, qlkvId: opt.qlkvs[0].id };
    expect((await admin.post(`${API}/cht/runs`).send(body).expect(400)).body.code).toBe('NOT_CHT');
    await (await as('ha')).get(`${API}/cht/form-options/${hanhId}`).expect(403);
    await (await as('lan')).post(`${API}/cht/runs`).send(body).expect(403);
  });

  it('NVBH thăng chức: đổi vai trò Thảo sang CHT rồi gán checklist thăng tiến → lượt NVBH đóng "Thăng chức CHT", dùng chung hồ sơ', async () => {
    const thaoId = await userId('thao@upharma.local');
    const host = await harness.as('thao', { role: 'cht', stores: ['NTB'] });
    await host.get(`${API}/me`).expect(200);
    const d = (await admin.get(`${API}/users/${thaoId}`).expect(200)).body as UserDetailResponse;
    const ntb = d.options.stores.find((s) => s.name === 'Nhà thuốc B')!.id;
    expect(d.user).toMatchObject({ role: 'cht', stores: [{ id: ntb }] });

    const opt = (await admin.get(`${API}/cht/form-options/${thaoId}`).expect(200)).body as ChtFormOptions;
    expect(opt).toMatchObject({ suggestedTrack: 'cht_thang_tien', staff: { storeName: 'Nhà thuốc B', currentRun: { track: 'nvbh', levelKey: 3 } } });
    const res = (await admin
      .post(`${API}/cht/runs`)
      .send({ userId: thaoId, track: 'cht_thang_tien', storeId: ntb, startDate: harness.today, trainingMode: 'offline', trainerId: opt.trainers[0].id, qlkvId: opt.qlkvs[0].id })
      .expect(201)).body as { staffId: number; runId: number };
    expect(res.staffId).toBe(opt.staff!.id);

    const profile = (await admin.get(`${API}/staff/${res.staffId}`).expect(200)).body as StaffProfileResponse;
    expect(profile.run).toMatchObject({ id: res.runId, track: 'cht_thang_tien', progress: { total: 25 } });
    expect(profile.history.map((h) => h.status)).toEqual(['active', 'promoted']);
    const view = await onboarding(admin, res.runId);
    expect(view.meta).toMatchObject({ previousStoreName: 'Nhà thuốc B', trainingMode: 'offline' });
    expect(view.meta.seniorityMonths).toBeGreaterThanOrEqual(18);
    expect(view.ratings.map((r) => r.key)).toContain('dong_nghiep_cu');
    // Thảo vẫn là Buddy của Linh (CHT được làm Buddy)
    const linh = await staffItem(admin, 'Hoàng Thùy Linh');
    expect(((await admin.get(`${API}/staff/${linh.staff.id}`).expect(200)).body as StaffProfileResponse).people.buddy).toBe('Đỗ Thị Thảo');
  });

  it('bản nháp có checklist CHT sai mã thì không gửi duyệt được', async () => {
    const draft = ((await admin.get(`${API}/versions`).expect(200)).body as VersionListResponse).items.find((i) => i.state === 'draft')!;
    const detail = (await admin.get(`${API}/versions/${draft.id}`).expect(200)).body as VersionDetailResponse;
    expect(detail.content.chtTracks?.map((t) => t.key)).toEqual(['cht_moi_tuyen', 'cht_thang_tien']);
    const content = structuredClone(detail.content);
    content.chtTracks![0].stages[0].items[0].key = 'X-1';
    await admin.put(`${API}/versions/${draft.id}/content`).send({ content, changeNote: 'Thử', rowVersion: detail.version.rowVersion }).expect(200);
    const res = await admin.post(`${API}/versions/${draft.id}/submit`).send({ changeNote: 'Thử' }).expect(400);
    expect(res.body.message).toMatch(/^Còn 1 lỗi/);
  });
});

describe('checklist CHT chỉ có ở bản sắp hiệu lực (như bản online nâng cấp từ v2.1 cũ)', () => {
  /** Tạo bản nháp từ bản đang hiệu lực, sửa nội dung, gửi duyệt rồi BP Đào tạo ban hành */
  async function publish(change: (c: VersionContent) => void, effectiveFrom: string, note: string) {
    const items = ((await admin.get(`${API}/versions`).expect(200)).body as VersionListResponse).items;
    const current = items.find((i) => i.state === 'current')!;
    const { id } = (await admin.post(`${API}/versions`).send({ fromId: current.id }).expect(201)).body as { id: number };
    const detail = (await admin.get(`${API}/versions/${id}`).expect(200)).body as VersionDetailResponse;
    const content = structuredClone(detail.content);
    change(content);
    await admin.put(`${API}/versions/${id}/content`).send({ content, changeNote: note, rowVersion: detail.version.rowVersion }).expect(200);
    await admin.post(`${API}/versions/${id}/submit`).send({ changeNote: note }).expect(200);
    return ((await admin.post(`${API}/versions/${id}/approve`).send({ effectiveFrom }).expect(200)).body as VersionDetailResponse).version.code;
  }

  it('form gán checklist lấy checklist của bản sắp hiệu lực; Ngày D trước ngày hiệu lực bị chặn', async () => {
    const draft = ((await admin.get(`${API}/versions`).expect(200)).body as VersionListResponse).items.find((i) => i.state === 'draft')!;
    await admin.delete(`${API}/versions/${draft.id}`).expect(200);
    await publish((c) => delete c.chtTracks, harness.today, 'Bản chưa có checklist CHT');
    const haId = await userId('ha@upharma.local');
    const before = (await admin.get(`${API}/cht/form-options/${haId}`).expect(200)).body as ChtFormOptions;
    expect(before).toMatchObject({ tracks: [], chtFrom: null });

    const tomorrow = addDays(harness.today, 1);
    const code = await publish((c) => (c.chtTracks = structuredClone(DEFAULT_CHT_TRACKS)), tomorrow, 'Thêm checklist CHT');
    const opt = (await admin.get(`${API}/cht/form-options/${haId}`).expect(200)).body as ChtFormOptions;
    expect(opt.chtFrom).toEqual({ date: tomorrow, code });
    expect(opt.tracks).toHaveLength(2);

    const body = { userId: haId, track: 'cht_moi_tuyen', storeId: opt.stores[0].id, startDate: harness.today, trainingMode: 'offline', trainerId: opt.trainers[0].id, qlkvId: opt.qlkvs[0].id };
    expect((await admin.post(`${API}/cht/runs`).send(body).expect(400)).body.code).toBe('NO_CHT_CHECKLIST');
    await admin.post(`${API}/cht/runs`).send({ ...body, startDate: tomorrow }).expect(201);
  });
});
