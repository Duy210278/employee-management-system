import {
  addDays,
  type InboxResponse,
  type ObservationsResponse,
  type ReviewResponse,
  type SalesResponse,
  type StaffProfileResponse,
} from '@lotrinh/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, setupApp, todayOf, type Agent, type TestApp } from './helpers';

let harness: TestApp;
const as = (key: string) => harness.as(key);
const runIdOf = async (key: string) => (await todayOf(await as(key))).run!.id;
const sales = async (agent: Agent, runId: number) => (await agent.get(`${API}/runs/${runId}/sales`).expect(200)).body as SalesResponse;
const obs = async (agent: Agent, runId: number) => (await agent.get(`${API}/runs/${runId}/observations`).expect(200)).body as ObservationsResponse;
const review = async (agent: Agent, runId: number) => (await agent.get(`${API}/runs/${runId}/review`).expect(200)).body as ReviewResponse;
const NOTES = { strengths: '- Tư vấn đúng 55 SKU\n- Chủ động cảnh báo an toàn thuốc', improve: '- Hỏi sâu nhu cầu hơn\n- Nắm thêm chương trình khuyến mãi' };

async function saveReview(agent: Agent, runId: number, patch: Record<string, unknown>, status = 200) {
  const r = await review(agent, runId);
  return agent
    .put(`${API}/runs/${runId}/review`)
    .send({ criteria: r.review.criteria, notes: r.review.notes, result: r.review.result, goals: r.review.goals, rowVersion: r.review.rowVersion, ...patch })
    .expect(status);
}

beforeAll(async () => {
  harness = await setupApp();
});
afterAll(() => harness.close());

describe('doanh số (mục 11.5, R15)', () => {
  it('CHT nhập doanh số; Buddy chỉ xem; L1 cần cả 2 tháng đạt; có tổng và trung bình', async () => {
    const [ha, hung] = await Promise.all([as('ha'), as('hung')]);
    const lanRun = await runIdOf('lan');
    const before = await sales(ha, lanRun);
    expect(before).toMatchObject({ months: 2, canEdit: true, kpi: { state: 'missing', rule: { method: 'all_months', windowFrom: 1, windowTo: 2 } } });
    expect((await sales(hung, lanRun)).canEdit).toBe(false);
    await hung.put(`${API}/runs/${lanRun}/sales/1`).send({ total: 30, coef1: 12 }).expect(403);

    await ha.put(`${API}/runs/${lanRun}/sales/1`).send({ total: 32, coef1: 13 }).expect(200);
    const after = (await ha.put(`${API}/runs/${lanRun}/sales/2`).send({ total: 28, coef1: 12 }).expect(200)).body as SalesResponse;
    expect(after.kpi).toMatchObject({ state: 'fail', label: 'Đạt 1/2 tháng (tháng 1–2)', sumTotal: 60, sumCoef1: 25, avgTotal: 30 });
    expect(after.rows[0]).toMatchObject({ month: 1, total: 32, enteredByName: 'Phạm Thu Hà', inWindow: true });

    const fixed = (await ha.put(`${API}/runs/${lanRun}/sales/2`).send({ total: 35, coef1: 14 }).expect(200)).body as SalesResponse;
    expect(fixed.kpi).toMatchObject({ state: 'pass', label: 'Đạt 2/2 tháng (tháng 1–2)' });
  });

  it('kiểm tra dữ liệu: HS1 không lớn hơn DS tổng, tháng ngoài Level, xóa tháng bằng cách để trống', async () => {
    const ha = await as('ha');
    const lanRun = await runIdOf('lan');
    const bad = await ha.put(`${API}/runs/${lanRun}/sales/1`).send({ total: 10, coef1: 20 }).expect(400);
    expect(bad.body.message).toBe('DS hệ số 1 không được lớn hơn DS tổng');
    await ha.put(`${API}/runs/${lanRun}/sales/3`).send({ total: 10, coef1: 5 }).expect(400);
    const cleared = (await ha.put(`${API}/runs/${lanRun}/sales/2`).send({ total: null, coef1: null }).expect(200)).body as SalesResponse;
    expect(cleared.rows[1].total).toBeNull();
  });

  it('lưu từng ô: hai lần lưu DS tổng và HS1 gửi cùng lúc không ghi đè nhau', async () => {
    const ha = await as('ha');
    const tuanRun = await runIdOf('tuan');
    await Promise.all([
      ha.put(`${API}/runs/${tuanRun}/sales/1`).send({ total: 31 }).expect(200),
      ha.put(`${API}/runs/${tuanRun}/sales/1`).send({ coef1: 12.5 }).expect(200),
    ]);
    expect((await sales(ha, tuanRun)).rows[0]).toMatchObject({ total: 31, coef1: 12.5 });
    const bad = await ha.put(`${API}/runs/${tuanRun}/sales/1`).send({ coef1: 40 }).expect(400);
    expect(bad.body.code).toBe('INVALID_SALES');
  });

  it('L2: xét trung bình 2 tháng cuối (tháng 8–9); CHT cửa hàng khác không xem được', async () => {
    const [binh, ha] = await Promise.all([as('binh'), as('ha')]);
    const namRun = await runIdOf('nam');
    const s = await sales(binh, namRun);
    expect(s.kpi).toMatchObject({ state: 'missing', rule: { method: 'average', windowFrom: 8, windowTo: 9 }, sumTotal: 325, monthsEntered: 4 });
    await ha.get(`${API}/runs/${namRun}/sales`).expect(403);
  });
});

