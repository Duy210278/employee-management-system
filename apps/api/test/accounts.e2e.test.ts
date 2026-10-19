import type {
  ImportUsersResponse,
  MeResponse,
  NotificationsResponse,
  OrgResponse,
  RegisterOptions,
  StaffProfileResponse,
  UpdateUserBodyT,
  UserDetailResponse,
  UserListResponse,
} from '@lotrinh/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, setupApp, type Agent, type TestApp } from './helpers';

let harness: TestApp;
const as = (key: string) => harness.as(key);
const usersOf = async (agent: Agent) => (await agent.get(`${API}/users`).expect(200)).body as UserListResponse;
const detailOf = async (agent: Agent, id: number) => (await agent.get(`${API}/users/${id}`).expect(200)).body as UserDetailResponse;
const idOf = async (email: string) => (await usersOf(await as('admin'))).items.find((u) => u.email === email)!.id;

/** Thân PUT /users/:id từ trạng thái hiện tại, ghi đè vài trường */
const bodyFrom = (d: UserDetailResponse, patch: Partial<UpdateUserBodyT> = {}): UpdateUserBodyT => ({
  fullName: d.user.fullName,
  employeeCode: d.user.employeeCode,
  phone: d.user.phone ?? '',
  role: d.user.role,
  storeIds: d.user.stores.map((s) => s.id),
  areaIds: d.user.areas.map((a) => a.id),
  canBuddy: d.user.canBuddy,
  canApproveVersions: d.user.canApproveVersions,
  status: d.user.status as 'active',
  rowVersion: d.user.rowVersion,
  handover: [],
  ...patch,
});

beforeAll(async () => {
  harness = await setupApp();
});
afterAll(() => harness.close());

