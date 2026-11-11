import type { INestApplication, Type } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { ModulesContainer } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { SESSION_COOKIE } from './common/session';
import { ZodPipe } from './common/zod.pipe';
import { auditLabel } from './modules/audit/audit.controller';
import { apiPrefix } from './config';

/** Nhóm API theo controller, theo thứ tự hiển thị */
const TAGS: [controller: string, tag: string][] = [
  ['AuthController', 'Đăng nhập, đăng ký'],
  ['MeController', 'Của tôi: Hôm nay, Việc cần xử lý, thông báo'],
  ['StaffController', 'Nhân sự'],
  ['RunsController', 'Lượt Level, checklist, phân công'],
  ['TasksController', 'Đầu việc'],
  ['SalesController', 'Doanh số'],
  ['ObservationsController', 'Quan sát Rubric'],
  ['ReviewsController', 'Phiếu đánh giá, lên Level'],
  ['ChtController', 'Onboarding CHT'],
  ['AlertsController', 'Cảnh báo'],
  ['NotificationsController', 'Thông báo'],
  ['VersionsController', 'Phiên bản Bộ lộ trình'],
  ['FrameworkController', 'Khung năng lực, cấu hình ban hành'],
  ['UsersController', 'Tài khoản'],
  ['OrgController', 'Cửa hàng, khu vực'],
  ['ReportsController', 'Xuất CSV'],
  ['AuditController', 'Nhật ký hệ thống'],
  ['DemoController', 'Công cụ demo'],
  ['HealthController', 'Hệ thống'],
];
const METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const;
/** Kiểu generic của zodToJsonSchema lồng quá sâu với ZodTypeAny (TS2589): gọi qua chữ ký đơn giản */
const toJsonSchema = zodToJsonSchema as unknown as (schema: ZodTypeAny, options: { target: 'openApi3'; $refStrategy: 'none' }) => SchemaObject;

const DESCRIPTION = `API của bản demo, tiền tố \`/api/v1\`. Lỗi trả về dạng \`{ "code": "...", "message": "..." }\`.

**Đăng nhập trước khi thử:** mở nhóm *Đăng nhập, đăng ký* → \`POST /api/v1/auth/login\` → *Try it out*, gửi
\`{ "email": "admin@upharma.local", "password": "Demo@123" }\`. Trình duyệt lưu cookie \`${SESSION_COOKIE}\`, các lệnh sau chạy bằng phiên đó.
Đổi người dùng nhanh (DEMO_MODE): lấy \`id\` ở \`GET /api/v1/demo/accounts\` rồi gọi \`POST /api/v1/demo/login-as\`.

Cấu trúc body lấy từ schema Zod dùng chung (\`packages/shared/src/schemas\`), cùng schema máy chủ dùng để kiểm tra dữ liệu.`;

/** Schema Zod của body từng thao tác, khóa là operationId mặc định của Swagger: `${Controller}_${phương thức}` */
function zodBodies(app: INestApplication): Map<string, ZodTypeAny> {
  const bodies = new Map<string, ZodTypeAny>();
  for (const mod of app.get(ModulesContainer).values()) {
    for (const wrapper of mod.controllers.values()) {
      const ctrl = wrapper.metatype as Type | null;
      if (!ctrl) continue;
      for (const method of Object.getOwnPropertyNames(ctrl.prototype)) {
        const args: Record<string, { pipes?: unknown[] }> = Reflect.getMetadata(ROUTE_ARGS_METADATA, ctrl, method) ?? {};
        for (const [key, arg] of Object.entries(args)) {
          if (Number(key.split(':')[0]) !== RouteParamtypes.BODY) continue;
          const pipe = arg.pipes?.find((p): p is ZodPipe<ZodTypeAny> => p instanceof ZodPipe);
          if (pipe) bodies.set(`${ctrl.name}_${method}`, pipe.schema);
        }
      }
    }
  }
  return bodies;
}

/** Tài liệu OpenAPI của mọi controller: nhóm tiếng Việt, tên thao tác ghi dữ liệu theo nhãn nhật ký hệ thống, body từ schema Zod */
export function buildApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder().setTitle('Lộ trình Upharma API').setDescription(DESCRIPTION).setVersion('v1').build();
  const doc = SwaggerModule.createDocument(app, config);
  const bodies = zodBodies(app);
  const tagOf = new Map(TAGS);
  const used = new Set<string>();

  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of METHODS) {
      const op = item[method];
      if (!op) continue;
      const controller = op.operationId?.split('_')[0] ?? '';
      const tag = tagOf.get(controller) ?? controller.replace(/Controller$/, '');
      op.tags = [tag];
      used.add(tag);
      const action = `${method.toUpperCase()} ${path.replace(/\{(\w+)\}/g, ':$1')}`;
      const label = auditLabel(action);
      if (label !== action) op.summary = label;
      const schema = op.operationId ? bodies.get(op.operationId) : undefined;
      if (schema) {
        op.requestBody = {
          required: true,
          content: { 'application/json': { schema: toJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' }) } },
        };
      }
    }
  }
  const order = TAGS.map(([, t]) => t);
  const rank = (t: string) => (order.includes(t) ? order.indexOf(t) : order.length);
  doc.tags = [...used].sort((a, b) => rank(a) - rank(b)).map((name) => ({ name }));
  return doc;
}

/** Trang Swagger ở /api/docs (JSON ở /api/docs/json); gọi trước app.listen */
export function setupApiDocs(app: INestApplication): void {
  const docs = apiPrefix().replace(/v1$/, 'docs');
  SwaggerModule.setup(docs, app, buildApiDocument(app), {
    jsonDocumentUrl: `${docs}/json`,
    customSiteTitle: 'API · Lộ trình Upharma',
    swaggerOptions: { docExpansion: 'none', filter: true, displayRequestDuration: true, tryItOutEnabled: true },
  });
}