describe('quan sát Rubric (Phụ lục C, R16)', () => {
  it('tổng hợp tỉ lệ ca đạt; ca có tiêu chí 1 điểm là chưa đạt', async () => {
    const binh = await as('binh');
    const namObs = await obs(binh, await runIdOf('nam'));
    expect(namObs.summary).toMatchObject({ count: 4, passed: 3, rate: 75, meetsTarget: false });
    expect(namObs.items.find((i) => !i.passed)).toMatchObject({ total: 13, ones: ['An toàn thuốc'] });
  });

  it('Buddy ghi được ca quan sát; BP ĐT không ghi; điểm và ngày phải hợp lệ', async () => {
    const [hung, admin] = await Promise.all([as('hung'), as('admin')]);
    const lanRun = await runIdOf('lan');
    const scores = { needs: 3, advice: 2, safety: 3, upsell: 2, closing: 2 };
    const res = (await hung.post(`${API}/runs/${lanRun}/observations`).send({ date: harness.today, scores, note: 'Ca sáng' }).expect(201)).body as ObservationsResponse;
    expect(res.summary).toMatchObject({ count: 3, passed: 2 });
    expect(res.items[0]).toMatchObject({ total: 12, passed: true, observerName: 'Trần Văn Hùng' });
    expect((await obs(admin, lanRun)).canAdd).toBe(false);
    await admin.post(`${API}/runs/${lanRun}/observations`).send({ date: harness.today, scores }).expect(403);
    await hung.post(`${API}/runs/${lanRun}/observations`).send({ date: harness.today, scores: { ...scores, safety: 4 } }).expect(400);
    await hung.post(`${API}/runs/${lanRun}/observations`).send({ date: addDays(harness.today, 1), scores }).expect(400);
  });
});