describe('đăng ký và duyệt tài khoản (mục 5.1, 5.4)', () => {
  const khoi = { fullName: 'Trịnh Văn Khôi', employeeCode: 'NV301', email: 'khoi@upharma.local', phone: '0901 234 567', password: 'MatKhau@1', requestedRole: 'nv' };

  it('T-U01: người mới đăng ký thấy "Đang chờ duyệt"; BP ĐT nhận thông báo', async () => {
    const opts = (await harness.anonymous().get(`${API}/auth/register-options`).expect(200)).body as RegisterOptions;
    const store = opts.stores.find((s) => s.name === 'Nhà thuốc B')!;
    await harness.anonymous().post(`${API}/auth/register`).send({ ...khoi, storeId: store.id }).expect(201);

    const login = await harness.anonymous().post(`${API}/auth/login`).send({ email: khoi.email, password: khoi.password }).expect(403);
    expect(login.body).toEqual({ code: 'ACCOUNT_PENDING', message: 'Tài khoản đang chờ BP Đào tạo duyệt' });

    const notes = (await (await as('admin')).get(`${API}/me/notifications`).expect(200)).body as NotificationsResponse;
    expect(notes.unread).toBeGreaterThan(0);
    expect(notes.items[0]).toMatchObject({ type: 'registration', title: 'Đăng ký tài khoản mới: Trịnh Văn Khôi', read: false });

    const pending = (await usersOf(await as('admin'))).items.find((u) => u.email === khoi.email)!;
    expect(pending).toMatchObject({ status: 'pending', requested: { role: 'nv', storeName: 'Nhà thuốc B' } });
  });

  it('đăng ký trùng email, thiếu nhà thuốc bị chặn với thông báo rõ', async () => {
    const dup = await harness.anonymous().post(`${API}/auth/register`).send({ ...khoi, employeeCode: 'NV999', storeId: 1 }).expect(409);
    expect(dup.body.code).toBe('EMAIL_TAKEN');
    const noStore = await harness.anonymous().post(`${API}/auth/register`).send({ ...khoi, email: 'x@upharma.local', employeeCode: 'NV998' }).expect(400);
    expect(noStore.body.message).toContain('Chọn nhà thuốc');
  });

  it('chỉ BP ĐT quản trị tài khoản', async () => {
    await (await as('ha')).get(`${API}/users`).expect(403);
    await (await as('huy')).post(`${API}/users/1/approve`).send({ role: 'nv' }).expect(403);
  });

  it('BP ĐT duyệt: chốt vai trò, phạm vi; CHT phải có cửa hàng; người dùng đăng nhập được và có lịch sử', async () => {
    const admin = await as('admin');
    const id = await idOf(khoi.email);
    const noStore = await admin.post(`${API}/users/${id}/approve`).send({ role: 'cht', storeIds: [] }).expect(400);
    expect(noStore.body.message).toBe('Cửa hàng trưởng phải được gán ít nhất 1 cửa hàng');

    const d = (await admin.post(`${API}/users/${id}/approve`).send({ role: 'nv', canBuddy: true }).expect(200)).body as UserDetailResponse;
    expect(d.user).toMatchObject({ status: 'active', role: 'nv', canBuddy: true });
    expect(d.history[0]).toMatchObject({ fieldLabel: 'Duyệt đăng ký', oldValue: 'Chờ duyệt', newValue: 'Nhân viên · Có thể làm Buddy', byName: 'Ngô Quốc Bảo' });
    await admin.post(`${API}/users/${id}/approve`).send({ role: 'nv' }).expect(409);
    await harness.anonymous().post(`${API}/auth/login`).send({ email: khoi.email, password: khoi.password }).expect(200);
  });

  it('T-U02: từ chối không nhập lý do bị chặn; có lý do thì "Bị từ chối", đăng nhập thấy lý do', async () => {
    const admin = await as('admin');
    const id = await idOf('moi@upharma.local');
    const noNote = await admin.post(`${API}/users/${id}/reject`).send({ note: '  ' }).expect(400);
    expect(noNote.body.message).toBe('Nhập lý do từ chối');
    const d = (await admin.post(`${API}/users/${id}/reject`).send({ note: 'Không có trong danh sách nhân sự' }).expect(200)).body as UserDetailResponse;
    expect(d.user).toMatchObject({ status: 'rejected', reviewNote: 'Không có trong danh sách nhân sự' });
    const login = await harness.anonymous().post(`${API}/auth/login`).send({ email: 'moi@upharma.local', password: 'Demo@123' }).expect(403);
    expect(login.body.message).toBe('Đăng ký tài khoản đã bị từ chối: Không có trong danh sách nhân sự. Liên hệ BP Đào tạo');
  });
});

