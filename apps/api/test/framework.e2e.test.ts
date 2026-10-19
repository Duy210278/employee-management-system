import type { FrameworkResponse, VersionContent, VersionDetailResponse, VersionListResponse } from '@lotrinh/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, setupApp, type Agent, type TestApp } from './helpers';

let harness: TestApp;
let admin: Agent;
let draftId: number;
const as = (key: string) => harness.as(key);
const detail = async (agent: Agent, id: number) => (await agent.get(`${API}/versions/${id}`).expect(200)).body as VersionDetailResponse;

async function edit(agent: Agent, id: number, mutate: (c: VersionContent) => void, changeNote = 'Cập nhật Khung năng lực', status = 200) {
  const d = await detail(admin, id);
  const content = structuredClone(d.content);
  mutate(content);
  return agent.put(`${API}/versions/${id}/content`).send({ content, changeNote, rowVersion: d.version.rowVersion }).expect(status);
}

beforeAll(async () => {
  harness = await setupApp();
  admin = await as('admin');
  draftId = ((await admin.get(`${API}/versions`).expect(200)).body as VersionListResponse).items.find((i) => i.state === 'draft')!.id;
});
afterAll(() => harness.close());

describe('Khung năng lực chỉ xem (mục 4.3)', () => {
  it('ai đăng nhập cũng xem được Khung năng lực đang hiệu lực', async () => {
    for (const key of ['ha', 'huy', 'lan']) {
      const fw = (await (await as(key)).get(`${API}/framework`).expect(200)).body as FrameworkResponse;
      expect(fw).toMatchObject({ versionCode: '2.1' });
      expect(fw.levels.map((l) => [l.key, l.itemCount])).toEqual([
        [1, 60],
        [2, 31],
        [3, 24],
        [4, 23],
      ]);
      expect(fw.rubric.criteria).toHaveLength(5);
      expect(fw.levels[0].overview.goals.length).toBeGreaterThan(0);
    }
  });
});

describe('chỉ BP Đào tạo sửa Khung năng lực', () => {
  it('QLKV, CHT không sửa được bản nháp; BP ĐT sửa được mục tiêu Level', async () => {
    const [huy, ha] = await Promise.all([as('huy'), as('ha')]);
    await edit(huy, draftId, (c) => (c.levels[0].overview.goals[0].body = 'x'), 'x', 403);
    await edit(ha, draftId, (c) => (c.levels[0].overview.goals[0].body = 'x'), 'x', 403);
    await edit(admin, draftId, (c) => (c.levels[0].overview.goals[0].body = 'Thực hiện đúng 100% bước mở ca, đóng ca theo SOP.'));
    expect((await detail(admin, draftId)).content.levels[0].overview.goals[0].body).toBe('Thực hiện đúng 100% bước mở ca, đóng ca theo SOP.');
  });

  it('lỗi Khung năng lực (KNL-04: HS1 lớn hơn DS tổng) chặn gửi duyệt', async () => {
    await edit(admin, draftId, (c) => (c.levels[0].kpi.coef1 = 50));
    const res = await admin.post(`${API}/versions/${draftId}/submit`).send({}).expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    await edit(admin, draftId, (c) => (c.levels[0].kpi.coef1 = 12));
  });
});

describe('BP Đào tạo tự ban hành (V20)', () => {
  it('chỉ BP ĐT xem và đổi được cấu hình', async () => {
    const ha = await as('ha');
    await ha.get(`${API}/settings/publishing`).expect(403);
    await ha.put(`${API}/settings/publishing`).send({ bpSelfPublish: true }).expect(403);
    expect((await admin.get(`${API}/settings/publishing`).expect(200)).body).toEqual({ bpSelfPublish: false });
  });

  it('tắt: BP ĐT không tự duyệt được; bật: BP ĐT tự duyệt và ban hành', async () => {
    await admin.post(`${API}/versions/${draftId}/submit`).send({}).expect(200);
    await admin.post(`${API}/versions/${draftId}/approve`).send({ effectiveFrom: harness.today }).expect(403);

    await admin.put(`${API}/settings/publishing`).send({ bpSelfPublish: true }).expect(200);
    const list = (await (await as('admin')).get(`${API}/versions`).expect(200)).body as VersionListResponse;
    expect(list.canApprove).toBe(true);
    const approved = (await admin.post(`${API}/versions/${draftId}/approve`).send({ effectiveFrom: harness.today }).expect(200)).body as VersionDetailResponse;
    expect(approved.version).toMatchObject({ code: '2.2', state: 'current', approvedByName: 'Ngô Quốc Bảo' });
    await admin.put(`${API}/settings/publishing`).send({ bpSelfPublish: false }).expect(200);
  });
});