describe('phiếu đánh giá, chuỗi ký và lên Level (mục 7.4, 9.3, R12–R14)', () => {
  let linhRun: number;

  it('phiếu chỉ mở từ ngày mở giai đoạn cuối', async () => {
    const ha = await as('ha');
    const lanRun = await runIdOf('lan');
    const r = await review(ha, lanRun);
    expect(r.isOpen).toBe(false);
    const res = await saveReview(ha, lanRun, { result: 'pass', notes: NOTES }, 400);
    expect(res.body.code).toBe('REVIEW_NOT_OPEN');
  });

  it('phiếu Linh: số liệu tự động, gợi ý theo nguồn dữ liệu; Buddy L1 điền được', async () => {
    linhRun = await runIdOf('linh');
    const thao = await as('thao');
    const r = await review(thao, linhRun);
    expect(r).toMatchObject({ isOpen: true, canEdit: true, round: 0, auto: { kpi: { state: 'pass' }, rubric: { rate: 100, meetsTarget: true } } });
    expect(r.auto.checklist).toMatchObject({ done: 60, total: 60 });
    expect(r.suggestions.some((s) => s?.value === 'pass' && s.reason.startsWith('Rubric'))).toBe(true);
    expect(r.steps.map((s) => s.role)).toEqual(['cht', 'qlkv', 'bp']);
    await saveReview(thao, linhRun, { criteria: r.criteria.map(() => 'pass') });
  });

  it('R13: CHT ký khi phiếu chưa chọn kết quả và thiếu nhận xét bị chặn; R12: không ký vượt bước', async () => {
    const [binh, huy] = await Promise.all([as('binh'), as('huy')]);
    const blocked = await binh.post(`${API}/runs/${linhRun}/review/sign`).send({ step: 0 }).expect(400);
    expect(blocked.body.message).toBe('Chọn kết quả đề xuất trước khi ký');
    await saveReview(binh, linhRun, { result: 'pass', notes: NOTES });
    await huy.post(`${API}/runs/${linhRun}/review/sign`).send({ step: 1 }).expect(409);
    await huy.post(`${API}/runs/${linhRun}/review/sign`).send({ step: 0 }).expect(403);
  });

  it('CHT ký đề xuất → phiếu khóa; QLKV thấy ở "Chữ ký chờ bạn" và phê duyệt', async () => {
    const [binh, huy] = await Promise.all([as('binh'), as('huy')]);
    const signed = (await binh.post(`${API}/runs/${linhRun}/review/sign`).send({ step: 0 }).expect(200)).body as ReviewResponse;
    expect(signed).toMatchObject({ canEdit: false, review: { status: 'signing' } });
    expect(signed.steps[0]).toMatchObject({ state: 'signed', signedByName: 'Lê Văn Bình' });
    await saveReview(binh, linhRun, { notes: { ...NOTES, potential: 'sửa sau khi ký' } }, 409);

    const inbox = (await huy.get(`${API}/me/inbox`).expect(200)).body as InboxResponse;
    expect(inbox.signatures.find((s) => s.staffName === 'Hoàng Thùy Linh')).toMatchObject({ step: 1, label: 'QLKV phê duyệt' });
    await huy.post(`${API}/runs/${linhRun}/review/sign`).send({ step: 1 }).expect(200);
  });

  it('BP ĐT ký (bước cuối) → phiếu xong, Linh tự lên Level 2 từ hôm nay (V9), giữ Buddy; không còn bước NV ký nhận', async () => {
    const [admin, linh] = await Promise.all([as('admin'), as('linh')]);
    const done = (await admin.post(`${API}/runs/${linhRun}/review/sign`).send({ step: 2 }).expect(200)).body as ReviewResponse;
    expect(done.outcome).toMatch(/^Đã chuyển lên Level 2 từ /);
    expect(done.run.status).toBe('passed');
    expect(done.review.status).toBe('done');

    const today = await todayOf(linh);
    expect(today.run).toMatchObject({ levelKey: 2, dayIndex: 0, acknowledged: false, startDate: harness.today, versionCode: '2.1' });
    expect(today.reviewToSign).toBeNull();
    expect(today.tasks).toHaveLength(31);
    await linh.post(`${API}/runs/${linhRun}/review/sign`).send({ step: 3 }).expect(409);

    const profile = (await (await as('binh')).get(`${API}/staff/${today.staff!.id}`).expect(200)).body as StaffProfileResponse;
    expect(profile).toMatchObject({ staff: { currentLevel: 2 }, people: { buddy: 'Đỗ Thị Thảo', cht: 'Lê Văn Bình' } });
    expect(profile.history.map((h) => [h.levelKey, h.status])).toEqual([
      [2, 'active'],
      [1, 'passed'],
    ]);
    expect(profile.path.map((p) => p.state)).toEqual(['past', 'current', 'future', 'future']);
  });

  it('gia hạn (R14): cần mục tiêu; sau khi BP ĐT ký, lượt kéo dài 1 tháng và mở vòng phiếu mới', async () => {
    const [admin, binh, huy] = await Promise.all([as('admin'), as('binh'), as('huy')]);
    await harness.shiftDays(50);
    try {
      const namRun = await runIdOf('nam');
      const before = await review(binh, namRun);
      expect(before.isOpen).toBe(true);
      await saveReview(binh, namRun, { result: 'extend', notes: NOTES });
      expect((await review(binh, namRun)).problems).toEqual(['Ghi mục tiêu cần đạt trong thời gian gia hạn']);
      await saveReview(binh, namRun, { goals: '- DS TB 2 tháng cuối ≥ 100tr\n- Rubric ≥ 80%' });
      await binh.post(`${API}/runs/${namRun}/review/sign`).send({ step: 0 }).expect(200);
      await huy.post(`${API}/runs/${namRun}/review/sign`).send({ step: 1 }).expect(200);
      const extended = (await admin.post(`${API}/runs/${namRun}/review/sign`).send({ step: 2 }).expect(200)).body as ReviewResponse;
      expect(extended).toMatchObject({ round: 1, extCount: 1, review: { id: null, status: 'draft' }, history: [{ round: 0, result: 'extend' }] });
      expect(extended.run).toMatchObject({ status: 'active', plannedEnd: addDays(before.run.plannedEnd, 30) });
    } finally {
      await harness.resetClock();
    }
  });
});