describe('sửa tài khoản (mục 5.3, 5.4)', () => {
  it('T-U03: hạ quyền hoặc khóa BP ĐT cuối cùng bị chặn', async () => {
    const admin = await as('admin');
    const id = await idOf('admin@upharma.local');
    const d = await detailOf(admin, id);
    expect(d.isLastBp).toBe(true);
    const storeId = d.options.stores[0].id;
    const res = await admin.put(`${API}/users/${id}`).send(bodyFrom(d, { role: 'cht', storeIds: [storeId] })).expect(409);
    expect(res.body.code).toBe('LAST_BP');
  });

  it('T-U06: đổi vai trò NV → CHT có hiệu lực ngay ở request kế tiếp và có bản ghi lịch sử', async () => {
    const admin = await as('admin');
    const hanh = await as('hanh');
    expect(((await hanh.get(`${API}/me`).expect(200)).body as MeResponse).user.role).toBe('nv');
    await hanh.get(`${API}/staff`).expect(200);
    const id = await idOf('hanh@upharma.local');
    const d = await detailOf(admin, id);
    const ntb = d.options.stores.find((s) => s.name === 'Nhà thuốc B')!.id;
    const after = (await admin.put(`${API}/users/${id}`).send(bodyFrom(d, { role: 'cht', storeIds: [ntb] })).expect(200)).body as UserDetailResponse;
    expect(after.user.stores.map((s) => s.name)).toEqual(['Nhà thuốc B']);
    expect(after.history.map((h) => [h.fieldLabel, h.oldValue, h.newValue])).toEqual(
      expect.arrayContaining([
        ['Vai trò', 'Nhân viên', 'Cửa hàng trưởng'],
        ['Cửa hàng phụ trách', null, 'Nhà thuốc B'],
      ]),
    );
    // Cùng phiên đăng nhập, request kế tiếp đã mang vai trò mới (mục 5.4 điều 2)
    expect(((await hanh.get(`${API}/me`).expect(200)).body as MeResponse).user.role).toBe('cht');
    const list = (await hanh.get(`${API}/staff`).expect(200)).body as { items: { staff: { storeName: string } }[] };
    expect(new Set(list.items.map((i) => i.staff.storeName))).toEqual(new Set(['Nhà thuốc B']));
  });

  it('sửa với rowVersion cũ bị chặn', async () => {
    const admin = await as('admin');
    const id = await idOf('hanh@upharma.local');
    const d = await detailOf(admin, id);
    await admin.put(`${API}/users/${id}`).send(bodyFrom(d, { rowVersion: d.user.rowVersion - 1 })).expect(409);
  });

  it('T-U04: khóa tài khoản đang là Buddy của 3 NV → bắt buộc chuyển giao, rồi người thay nhận việc', async () => {
    const admin = await as('admin');
    const id = await idOf('hung@upharma.local');
    const d = await detailOf(admin, id);
    const buddyOf = d.assignments.filter((a) => a.role === 'buddy');
    expect(buddyOf.map((a) => a.staffName).sort()).toEqual(['Nguyễn Thị Lan', 'Phạm Minh Tuấn', 'Vũ Thị Mai']);

    const blocked = await admin.put(`${API}/users/${id}`).send(bodyFrom(d, { status: 'locked' })).expect(409);
    expect(blocked.body.code).toBe('HANDOVER_REQUIRED');
    expect(blocked.body.message).toContain('Chọn người thay cho 3 phân công');

    const lanAssignment = buddyOf.find((a) => a.staffName === 'Nguyễn Thị Lan')!;
    const thao = d.candidates.buddy.find((c) => c.fullName === 'Đỗ Thị Thảo')!;
    const ha = d.candidates.buddy.find((c) => c.fullName === 'Phạm Thu Hà')!;
    // Người thay phải hợp lệ: NV không làm Buddy của chính mình
    const lanUser = lanAssignment.staffUserId!;
    const self = await admin
      .put(`${API}/users/${id}`)
      .send(bodyFrom(d, { status: 'locked', handover: buddyOf.map((a) => ({ runId: a.runId, role: a.role, userId: a === lanAssignment ? lanUser : thao.id })) }))
      .expect(400);
    expect(self.body.code).toBe('INVALID_HANDOVER');

    const handover = buddyOf.map((a) => ({ runId: a.runId, role: a.role, userId: a === lanAssignment ? ha.id : thao.id }));
    const after = (await admin.put(`${API}/users/${id}`).send(bodyFrom(d, { status: 'locked', handover })).expect(200)).body as UserDetailResponse;
    expect(after.user.status).toBe('locked');
    expect(after.assignments).toEqual([]);
    expect(after.history.filter((h) => h.field === 'handover').map((h) => h.newValue)).toContain('Nguyễn Thị Lan · Buddy → Phạm Thu Hà');

    const profile = (await admin.get(`${API}/staff/${lanAssignment.staffId}`).expect(200)).body as StaffProfileResponse;
    expect(profile.people.buddy).toBe('Phạm Thu Hà');
    // Xác nhận cũ của Hùng vẫn giữ tên (mục 5.4 điều 4); tài khoản bị khóa không đăng nhập được
    const login = await request(harness.app.getHttpServer()).post(`${API}/auth/login`).send({ email: 'hung@upharma.local', password: 'Demo@123' }).expect(403);
    expect(login.body.message).toBe('Tài khoản đang bị tạm khóa. Liên hệ BP Đào tạo');
  });

  it('không tự khóa tài khoản của mình', async () => {
    const admin = await as('admin');
    const id = await idOf('admin@upharma.local');
    const body = bodyFrom(await detailOf(admin, id), { status: 'locked' });
    const res = await admin.put(`${API}/users/${id}`).send(body).expect(400);
    expect(res.body.code).toBe('SELF_LOCK');
  });
});

