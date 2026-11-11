import type { MeResponse, UpdateUserBodyT, UserDetailResponse, UserListResponse } from '@lotrinh/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, setupApp, type Agent, type TestApp } from './helpers';

let harness: TestApp;
const as = (key: string) => harness.as(key);
const usersOf = async (agent: Agent) => (await agent.get(`${API}/users`).expect(200)).body as UserListResponse;
const detailOf = async (agent: Agent, id: number) => (await agent.get(`${API}/users/${id}`).expect(200)).body as UserDetailResponse;
const buddyBody = (d: UserDetailResponse, canBuddy: boolean): UpdateUserBodyT => ({
  canBuddy,
  rowVersion: d.user.rowVersion,
  handover: [],
});

beforeAll(async () => {
  harness = await setupApp();
});
afterAll(() => harness.close());

describe('xác thực chỉ qua hệ thống chính', () => {
  it('bỏ các endpoint đăng nhập, đăng ký và đăng nhập nhanh riêng của module', async () => {
    const anon = harness.anonymous();
    const origin = 'http://127.0.0.1';
    await anon.post(`${API}/auth/login`).set('Origin', origin).send({}).expect(404);
    await anon.post(`${API}/auth/register`).set('Origin', origin).send({}).expect(404);
    await anon.get(`${API}/auth/register-options`).expect(404);
    await anon.post(`${API}/demo/login-as`).set('Origin', origin).send({ userId: 1 }).expect(404);
    await anon.get(`${API}/demo/accounts`).expect(404);
    expect(await anon.get(`${API}/auth/config`).expect(200).then((r) => r.body)).toEqual({
      loginUrl: 'http://127.0.0.1/dang-nhap',
      logoutUrl: 'http://127.0.0.1/dang-xuat',
    });
  });

  it('không có cookie host thì API nghiệp vụ trả 401', async () => {
    const response = await harness.anonymous().get(`${API}/me`).expect(401);
    expect(response.body.code).toBe('SSO_REQUIRED');
  });
});

describe('quản trị tài khoản trong module', () => {
  it('BP Đào tạo đổi quyền Buddy; danh tính, vai trò và phạm vi vẫn theo hệ thống chính', async () => {
    const admin = await as('admin');
    const list = await usersOf(admin);
    const hanh = list.items.find((u) => u.employeeCode === 'NV206')!;
    const before = await detailOf(admin, hanh.id);

    const attemptedChanges = {
      ...buddyBody(before, true),
      fullName: 'Tên không được đổi từ module',
      role: 'cht',
      storeIds: [before.options.stores.find((s) => s.code === 'NTB')!.id],
    };
    const updated = (await admin.put(`${API}/users/${hanh.id}`).send(attemptedChanges).expect(200)).body as UserDetailResponse;

    expect(updated.user).toMatchObject({
      fullName: before.user.fullName,
      role: 'nv',
      canBuddy: true,
      stores: [],
    });
    expect(updated.history[0]).toMatchObject({
      field: 'canBuddy',
      oldValue: 'Không',
      newValue: 'Có',
      byName: 'Ngô Quốc Bảo',
    });
    expect(((await admin.get(`${API}/me`).expect(200)).body as MeResponse).user.role).toBe('bp');
  });

  it('chỉ BP Đào tạo được xem và sửa quyền Buddy', async () => {
    const [ha, admin] = await Promise.all([as('ha'), as('admin')]);
    await ha.get(`${API}/users`).expect(403);
    const user = (await usersOf(admin)).items.find((u) => u.employeeCode === 'NV206')!;
    const detail = await detailOf(admin, user.id);
    await ha.put(`${API}/users/${user.id}`).send(buddyBody(detail, true)).expect(403);
  });

  it('không còn endpoint tạo, nhập, duyệt hoặc từ chối tài khoản', async () => {
    const admin = await as('admin');
    const origin = 'http://127.0.0.1';
    await admin.post(`${API}/users`).set('Origin', origin).send({}).expect(404);
    await admin.post(`${API}/users/import`).set('Origin', origin).send({ csv: '', commit: true }).expect(404);
    await admin.post(`${API}/users/1/approve`).set('Origin', origin).send({}).expect(404);
    await admin.post(`${API}/users/1/reject`).set('Origin', origin).send({}).expect(404);
  });
});
