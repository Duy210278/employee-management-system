import { PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';
import { badRequest } from './errors';

/** Kiểm tra body bằng schema Zod dùng chung trong @lotrinh/shared */
export class ZodPipe<T extends ZodTypeAny> implements PipeTransform<unknown, z.infer<T>> {
  /** Công khai để trang /api/docs lấy cấu trúc body */
  constructor(readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw badRequest('VALIDATION', result.error.issues[0]?.message ?? 'Dữ liệu gửi lên không hợp lệ');
    }
    return result.data;
  }
}