describe('danh mục cửa hàng, khu vực (mục 5.5)', () => {
  it('thêm khu vực, cửa hàng; trùng mã bị chặn; không ngừng cửa hàng còn nhân viên', async () => {
    const admin = await as('admin');
    let org = (await admin.post(`${API}/org/areas`).send({ code: 'HN2', name: 'Hà Nội 2' }).expect(201)).body as OrgResponse;
    const hn2 = org.areas.find((a) => a.code === 'HN2')!;
    org = (await admin.post(`${API}/org/stores`).send({ code: 'NTC', name: 'Nhà thuốc C', address: '8 Láng Hạ', areaId: hn2.id }).expect(201)).body as OrgResponse;
    expect(org.stores.find((s) => s.code === 'NTC')).toMatchObject({ areaName: 'Hà Nội 2', staffCount: 0, active: true });
    await admin.post(`${API}/org/stores`).send({ code: 'NTC', name: 'Trùng', areaId: hn2.id }).expect(409);

    const nta = org.stores.find((s) => s.code === 'NTA')!;
    expect(nta.chtNames).toEqual(['Phạm Thu Hà']);
    const busy = await admin.put(`${API}/org/stores/${nta.id}`).send({ code: 'NTA', name: nta.name, areaId: nta.areaId, active: false }).expect(409);
    expect(busy.body.code).toBe('STORE_IN_USE');
    await (await as('ha')).get(`${API}/org`).expect(403);
  });
});

describe('nhập tài khoản hàng loạt (mục 5.6)', () => {
  const csv = [
    'ma_nv;ho_ten;email;dien_thoai;vai_tro;ma_cua_hang;ma_khu_vuc;buddy',
    'NV401;Đinh Thị Yến;yen@upharma.local;0912;NV;NTA;;x',
    'NV402;Trùng Email;lan@upharma.local;;NV;NTA;;',
    'CH009;Cửa Hàng Lạ;la@upharma.local;;CHT;KHONGCO;;',
    ';Không Vai Trò;novai@upharma.local;;GiamDoc;;;',
  ].join('\n');

  it('xem trước đánh dấu dòng lỗi; xác nhận thì chỉ nhập dòng hợp lệ', async () => {
    const admin = await as('admin');
    const preview = (await admin.post(`${API}/users/import`).send({ csv, commit: false }).expect(200)).body as ImportUsersResponse;
    expect(preview).toMatchObject({ valid: 1, invalid: 3, imported: null });
    expect(preview.rows.map((r) => [r.line, r.errors])).toEqual([
      [2, []],
      [3, ['Email đã có tài khoản hoặc trùng dòng trên']],
      [4, ['Cửa hàng KHONGCO không tồn tại']],
      [5, ['Vai trò phải là NV, CHT, QLKV hoặc BP']],
    ]);
    const done = (await admin.post(`${API}/users/import`).send({ csv, commit: true }).expect(200)).body as ImportUsersResponse;
    expect(done.imported).toBe(1);
    const yen = (await usersOf(admin)).items.find((u) => u.email === 'yen@upharma.local')!;
    expect(yen).toMatchObject({ status: 'active', role: 'nv', canBuddy: true, employeeCode: 'NV401' });
    await harness.anonymous().post(`${API}/auth/login`).send({ email: 'yen@upharma.local', password: done.initialPassword }).expect(200);
  });
});
