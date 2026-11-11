import { describe, expect, it } from 'vitest';
import { auditLabel } from '../src/modules/audit/audit.controller';

describe('đường dẫn gốc BASE_PATH', () => {
  it('nhãn nhật ký không phụ thuộc tiền tố /api/v1 hay /lo-trinh/api/v1', () => {
    expect(auditLabel('POST /api/v1/tasks/:id/confirm')).toBe('Xác nhận đầu việc');
    expect(auditLabel('POST /lo-trinh/api/v1/tasks/:id/confirm')).toBe('Xác nhận đầu việc');
    expect(auditLabel('POST /a/b/api/v1/tasks/:id/rework')).toBe('Yêu cầu làm lại');
  });
});
