import {
  addDays,
  diffDays,
  type CreateStaffBodyT,
  type InboxResponse,
  type StaffFormOptions,
  type StaffListResponse,
  type StaffProfileResponse,
} from '@lotrinh/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, runTasks, setupApp, todayOf, type Agent, type TestApp } from './helpers';

let harness: TestApp;
const as = (key: string) => harness.as(key);
const listOf = async (agent: Agent) => (await agent.get(`${API}/staff`).expect(200)).body as StaffListResponse;
const names = (list: StaffListResponse) => list.items.map((i) => i.staff.fullName).sort();

beforeAll(async () => {
  harness = await setupApp();
});
afterAll(() => harness.close());

describe('danh sách nhân sự theo phạm vi (mục 11.4, R22)', () => {
  it('CHT chỉ thấy NV cửa hàng mình; QLKV thấy cả khu vực; BP ĐT thấy toàn chuỗi', async () => {
    const [ha, binh, huy, admin] = await Promise.all([as('ha'), as('binh'), as('huy'), as('admin')]);
    expect(names(await listOf(ha))).toEqual(['Nguyễn Thị Lan', 'Phạm Minh Tuấn', 'Trần Văn Hùng', 'Vũ Thị Mai']);
    expect(names(await listOf(binh))).toEqual(['Hoàng Thùy Linh', 'Đặng Văn Nam', 'Đỗ Thị Thảo'].sort());
    // 7 NV và 1 CHT mới tuyển đang onboarding (Phương, Nhà thuốc C)
    expect((await listOf(huy)).items).toHaveLength(8);
    expect((await listOf(admin)).items).toHaveLength(8);
  });

  it('Buddy (NV) chỉ thấy hồ sơ của mình và NV mình kèm; không được thêm nhân viên', async () => {
    const hung = await as('hung');
    const list = await listOf(hung);
    expect(names(list)).toEqual(['Nguyễn Thị Lan', 'Phạm Minh Tuấn', 'Trần Văn Hùng', 'Vũ Thị Mai']);
    expect(list.canCreate).toBe(false);
  });

  it('bảng có tiến độ, số mục trễ và tín hiệu cảnh báo', async () => {
    const lan = (await listOf(await as('ha'))).items.find((i) => i.staff.fullName === 'Nguyễn Thị Lan')!;
    expect(lan.run).toMatchObject({ levelKey: 1, dayIndex: 26, counts: { overdue: 3 } });
    expect(lan.alerts.map((a) => [a.key, a.severity])).toEqual([['overdue', 'yellow']]);
  });
});

describe('hồ sơ nhân viên', () => {
  it('T-U05: CHT Nhà thuốc A mở hồ sơ NV Nhà thuốc B → bị từ chối ở máy chủ', async () => {
    const [binh, ha] = await Promise.all([as('binh'), as('ha')]);
    const linh = (await listOf(binh)).items.find((i) => i.staff.fullName === 'Hoàng Thùy Linh')!;
    const res = await ha.get(`${API}/staff/${linh.staff.id}`).expect(403);
    expect(res.body.code).toBe('OUT_OF_SCOPE');
  });

  it('hồ sơ có người phụ trách, thanh lộ trình và lịch sử lượt', async () => {
    const ha = await as('ha');
    const lan = (await listOf(ha)).items.find((i) => i.staff.fullName === 'Nguyễn Thị Lan')!;
    const profile = (await ha.get(`${API}/staff/${lan.staff.id}`).expect(200)).body as StaffProfileResponse;
    expect(profile.people).toEqual({ buddy: 'Trần Văn Hùng', cht: 'Phạm Thu Hà', qlkv: 'Ngô Quang Huy', trainer: null });
    expect(profile.path.map((p) => p.state)).toEqual(['current', 'future', 'future', 'future']);
    expect(profile.history).toHaveLength(1);
    expect(profile.isSelf).toBe(false);
  });

  it('lịch tính từ ngày bắt đầu của từng người: Tuấn vào sau Lan 17 ngày thì mọi hạn lệch đúng 17 ngày', async () => {
    const [lan, tuan] = await Promise.all([as('lan'), as('tuan')]);
    const [a, b] = await Promise.all([todayOf(lan), todayOf(tuan)]);
    const offset = diffDays(b.run!.startDate, a.run!.startDate);
    expect(offset).toBe(17);
    for (const task of a.tasks) {
      const same = b.tasks.find((x) => x.itemKey === task.itemKey)!;
      expect(diffDays(same.dueDate, task.dueDate)).toBe(offset);
    }
  });
});

