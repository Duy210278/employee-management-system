import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApiDocument } from '../src/api-docs';
import { setupApp, type TestApp } from './helpers';

let harness: TestApp;
beforeAll(async () => {
  harness = await setupApp();
});
afterAll(() => harness.close());

describe('trang tài liệu API (/api/docs)', () => {
  it('liệt kê mọi API theo nhóm tiếng Việt; body lấy từ schema Zod; thao tác ghi có tên theo nhật ký hệ thống', () => {
    const doc = buildApiDocument(harness.app);
    const ops = Object.values(doc.paths).flatMap((p) => [p.get, p.post, p.put, p.delete].filter(Boolean));
    // Bỏ đăng nhập, đăng ký, đăng nhập nhanh, tạo, nhập, duyệt tài khoản khi chuyển sang SSO (67 route)
    expect(ops.length).toBeGreaterThanOrEqual(65);
    expect(ops.every((o) => o!.tags?.length === 1)).toBe(true);

    const assign = doc.paths['/api/v1/cht/runs'].post!;
    expect(assign).toMatchObject({ tags: ['Onboarding CHT'], summary: 'Gán checklist CHT' });
    const body = (assign.requestBody as { content: Record<string, { schema: { required: string[]; properties: Record<string, unknown> } }> }).content['application/json'].schema;
    expect(body.required).toEqual(expect.arrayContaining(['userId', 'track', 'storeId', 'startDate', 'trainerId', 'qlkvId']));
    expect(body.properties.track).toMatchObject({ enum: ['cht_moi_tuyen', 'cht_thang_tien'] });

    expect(doc.paths['/api/v1/runs/{id}/sales/{month}'].put).toMatchObject({ tags: ['Doanh số'], summary: 'Nhập doanh số' });
    expect(doc.tags?.[0].name).toBe('Đăng nhập, đăng ký');
  });
});
