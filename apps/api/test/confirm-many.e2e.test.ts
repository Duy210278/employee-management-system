import type { ConfirmManyResult, NotificationsResponse, TaskView } from '@lotrinh/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, runTasks, setupApp, todayOf, type Agent, type TestApp } from './helpers';

let harness: TestApp;
const isBuddyItem = (x: TaskView) => x.requiredRoles.join() === 'nv,buddy';
const pick = (tasks: TaskView[]) => tasks.map((t) => ({ id: t.id, rowVersion: t.rowVersion }));

beforeAll(async () => {
  harness = await setupApp();
});

afterAll(() => harness.close());

describe('duyệt nhanh nhiều đầu việc', () => {
  let tuan: Agent;
  let hung: Agent;
  let runId: number;
  let reported: TaskView[];

  beforeAll(async () => {
    [tuan, hung] = await Promise.all([harness.as('tuan'), harness.as('hung')]);
    runId = (await todayOf(tuan)).run!.id;
  });

  it('danh sách rỗng bị chặn', async () => {
    const res = await tuan.post(`${API}/tasks/confirm-many`).send({ tasks: [] }).expect(400);
    expect(res.body.message).toContain('Chọn ít nhất một đầu việc');
  });

  it('NV báo xong nhiều mục một lần; Buddy nhận một thông báo gom các mục', async () => {
    const before = ((await hung.get(`${API}/me/notifications`).expect(200)).body as NotificationsResponse).items.length;
    reported = (await todayOf(tuan)).tasks.filter((t) => isBuddyItem(t) && t.actions.confirmAs?.role === 'nv').slice(0, 3);
    expect(reported).toHaveLength(3);

    const res = (await tuan.post(`${API}/tasks/confirm-many`).send({ tasks: pick(reported) }).expect(200)).body as ConfirmManyResult;
    expect(res).toEqual({ confirmed: 3, failed: [] });
    const after = (await todayOf(tuan)).tasks.filter((t) => reported.some((r) => r.id === t.id));
    expect(after.every((t) => t.status === 'doing' && t.confirmations.map((c) => c.role).join() === 'nv')).toBe(true);

    const inbox = ((await hung.get(`${API}/me/notifications`).expect(200)).body as NotificationsResponse).items;
    expect(inbox.length).toBe(before + 1);
    expect(inbox[0]).toMatchObject({ type: 'report_done', title: 'Phạm Minh Tuấn đã báo xong 3 mục, chờ bạn xác nhận' });
  });

  it('Buddy duyệt nhanh: mục đủ điều kiện thành Xong; mục chưa đến lượt, dữ liệu cũ báo lý do riêng, không chặn mục khác', async () => {
    const tasks = (await runTasks(hung, runId)).tasks;
    const ready = tasks.filter((t) => reported.some((r) => r.id === t.id));
    expect(ready.every((t) => t.actions.confirmAs?.role === 'buddy')).toBe(true);
    const notYet = tasks.find((t) => isBuddyItem(t) && t.status === 'todo')!;
    const [first, ...rest] = ready;

    const res = (
      await hung
        .post(`${API}/tasks/confirm-many`)
        .send({ tasks: [{ id: first.id, rowVersion: first.rowVersion - 1 }, ...pick(rest), ...pick([notYet])] })
        .expect(200)
    ).body as ConfirmManyResult;
    expect(res.confirmed).toBe(2);
    expect(res.failed).toEqual([
      { id: first.id, itemKey: first.itemKey, message: expect.stringContaining('người khác cập nhật') },
      { id: notYet.id, itemKey: notYet.itemKey, message: 'Chờ nhân viên báo hoàn thành trước khi xác nhận' },
    ]);

    const after = (await runTasks(hung, runId)).tasks;
    for (const t of rest) expect(after.find((x) => x.id === t.id)).toMatchObject({ status: 'done', doneDate: harness.today });
    expect(after.find((x) => x.id === first.id)!.status).toBe('doing');
  });

  it('người ngoài phạm vi duyệt nhanh bị báo lỗi từng mục, không ghi gì', async () => {
    const binh = await harness.as('binh');
    const task = (await runTasks(hung, runId)).tasks.find((t) => t.status === 'doing')!;
    const res = (await binh.post(`${API}/tasks/confirm-many`).send({ tasks: pick([task]) }).expect(200)).body as ConfirmManyResult;
    expect(res).toEqual({ confirmed: 0, failed: [{ id: task.id, itemKey: task.itemKey, message: 'Hồ sơ này nằm ngoài phạm vi dữ liệu của bạn' }] });
  });
});
