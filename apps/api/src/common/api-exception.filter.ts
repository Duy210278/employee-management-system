import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { ApiErrorBody } from '@lotrinh/shared';
import type { Response } from 'express';

const DEFAULTS: Record<number, ApiErrorBody> = {
  400: { code: 'BAD_REQUEST', message: 'Dữ liệu gửi lên không hợp lệ' },
  401: { code: 'UNAUTHORIZED', message: 'Phiên đăng nhập đã hết. Đăng nhập lại.' },
  403: { code: 'FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này' },
  404: { code: 'NOT_FOUND', message: 'Không tìm thấy dữ liệu' },
  409: { code: 'CONFLICT', message: 'Dữ liệu vừa thay đổi, tải lại trang' },
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('API');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'code' in body && 'message' in body) {
        res.status(status).json({ code: body.code, message: body.message } as ApiErrorBody);
        return;
      }
      res.status(status).json(DEFAULTS[status] ?? { code: 'ERROR', message: exception.message });
      return;
    }
    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    res.status(500).json({ code: 'INTERNAL', message: 'Lỗi hệ thống. Thử lại sau, nếu vẫn lỗi hãy báo BP Đào tạo.' } as ApiErrorBody);
  }
}
