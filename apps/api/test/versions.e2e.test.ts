import {
  addDays,
  VersionContentSchema,
  type InboxResponse,
  type StaffFormOptions,
  type VersionContent,
  type VersionDetailResponse,
  type VersionListResponse,
} from '@lotrinh/shared';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../src/db/client';
import { API, setupApp, todayOf, type Agent, type TestApp } from './helpers';

let harness: TestApp;
let admin: Agent;
const as = (key: string) => harness.as(key);
const list = async (agent: Agent) => (await agent.get(`${API}/versions`).expect(200)).body as VersionListResponse;
const detail = async (agent: Agent, id: number) => (await agent.get(`${API}/versions/${id}`).expect(200)).body as VersionDetailResponse;
const itemIn = (c: VersionContent, key: string) => c.levels.flatMap((l) => l.stages.flatMap((s) => s.items)).find((i) => i.key === key)!;

/** Đọc bản nháp, sửa nội dung, lưu và kiểm tra mã HTTP */
async function save(id: number, mutate: (c: VersionContent) => void, changeNote = 'Ghi chú thay đổi', status = 200) {
  const d = await detail(admin, id);
  const content = structuredClone(d.content);
  mutate(content);
  return admin.put(`${API}/versions/${id}/content`).send({ content, changeNote, rowVersion: d.version.rowVersion }).expect(status);
}

/** Drizzle bọc lỗi PostgreSQL trong cause */
async function dbError(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return '';
  } catch (err) {
    const e = err as Error & { cause?: Error };
    return e.cause?.message ?? e.message;
  }
}

beforeAll(async () => {
  harness = await setupApp();
  admin = await as('admin');
});
afterAll(() => harness.close());

describe('quyền và danh sách phiên bản', () => {
  it('BP ĐT soạn và duyệt được; QLKV, CHT, NV không xem được', async () => {
    const forAdmin = await list(admin);
    expect(forAdmin).toMatchObject({ canEdit: true, canApprove: true });
    expect(forAdmin.items.map((i) => [i.code, i.state])).toEqual([
      [null, 'draft'],
      ['2.1', 'current'],
    ]);
    await (await as('huy')).get(`${API}/versions`).expect(403);
    await (await as('ha')).get(`${API}/versions`).expect(403);
    await (await as('lan')).get(`${API}/versions`).expect(403);
  });

  it('chỉ một bản nháp mở mỗi lúc', async () => {
    const current = (await list(admin)).items.find((i) => i.state === 'current')!;
    const res = await admin.post(`${API}/versions`).send({ fromId: current.id }).expect(409);
    expect(res.body.code).toBe('OPEN_DRAFT_EXISTS');
  });
});

describe('sửa diễn đạt (T-V01)', () => {
  let draftId: number;

  it('xóa bản nháp mẫu, tạo nháp mới từ v2.1, chỉ sửa hướng dẫn một mục', async () => {
    const items = (await list(admin)).items;
    await admin.delete(`${API}/versions/${items.find((i) => i.state === 'draft')!.id}`).expect(200);
    draftId = (await admin.post(`${API}/versions`).send({ fromId: items.find((i) => i.state === 'current')!.id }).expect(201)).body.id;
    await save(draftId, (c) => (itemIn(c, 'L1-4-6').guidance = 'CHT lấy báo cáo POS ngày 5 hằng tháng.'), 'Làm rõ hướng dẫn L1-4-6');
  });

  it('T-V03: gửi duyệt khi còn lỗi bị chặn; thiếu ghi chú bị chặn', async () => {
    // Không chọn người xác nhận và tắt phần NV: đầu việc không có ai xác nhận
    await save(draftId, (c) => Object.assign(itemIn(c, 'L1-1-1'), { verifiers: [], requireNvFirst: false }));
    const blocked = await admin.post(`${API}/versions/${draftId}/submit`).send({}).expect(400);
    expect(blocked.body.code).toBe('VALIDATION_FAILED');
    // Trả lại như v2.1: NV tự xác nhận
    await save(draftId, (c) => Object.assign(itemIn(c, 'L1-1-1'), { verifiers: [], requireNvFirst: true }), '');
    const noNote = await admin.post(`${API}/versions/${draftId}/submit`).send({}).expect(400);
    expect(noNote.body.code).toBe('CHANGE_NOTE_REQUIRED');
  });

  it('chống ghi đè khi hai người cùng sửa bản nháp', async () => {
    const d = await detail(admin, draftId);
    const res = await admin
      .put(`${API}/versions/${draftId}/content`)
      .send({ content: d.content, changeNote: 'x', rowVersion: d.version.rowVersion - 1 })
      .expect(409);
    expect(res.body.code).toBe('STALE');
  });

  it('gửi duyệt → không sửa được nữa; QLKV không duyệt được; BP ĐT ban hành → số 2.1.1, NV đang chạy thấy câu mới ngay', async () => {
    const submitted = (await admin.post(`${API}/versions/${draftId}/submit`).send({ changeNote: 'Làm rõ hướng dẫn L1-4-6' }).expect(200)).body;
    expect(submitted.version).toMatchObject({ state: 'pending', changeKind: 'text' });
    await save(draftId, (c) => (itemIn(c, 'L1-4-6').guidance = 'sửa lén'), 'x', 409);
    await (await as('huy')).post(`${API}/versions/${draftId}/approve`).send({ effectiveFrom: harness.today }).expect(403);

    const approved = (await admin.post(`${API}/versions/${draftId}/approve`).send({ effectiveFrom: harness.today }).expect(200)).body;
    expect(approved.version).toMatchObject({ code: '2.1.1', criteriaLine: '2.1', state: 'current', approvedByName: 'Ngô Quốc Bảo' });

    const lan = await todayOf(await as('lan'));
    expect(lan.tasks.find((t) => t.itemKey === 'L1-4-6')!.guidance).toBe('CHT lấy báo cáo POS ngày 5 hằng tháng.');
    expect(lan.run!.versionCode).toBe('2.1');
  });
});

