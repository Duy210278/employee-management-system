import { describe, expect, it } from 'vitest';
import { inboxPriority, isAssignee } from './assignee';
import {
  decideActions,
  requiredRoles,
  statusAfterConfirmations,
  type Actor,
  type RunPeople,
  type TaskSnapshot,
} from './confirm';

// Lượt L1 của Lan: NV có tài khoản (id 10), Buddy Hùng (5), CHT Hà (3), QLKV Huy (2); BP ĐT là admin (1)
const lan: Actor = { userId: 10, role: 'nv' };
const hung: Actor = { userId: 5, role: 'nv' };
const ha: Actor = { userId: 3, role: 'cht' };
const huy: Actor = { userId: 2, role: 'qlkv' };
const admin: Actor = { userId: 1, role: 'bp' };
const people: RunPeople = { staffUserId: 10, buddyId: 5, chtId: 3, qlkvId: 2, acknowledged: true };

const buddyItem = (over: Partial<TaskSnapshot> = {}): TaskSnapshot => ({
  required: requiredRoles({ verifiers: ['buddy'], requireNvFirst: true }),
  requireNvFirst: true,
  confirmations: [],
  status: 'todo',
  gpp: false,
  allowNa: true,
  blockedBy: [],
  ...over,
});

describe('người xác nhận (mục 7.2, R04–R10)', () => {
  it('đầu việc Buddy cần phần NV + Buddy', () => {
    expect(requiredRoles({ verifiers: ['buddy'], requireNvFirst: true })).toEqual(['nv', 'buddy']);
  });

  it('T-X01: NV bấm "Tôi đã làm xong" → đang thực hiện, Buddy có nút xác nhận', () => {
    expect(decideActions(lan, people, buddyItem()).confirmAs).toEqual({ role: 'nv', proxyRole: null });
    const after = buddyItem({ status: 'doing', confirmations: [{ role: 'nv', userId: 10 }] });
    expect(statusAfterConfirmations(after.required, ['nv'], 'todo')).toBe('doing');
    expect(decideActions(hung, people, after).confirmAs).toEqual({ role: 'buddy', proxyRole: null });
    expect(decideActions(lan, people, after)).toMatchObject({ confirmAs: null, canUndo: true, waitingFor: ['buddy'] });
  });

  it('T-X02: Buddy xác nhận → đủ xác nhận, đầu việc hoàn thành', () => {
    expect(statusAfterConfirmations(['nv', 'buddy'], ['nv', 'buddy'], 'doing')).toBe('done');
  });

  it('T-X05 / R05: NV đã có tài khoản thì Buddy không có nút xác nhận phần NV', () => {
    expect(decideActions(hung, people, buddyItem()).confirmAs).toBeNull();
  });

  it('NV chưa có tài khoản: Buddy báo hoàn thành thay', () => {
    const noAccount = { ...people, staffUserId: null };
    expect(decideActions(hung, noAccount, buddyItem()).confirmAs).toEqual({ role: 'nv', proxyRole: 'buddy' });
  });

  it('yêu cầu NV báo trước: Buddy chưa xác nhận được khi NV chưa báo xong', () => {
    const item = buddyItem({ requireNvFirst: true });
    expect(decideActions(hung, people, item).confirmAs).toBeNull();
    const noNvFirst = buddyItem({ required: ['buddy'], requireNvFirst: false });
    expect(decideActions(hung, people, noNvFirst).confirmAs).toEqual({ role: 'buddy', proxyRole: null });
  });

  it('R06: CHT xác nhận thay Buddy, ghi rõ là xác nhận thay', () => {
    const after = buddyItem({ status: 'doing', confirmations: [{ role: 'nv', userId: 10 }] });
    expect(decideActions(ha, people, after).confirmAs).toEqual({ role: 'buddy', proxyRole: 'cht' });
  });

  it('T-X06: mục phối hợp L2 (CHT + QLKV), CHT đã xác nhận → hiện "Chờ QLKV"', () => {
    const l2People: RunPeople = { staffUserId: 11, buddyId: null, chtId: 3, qlkvId: 2, acknowledged: true };
    const co = buddyItem({
      required: requiredRoles({ verifiers: ['cht', 'qlkv'], requireNvFirst: true }),
      status: 'doing',
      confirmations: [
        { role: 'nv', userId: 11 },
        { role: 'cht', userId: 3 },
      ],
    });
    expect(decideActions(ha, l2People, co)).toMatchObject({ confirmAs: null, waitingFor: ['qlkv'] });
    expect(decideActions(huy, l2People, co).confirmAs).toEqual({ role: 'qlkv', proxyRole: null });
  });

  it('T-X07 / R09: mục GPP không có lựa chọn N/A; mục thường thì CHT, QLKV, BP ĐT được đánh N/A', () => {
    expect(decideActions(ha, people, buddyItem({ gpp: true, allowNa: false })).canNa).toBe(false);
    expect(decideActions(ha, people, buddyItem()).canNa).toBe(true);
    expect(decideActions(admin, people, buddyItem()).canNa).toBe(true);
    expect(decideActions(hung, people, buddyItem()).canNa).toBe(false);
  });

  it('T-X08 / R10: phụ thuộc chưa xong thì không xác nhận được', () => {
    const blocked = buddyItem({ blockedBy: ['L1-2-9'] });
    expect(decideActions(lan, people, blocked).confirmAs).toBeNull();
  });

  it('R07: chỉ CHT, QLKV, BP ĐT được yêu cầu làm lại, và chỉ khi đã có xác nhận', () => {
    const after = buddyItem({ status: 'doing', confirmations: [{ role: 'nv', userId: 10 }] });
    expect(decideActions(ha, people, buddyItem()).canRework).toBe(false);
    expect(decideActions(ha, people, after).canRework).toBe(true);
    expect(decideActions(huy, people, after).canRework).toBe(true);
    expect(decideActions(hung, people, after).canRework).toBe(false);
  });

  it('R08: mỗi người chỉ hủy được xác nhận của chính mình', () => {
    const after = buddyItem({ status: 'doing', confirmations: [{ role: 'nv', userId: 10 }] });
    expect(decideActions(lan, people, after).canUndo).toBe(true);
    expect(decideActions(hung, people, after).canUndo).toBe(false);
  });

  it('NV phải đọc Tổng quan Level trước khi báo hoàn thành (mục 9.4)', () => {
    const notRead = { ...people, acknowledged: false };
    expect(decideActions(lan, notRead, buddyItem()).confirmAs).toBeNull();
  });

  it('CHT không xác nhận vai trò QLKV, NV khác không xác nhận được gì', () => {
    const qlkvItem = buddyItem({ required: ['qlkv'], requireNvFirst: false });
    expect(decideActions(ha, people, qlkvItem).confirmAs).toBeNull();
    expect(decideActions({ userId: 99, role: 'nv' }, people, buddyItem()).confirmAs).toBeNull();
  });
});

