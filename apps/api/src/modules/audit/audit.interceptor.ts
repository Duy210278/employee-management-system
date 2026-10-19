import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { tap, type Observable } from 'rxjs';
import { AuditService } from './audit.service';

const SECRET_FIELDS = new Set(['password', 'newPassword', 'token']);

/** Ghi audit_logs cho mọi thao tác thay đổi dữ liệu thành công của người đã đăng nhập (mục 5.7, 17) */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    // Đánh dấu đã đọc thông báo không phải thay đổi dữ liệu nghiệp vụ
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path.endsWith('/me/notifications/read')) return next.handle();
    return next.handle().pipe(
      tap(() => {
        if (!req.user) return;
        const path: string = req.route?.path ?? req.path;
        const entity = path.replace(/^\/?api\/v1\//, '').split('/')[0] || null;
        const body = typeof req.body === 'object' && req.body ? Object.fromEntries(Object.entries(req.body).filter(([k]) => !SECRET_FIELDS.has(k))) : null;
        void this.audit.log({
          userId: req.user.id,
          action: `${req.method} ${path}`,
          entity,
          entityId: typeof req.params?.id === 'string' ? req.params.id : null,
          payload: body,
          ip: req.ip,
        });
      }),
    );
  }
}