describe('thay đổi tiêu chí (T-V02, T-V04)', () => {
  let draftId: number;
  const tomorrow = () => addDays(harness.today, 1);

  it('đổi hạn một mục → loại "tiêu chí"; BP ĐT rút về nháp, sửa ghi chú rồi gửi lại', async () => {
    const current = (await list(admin)).items.find((i) => i.state === 'current')!;
    draftId = (await admin.post(`${API}/versions`).send({ fromId: current.id }).expect(201)).body.id;
    await save(draftId, (c) => (itemIn(c, 'L1-1-1').dueOffset = 2), 'Lùi hạn nhận việc');
    await admin.post(`${API}/versions/${draftId}/submit`).send({}).expect(200);
    const returned = (await admin.post(`${API}/versions/${draftId}/withdraw`).expect(200)).body;
    expect(returned.version).toMatchObject({ state: 'draft' });
    await admin.post(`${API}/versions/${draftId}/reject`).send({ note: 'x' }).expect(404);
    const again = (await admin.post(`${API}/versions/${draftId}/submit`).send({ changeNote: 'Lùi hạn nhận việc vì ca đầu là ca chiều' }).expect(200)).body;
    expect(again.version).toMatchObject({ state: 'pending', changeKind: 'criteria' });
  });

  it('ngày hiệu lực ở quá khứ bị chặn; duyệt hiệu lực từ ngày mai → số 2.2, bản cũ hết hiệu lực hôm nay', async () => {
    await admin.post(`${API}/versions/${draftId}/approve`).send({ effectiveFrom: addDays(harness.today, -1) }).expect(400);
    const approved = (await admin.post(`${API}/versions/${draftId}/approve`).send({ effectiveFrom: tomorrow() }).expect(200)).body as VersionDetailResponse;
    expect(approved.version).toMatchObject({ code: '2.2', criteriaLine: '2.2', state: 'scheduled', effectiveFrom: tomorrow() });
    const items = (await list(admin)).items;
    expect(items.find((i) => i.code === '2.1.1')).toMatchObject({ state: 'current', effectiveTo: harness.today });
  });

  it('NV đang chạy không bị ảnh hưởng; NV bắt đầu hôm nay nhận 2.1.1, bắt đầu từ ngày hiệu lực nhận 2.2', async () => {
    const lan = await todayOf(await as('lan'));
    expect(lan.tasks.find((t) => t.itemKey === 'L1-1-1')!.dueDate).toBe(addDays(lan.run!.startDate, 1));

    const ha = await as('ha');
    const opt = (await ha.get(`${API}/staff/form-options`).expect(200)).body as StaffFormOptions;
    const store = opt.stores[0];
    const hungId = opt.buddies.find((x) => x.fullName === 'Trần Văn Hùng')!.id;
    const base = { storeId: store.id, levelKey: 1, buddyId: hungId, chtId: store.defaultChtId!, qlkvId: store.defaultQlkvId! };
    const a = (await ha.post(`${API}/staff`).send({ ...base, fullName: 'NV hôm nay', hireDate: harness.today }).expect(201)).body;
    const b = (await ha.post(`${API}/staff`).send({ ...base, fullName: 'NV ngày mai', hireDate: tomorrow(), userId: opt.accounts[0].id }).expect(201)).body;
    const runA = (await ha.get(`${API}/runs/${a.runId}/tasks`).expect(200)).body;
    const runB = (await ha.get(`${API}/runs/${b.runId}/tasks`).expect(200)).body;
    expect(runA.run.versionCode).toBe('2.1.1');
    expect(runB.run.versionCode).toBe('2.2');
    expect(runB.tasks.find((t: { itemKey: string }) => t.itemKey === 'L1-1-1').dueDate).toBe(addDays(tomorrow(), 2));

    const inbox = (await (await as('hung')).get(`${API}/me/inbox`).expect(200)).body as InboxResponse;
    expect(inbox.upcoming.some((g) => g.staff.fullName === 'NV ngày mai')).toBe(true);
  });
});

describe('bản đã ban hành bất biến (R03, T-V06)', () => {
  it('sửa bản đã ban hành qua API bị từ chối', async () => {
    const v21 = (await list(admin)).items.find((i) => i.code === '2.1')!;
    const d = await detail(admin, v21.id);
    const res = await admin.put(`${API}/versions/${v21.id}/content`).send({ content: d.content, changeNote: 'x', rowVersion: d.version.rowVersion }).expect(409);
    expect(res.body.code).toBe('NOT_DRAFT');
    await admin.delete(`${API}/versions/${v21.id}`).expect(409);
  });

  it('trigger ở cơ sở dữ liệu chặn cả khi sửa trực tiếp bằng SQL', async () => {
    const { db, close } = createDb(process.env.DATABASE_URL!);
    try {
      expect(await dbError(() => db.execute(sql`update lotrinh.versions set content = N'{}' where code = N'2.1'`))).toMatch(/R03/);
      expect(await dbError(() => db.execute(sql`delete from lotrinh.versions where code = N'2.1'`))).toMatch(/R03/);
    } finally {
      await close();
    }
  });

  it('xuất JSON hợp lệ theo schema', async () => {
    const v22 = (await list(admin)).items.find((i) => i.code === '2.2')!;
    const res = await admin.get(`${API}/versions/${v22.id}/export`).expect(200);
    expect(res.headers['content-disposition']).toContain('lo-trinh-v2.2.json');
    expect(itemIn(VersionContentSchema.parse(res.body), 'L1-1-1').dueOffset).toBe(2);
  });
});