describe('giao việc theo người (mục 10.5)', () => {
  it('việc Buddy vào hàng đợi Buddy; lượt chưa có Buddy thì vào hàng đợi CHT', () => {
    expect(isAssignee(hung, 'buddy', people)).toBe(true);
    expect(isAssignee(ha, 'buddy', people)).toBe(false);
    expect(isAssignee(ha, 'buddy', { ...people, buddyId: null })).toBe(true);
  });

  it('phần NV của NV chưa có tài khoản giao cho Buddy; việc BP ĐT giao cho mọi BP ĐT', () => {
    expect(isAssignee(hung, 'nv', { ...people, staffUserId: null })).toBe(true);
    expect(isAssignee(admin, 'bp', people)).toBe(true);
  });

  it('ưu tiên hàng đợi: chờ người này > quá hạn > đến hạn trong 7 ngày', () => {
    const today = '2026-10-17';
    const base = { myMissing: ['buddy' as const], confirmed: [], status: 'todo' as const, runStarted: true };
    expect(inboxPriority({ ...base, confirmed: ['nv'], dueDate: '2026-11-30' }, today)).toBe(0);
    expect(inboxPriority({ ...base, status: 'help', dueDate: '2026-11-30' }, today)).toBe(0);
    expect(inboxPriority({ ...base, dueDate: '2026-10-10' }, today)).toBe(1);
    expect(inboxPriority({ ...base, dueDate: '2026-10-24' }, today)).toBe(2);
    expect(inboxPriority({ ...base, dueDate: '2026-10-25' }, today)).toBeNull();
    expect(inboxPriority({ ...base, myMissing: [], dueDate: '2026-10-10' }, today)).toBeNull();
    expect(inboxPriority({ ...base, runStarted: false, dueDate: '2026-10-20' }, today)).toBe(3);
  });
});
