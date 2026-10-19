import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { classifyChanges, proposeVersionCode } from '../change-kind/classify';
import { VersionContentSchema, type VersionContent } from '../schemas/version';
import { countIssues, validateChecklist } from './checklist';
import { validateFramework, validateVersion } from './framework';

const seed = VersionContentSchema.parse(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../seed/v2.1.json'), 'utf8')));
let draft: VersionContent;
const l1 = () => draft.levels[0];
const item = (key: string) => draft.levels.flatMap((l) => l.stages.flatMap((s) => s.items)).find((i) => i.key === key)!;
const codes = (c: VersionContent) => validateChecklist(c).map((i) => i.code);

beforeEach(() => {
  draft = structuredClone(seed);
});

describe('kiểm tra hợp lệ checklist (mục 7.7)', () => {
  it('bộ v2.1 không có lỗi chặn ban hành', () => {
    expect(countIssues(validateChecklist(seed)).errors).toBe(0);
  });

  it('CK-01: Level không có giai đoạn', () => {
    l1().stages = [];
    expect(codes(draft)).toContain('CK-01');
  });

  it('CK-02 chồng nhau, CK-03 hở ngày, CK-04 vượt thời gian Level', () => {
    l1().stages[1].offsetStart = 5;
    expect(codes(draft)).toContain('CK-02');
    draft = structuredClone(seed);
    l1().stages[1].offsetStart = 8;
    l1().stages[1].items.forEach((i) => (i.dueOffset = Math.max(i.dueOffset, 8)));
    expect(validateChecklist(draft).find((i) => i.code === 'CK-03')?.level).toBe('warning');
    draft = structuredClone(seed);
    l1().stages.at(-1)!.offsetEnd = 65;
    expect(codes(draft)).toContain('CK-04');
  });

  it('CK-05: hạn nằm ngoài giai đoạn, kèm vị trí để cuộn tới', () => {
    item('L1-1-1').dueOffset = 20;
    expect(validateChecklist(draft).find((i) => i.code === 'CK-05')).toMatchObject({
      level: 'error',
      at: { levelKey: 1, stageKey: 'L1-S1', itemKey: 'L1-1-1', field: 'dueOffset' },
    });
  });

  it('CK-06: thiếu nội dung, thiếu người xác nhận, trùng mã, sai dạng mã', () => {
    item('L1-1-2').content = ' ';
    item('L1-1-3').verifiers = [];
    item('L1-1-4').key = 'L1-1-1';
    l1().stages[0].items.push({ ...item('L1-1-5'), key: 'L2-1-99' });
    const ck06 = validateChecklist(draft).filter((i) => i.code === 'CK-06');
    expect(ck06.map((i) => i.at.field)).toEqual(expect.arrayContaining(['content', 'verifiers', 'key']));
    expect(ck06.some((i) => i.message.includes('không đúng dạng'))).toBe(true);
  });

  it('CK-07: mục GPP được phép N/A', () => {
    item('L1-1-5').allowNa = true;
    expect(codes(draft)).toContain('CK-07');
  });

  it('CK-08: phụ thuộc mã không tồn tại hoặc mục ở giai đoạn sau', () => {
    item('L1-1-1').dependsOn = ['L1-9-9'];
    item('L1-1-2').dependsOn = ['L1-2-1'];
    expect(validateChecklist(draft).filter((i) => i.code === 'CK-08')).toHaveLength(2);
    draft = structuredClone(seed);
    item('L1-2-1').dependsOn = ['L1-1-1'];
    expect(codes(draft)).not.toContain('CK-08');
  });

  it('CK-09, CK-10: nhắc tháng ngoài thời gian Level, bài thu hoạch sai Level (lưu ý)', () => {
    item('L1-6-3').content = 'Đạt tỉ lệ tuân thủ trong Tháng 3';
    item('L1-6-4').content = 'Hoàn thành bài thu hoạch SKU Level 2';
    const warn = validateChecklist(draft).filter((i) => i.level === 'warning').map((i) => i.code);
    expect(warn).toEqual(expect.arrayContaining(['CK-09', 'CK-10']));
  });

  it('CK-11: giai đoạn không có chuỗi ký', () => {
    l1().stages[0].signers = [];
    expect(codes(draft)).toContain('CK-11');
  });
});

describe('kiểm tra hợp lệ Khung năng lực (mục 6.2)', () => {
  const kcodes = (c: VersionContent) => validateFramework(c).map((i) => i.code);

  it('bộ v2.1 không có lỗi Khung năng lực', () => {
    expect(countIssues(validateFramework(seed)).errors).toBe(0);
    expect(countIssues(validateVersion(seed)).errors).toBe(0);
  });

  it('KNL-03: cửa sổ KPI ngoài thời gian Level; KNL-04: HS1 lớn hơn DS tổng; KNL-05: tỉ trọng khai báo lệch', () => {
    draft.levels[1].kpi.windowTo = 12;
    draft.levels[0].kpi.coef1 = 40;
    draft.levels[2].kpi.ratio = 30;
    const issues = validateFramework(draft);
    expect(issues.find((i) => i.code === 'KNL-03')).toMatchObject({ level: 'error', at: { levelKey: 2, section: 'kpi' } });
    expect(kcodes(draft)).toContain('KNL-04');
    expect(issues.find((i) => i.code === 'KNL-05')?.level).toBe('warning');
  });

  it('KNL-06: ngưỡng Rubric vượt tổng điểm, mã tiêu chí trùng', () => {
    draft.rubric!.passTotal = 16;
    draft.rubric!.criteria[1].key = draft.rubric!.criteria[0].key;
    expect(validateFramework(draft).filter((i) => i.code === 'KNL-06')).toHaveLength(2);
  });

  it('KNL-10: phiếu không có bước ký; CK-12: tiêu chí phiếu thiếu ngưỡng', () => {
    draft.levels[0].review!.signers = [];
    draft.levels[0].reviewCriteria[0].threshold = '';
    expect(kcodes(draft)).toEqual(expect.arrayContaining(['KNL-10', 'CK-12']));
  });
});

describe('phân loại thay đổi và số phiên bản (mục 8.3)', () => {
  it('chưa sửa gì thì không có thay đổi', () => {
    expect(classifyChanges(seed, draft)).toMatchObject({ kind: null, criteria: 0, text: 0 });
  });

  it('T-V01: chỉ sửa hướng dẫn một mục → sửa diễn đạt, đề xuất 2.1.1', () => {
    item('L1-1-1').guidance = 'Chuẩn bị đồng phục, thẻ tên trước ngày đầu.';
    expect(classifyChanges(seed, draft)).toMatchObject({ kind: 'text', criteria: 0, text: 1 });
    expect(proposeVersionCode('2.1', 'text', ['2.1'])).toBe('2.1.1');
    expect(proposeVersionCode('2.1', 'text', ['2.1', '2.1.1'])).toBe('2.1.2');
  });

  it('đổi thứ tự trong giai đoạn, tên giai đoạn → vẫn là sửa diễn đạt', () => {
    const items = l1().stages[0].items;
    [items[0].order, items[1].order] = [items[1].order, items[0].order];
    l1().stages[0].name = 'Định hướng ngày đầu';
    expect(classifyChanges(seed, draft).kind).toBe('text');
  });

  it('T-V02: đổi hạn một mục → thay đổi tiêu chí, đề xuất 2.2', () => {
    item('L1-1-1').dueOffset = 2;
    const summary = classifyChanges(seed, draft);
    expect(summary).toMatchObject({ kind: 'criteria', criteria: 1 });
    expect(summary.changes[0].label).toBe('L1-1-1: đổi hạn');
    expect(proposeVersionCode('2.1', 'criteria', ['2.1', '2.1.1'])).toBe('2.2');
    expect(proposeVersionCode('2.1', 'criteria', ['2.1', '2.2', '2.3'])).toBe('2.4');
  });

  it('thêm, bỏ, chuyển giai đoạn, đổi người xác nhận, đổi tham số lịch → tiêu chí', () => {
    item('L1-1-1').verifiers = ['buddy', 'cht'];
    const moved = l1().stages[0].items.pop()!;
    moved.dueOffset = 10;
    l1().stages[1].items.push(moved);
    l1().stages[2].items.shift();
    l1().stages[2].items.push({ ...l1().stages[2].items[0], key: 'L1-3-99' });
    draft.scheduleParams.remindDays = 2;
    const labels = classifyChanges(seed, draft).changes.filter((c) => c.kind === 'criteria').map((c) => c.label);
    expect(labels).toEqual(
      expect.arrayContaining(['L1-1-1: đổi người xác nhận', `${moved.key}: chuyển sang giai đoạn khác`, 'Thêm đầu việc L1-3-99', 'Đổi tham số lịch remindDays']),
    );
    expect(labels.some((l) => l.startsWith('Bỏ đầu việc'))).toBe(true);
  });
});