describe('thêm nhân viên và bắt đầu Level 1 (kịch bản 5.6 bước 2–3)', () => {
  let ha: Agent;
  let options: StaffFormOptions;
  let body: CreateStaffBodyT;

  beforeAll(async () => {
    ha = await as('ha');
    options = (await ha.get(`${API}/staff/form-options`).expect(200)).body;
    const store = options.stores[0];
    body = {
      fullName: 'Bùi Thị Hạnh',
      storeId: store.id,
      hireDate: addDays(harness.today, 1),
      levelKey: 1,
      userId: options.accounts.find((a) => a.fullName === 'Bùi Thị Hạnh')!.id,
      buddyId: options.buddies.find((b) => b.fullName === 'Trần Văn Hùng')!.id,
      chtId: store.defaultChtId!,
      qlkvId: store.defaultQlkvId!,
    };
  });

  it('form chỉ có cửa hàng trong phạm vi, CHT/QLKV mặc định theo cửa hàng, tài khoản NV chưa có hồ sơ', () => {
    expect(options.stores.map((s) => s.name)).toEqual(['Nhà thuốc A']);
    expect(options.chts.find((c) => c.id === options.stores[0].defaultChtId)?.fullName).toBe('Phạm Thu Hà');
    expect(options.qlkvs.find((c) => c.id === options.stores[0].defaultQlkvId)?.fullName).toBe('Ngô Quang Huy');
    expect(options.accounts.map((a) => a.fullName)).toEqual(['Bùi Thị Hạnh']);
  });

  it('Level 1 bắt buộc có Buddy; không thêm được cho cửa hàng ngoài phạm vi; NV không được thêm', async () => {
    const noBuddy = await ha.post(`${API}/staff`).send({ ...body, buddyId: null }).expect(400);
    expect(noBuddy.body.message).toBe('Level 1–2 bắt buộc có Buddy');
    const [huy, lan] = await Promise.all([as('huy'), as('lan')]);
    const storeB = ((await huy.get(`${API}/staff/form-options`).expect(200)).body as StaffFormOptions).stores.find((s) => s.name === 'Nhà thuốc B')!;
    await ha.post(`${API}/staff`).send({ ...body, storeId: storeB.id }).expect(403);
    await lan.post(`${API}/staff`).send(body).expect(403);
    await lan.get(`${API}/staff/form-options`).expect(403);
  });

  it('T-L04: NV bắt đầu ngày mai → Hôm nay báo "còn 1 ngày"; Buddy thấy việc tuần 1 ở mục Sắp bắt đầu', async () => {
    const created = await ha.post(`${API}/staff`).send(body).expect(201);
    expect(created.body).toMatchObject({ staffId: expect.any(Number), runId: expect.any(Number) });

    const hanh = await todayOf(await as('hanh'));
    expect(hanh.run).toMatchObject({ dayIndex: -1, startDate: addDays(harness.today, 1), versionCode: '2.1' });
    expect(hanh.tasks).toHaveLength(60);

    const inbox = (await (await as('hung')).get(`${API}/me/inbox`).expect(200)).body as InboxResponse;
    const group = inbox.upcoming.find((g) => g.staff.fullName === 'Bùi Thị Hạnh')!;
    expect(group.items.every((i) => i.stageKey === 'L1-S1' && i.state.code === 'upcoming')).toBe(true);
  });

  it('tài khoản đã gắn hồ sơ thì không gắn lại được', async () => {
    const res = await ha.post(`${API}/staff`).send({ ...body, fullName: 'Trùng' }).expect(400);
    expect(res.body.code).toBe('ACCOUNT_TAKEN');
  });

  it('tua thêm 1 ngày: việc tuần 1 của NV mới mở và vào hàng đợi Buddy', async () => {
    const admin = await as('admin');
    await admin.put(`${API}/demo/clock`).send({ shiftDays: 1 }).expect(200);
    const hung = await as('hung');
    const inbox = (await hung.get(`${API}/me/inbox`).expect(200)).body as InboxResponse;
    const group = inbox.groups.find((g) => g.staff.fullName === 'Bùi Thị Hạnh')!;
    expect(group.run.dayIndex).toBe(0);
    expect(group.items.length).toBeGreaterThan(0);
    const run = await runTasks(hung, group.run.id);
    expect(run.stages[0]).toMatchObject({ from: addDays(harness.today, 1), to: addDays(harness.today, 8) });
    await admin.put(`${API}/demo/clock`).send({ date: null }).expect(200);
  });
});

describe('công cụ demo', () => {
  it('chỉ BP ĐT khôi phục được dữ liệu mẫu; sau khi khôi phục, NV vừa thêm biến mất', async () => {
    const ha = await as('ha');
    await ha.post(`${API}/demo/reset`).expect(403);
    const admin = await as('admin');
    expect((await listOf(admin)).items).toHaveLength(9);
    await admin.post(`${API}/demo/reset`).expect(200);
    expect((await listOf(await as('admin'))).items).toHaveLength(8);
  });
});
