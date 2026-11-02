import { addDays, type NotificationsResponse, type StaffFormOptions, type VersionDetailResponse, type VersionListResponse } from '@lotrinh/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, setupApp, type Agent, type TestApp } from './helpers';

let harness: TestApp;
let admin: Agent;
let d: (n: number) => string;
let v22: number;
const as = (key: string) => harness.as(key);
const detail = async (agent: Agent, id: number) => (await agent.get(`${API}/versions/${id}`).expect(200)).body as VersionDetailResponse;
const byCode = async (code: string) => ((await admin.get(`${API}/versions`).expect(200)).body as VersionListResponse).items.find((i) => i.code === code)!;
const move = (id: number, n: number, status: number, agent = admin) => agent.put(`${API}/versions/${id}/effective`).send({ effectiveFrom: d(n) }).expect(status);

/** Thêm NV Level 1 bắt đầu sau n ngày; lượt gắn phiên bản hiệu lực tại ngày bắt đầu (R01) */
async function addStaff(name: string, n: number) {
  const opt = (await admin.get(`${API}/staff/form-options`).expect(200)).body as StaffFormOptions;
  const store = opt.stores.find((s) => s.name === 'Nhà thuốc A')!;
  const body = { fullName: name, storeId: store.id, hireDate: d(n), levelKey: 1, buddyId: opt.buddies[0].id, chtId: store.defaultChtId, qlkvId: store.defaultQlkvId };
  return (await admin.post(`${API}/staff`).send(body).expect(201)).body as { staffId: number; runId: number };
}

beforeAll(async () => {
  harness = await setupApp();
  d = (n) => addDays(harness.today, n);
  admin = await as('admin');
  // Bản nháp mẫu (thay đổi tiêu chí) → gửi duyệt → ban hành hiệu lực sau 10 ngày: v2.2 "Sắp hiệu lực"
  const draft = ((await admin.get(`${API}/versions`).expect(200)).body as VersionListResponse).items.find((i) => i.state === 'draft')!;
  await admin.post(`${API}/versions/${draft.id}/submit`).send({}).expect(200);
  const approved = (await admin.post(`${API}/versions/${draft.id}/approve`).send({ effectiveFrom: d(10) }).expect(200)).body as VersionDetailResponse;
  expect(approved.version).toMatchObject({ code: '2.2', state: 'scheduled' });
  v22 = draft.id;
});
afterAll(() => harness.close());

describe('đổi ngày hiệu lực của bản "Sắp hiệu lực"', () => {
  it('BP ĐT đổi được; QLKV và bản đang hiệu lực thì không', async () => {
    const forAdmin = await detail(admin, v22);
    expect(forAdmin.permissions.reschedule).toBe(true);
    expect(forAdmin.effectiveRange).toEqual({ min: harness.today, max: null });
    await move(v22, 20, 403, await as('huy'));

    const v21 = await byCode('2.1');
    expect((await detail(admin, v21.id)).permissions.reschedule).toBe(false);
    const res = await move(v21.id, 20, 409);
    expect(res.body.code).toBe('NOT_SCHEDULED');
  });

  it('dời sau: bản bị thay thế kết thúc theo ngày mới; người đổi không tự nhận thông báo; ngày ở quá khứ bị chặn', async () => {
    const after = (await move(v22, 20, 200)).body as VersionDetailResponse;
    expect(after.version).toMatchObject({ effectiveFrom: d(20), state: 'scheduled' });
    expect((await byCode('2.1')).effectiveTo).toBe(d(19));
    const notes = (await admin.get(`${API}/me/notifications`).expect(200)).body as NotificationsResponse;
    expect(notes.items.some((n) => /^Bộ lộ trình v2\.2 đổi ngày hiệu lực/.test(n.title))).toBe(false);

    const past = await move(v22, -1, 400);
    expect(past.body).toMatchObject({ code: 'EFFECTIVE_TOO_EARLY', message: 'Ngày hiệu lực không được trước hôm nay' });
  });

  it('có lượt Level bắt đầu trong khoảng giữa ngày cũ và ngày mới thì bị chặn, ở cả hai chiều', async () => {
    // Lượt bắt đầu sau 25 ngày đã gắn v2.2 (hiệu lực từ ngày 20)
    await addStaff('Ngô Tương Lai', 25);
    const later = await move(v22, 30, 409);
    expect(later.body.code).toBe('RUNS_AFFECTED');
    expect(later.body.message).toContain('Ngô Tương Lai');

    // Đưa sớm lên ngày 15 được vì không có lượt nào bắt đầu từ ngày 15 đến trước ngày 20
    await move(v22, 15, 200);
    expect((await byCode('2.1')).effectiveTo).toBe(d(14));

    // Lượt bắt đầu sau 12 ngày gắn v2.1; đưa v2.2 lên ngày 11 sẽ đổi phiên bản của lượt đó → chặn
    await addStaff('Trần Sớm Hơn', 12);
    const earlier = await move(v22, 11, 409);
    expect(earlier.body.message).toContain('Trần Sớm Hơn');
    await move(v22, 13, 200);
  });

  it('không dời qua ngày của bản ban hành sau nó', async () => {
    // Ban hành tiếp v2.3 hiệu lực sau 40 ngày, tạo từ v2.2
    const { id } = (await admin.post(`${API}/versions`).send({ fromId: v22 }).expect(201)).body as { id: number };
    const draft = await detail(admin, id);
    const content = structuredClone(draft.content);
    content.levels[0].stages[0].items.find((i) => i.key === 'L1-1-3')!.dueOffset = 3;
    await admin.put(`${API}/versions/${id}/content`).send({ content, changeNote: 'Dời hạn L1-1-3', rowVersion: draft.version.rowVersion }).expect(200);
    await admin.post(`${API}/versions/${id}/submit`).send({}).expect(200);
    await admin.post(`${API}/versions/${id}/approve`).send({ effectiveFrom: d(40) }).expect(200);

    expect((await detail(admin, v22)).effectiveRange).toEqual({ min: harness.today, max: d(39) });
    const late = await move(v22, 45, 400);
    expect(late.body.code).toBe('EFFECTIVE_TOO_LATE');
    // v2.3 cũng dời được, nhưng không lên trước v2.2
    expect((await detail(admin, id)).effectiveRange).toEqual({ min: d(14), max: null });
    await move(id, 13, 400);
  });
});
