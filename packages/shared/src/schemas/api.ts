import { z } from 'zod';
import { isIsoDate } from '../dates';
import { ACCOUNT_ROLES, ASSIGNMENT_ROLES, TASK_ROLES } from '../roles';
import { CHT_TRACKS, VersionContentSchema } from './version';

/** Dữ liệu vào của API, dùng chung cho form giao diện và kiểm tra ở server. */

const rowVersion = z.number({ required_error: 'Thiếu rowVersion' }).int().min(0);
const note = z.string().trim().max(1000, 'Ghi chú tối đa 1000 ký tự');

export const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  password: z.string().min(1, 'Nhập mật khẩu'),
});

export const LoginAsBody = z.object({ userId: z.number().int().positive() });

export const ConfirmBody = z.object({
  role: z.enum(TASK_ROLES).optional(),
  note: note.optional(),
  rowVersion,
});

/** Duyệt nhanh: xác nhận phần của người gọi ở nhiều đầu việc một lần, mục nào không xác nhận được thì báo lý do riêng */
export const ConfirmManyBody = z.object({
  tasks: z
    .array(z.object({ id: z.number().int().positive(), rowVersion }))
    .min(1, 'Chọn ít nhất một đầu việc')
    .max(100, 'Mỗi lần duyệt tối đa 100 đầu việc'),
  note: note.optional(),
});

export const UndoBody = z.object({ rowVersion });

export const ReworkBody = z.object({
  note: note.min(1, 'Nhập lý do vào ô ghi chú trước khi yêu cầu làm lại'),
  rowVersion,
});

export const StatusBody = z.object({
  status: z.enum(['todo', 'doing', 'help', 'na']),
  note: note.optional(),
  rowVersion,
});

const isoDate = z.string({ required_error: 'Chọn ngày' }).refine(isIsoDate, 'Ngày phải có dạng YYYY-MM-DD');
const personId = (message: string) => z.number({ required_error: message, invalid_type_error: message }).int().positive(message);

/** Tạo hồ sơ NV và bắt đầu lượt Level (mục 9.1, 9.2) */
export const CreateStaffBody = z
  .object({
    fullName: z.string().trim().min(1, 'Nhập họ tên'),
    employeeCode: z.string().trim().max(30).optional(),
    storeId: personId('Chọn cửa hàng'),
    hireDate: isoDate,
    levelKey: z.number().int().min(1).max(4),
    /** Bỏ trống với Level 1: ngày bắt đầu = ngày nhận việc (mục 10.1) */
    startDate: isoDate.optional(),
    userId: z.number().int().positive().nullable().optional(),
    buddyId: z.number().int().positive().nullable().optional(),
    chtId: personId('Chọn Cửa hàng trưởng'),
    qlkvId: personId('Chọn QLKV'),
  })
  .superRefine((b, ctx) => {
    if (b.levelKey <= 2 && !b.buddyId) ctx.addIssue({ code: 'custom', path: ['buddyId'], message: 'Level 1–2 bắt buộc có Buddy' });
    if (b.levelKey > 1 && !b.startDate) ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Nhập ngày bắt đầu Level hiện tại' });
  });

export type CreateStaffBodyT = z.infer<typeof CreateStaffBody>;

/** Vòng đời phiên bản (mục 8.2) */
export const CreateDraftBody = z.object({ fromId: z.number().int().positive() });
export const SaveDraftBody = z.object({
  content: VersionContentSchema,
  changeNote: z.string().max(2000).default(''),
  rowVersion,
});
export const SubmitBody = z.object({ changeNote: z.string().trim().max(2000).optional() });
export const ApproveBody = z.object({ effectiveFrom: isoDate });
/** Đổi ngày hiệu lực của bản đã duyệt nhưng chưa tới ngày */
export const RescheduleBody = ApproveBody;

/**
 * Doanh số tháng, triệu đồng. Chỉ gửi ô vừa sửa (ô không gửi giữ nguyên) để hai lần lưu liên tiếp không ghi đè nhau;
 * null là xóa ô đó, cả hai ô trống là xóa số liệu tháng.
 */
const money = z.number({ invalid_type_error: 'Doanh số phải là số' }).min(0, 'Doanh số không được âm').max(1_000_000).nullable().optional();
export const SalesBody = z
  .object({ total: money, coef1: money })
  .refine((b) => b.total === undefined || b.total === null || b.coef1 === undefined || b.coef1 === null || b.coef1 <= b.total, 'DS hệ số 1 không được lớn hơn DS tổng')
  .refine((b) => b.total !== undefined || b.coef1 !== undefined, 'Cần ít nhất một ô doanh số');

/** Một ca quan sát Rubric (mục 11.5) */
export const ObservationBody = z.object({
  date: isoDate,
  scores: z.record(z.string(), z.number().int().min(1).max(10)),
  note: z.string().trim().max(2000).default(''),
});

/** Lưu phiếu đánh giá (bản điền, chưa ký) */
export const SaveReviewBody = z.object({
  criteria: z.array(z.enum(['', 'pass', 'fail'])),
  notes: z.record(z.string(), z.string().max(4000)),
  result: z.enum(['pass', 'extend', 'fail']).nullable(),
  goals: z.string().max(2000).default(''),
  /** null khi phiếu chưa được lưu lần nào */
  rowVersion: z.number().int().min(0).nullable(),
});
export const SignReviewBody = z.object({ step: z.number().int().min(0) });

// ---------- Quản trị người dùng (mục 5) ----------

const email = z.string().trim().toLowerCase().email('Email không hợp lệ');
const fullName = z.string().trim().min(2, 'Nhập họ tên').max(100);
const employeeCode = z.string().trim().max(30, 'Mã nhân viên tối đa 30 ký tự');
const phone = z
  .string()
  .trim()
  .max(20)
  .regex(/^[0-9+ .-]*$/, 'Số điện thoại chỉ gồm chữ số')
  .default('');
const password = z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(100);
const id = z.number().int().positive();

/** Đăng ký tài khoản (mục 5.1): vai trò, nhà thuốc, khu vực chỉ là đề nghị; BP ĐT chốt khi duyệt */
export const RegisterBody = z
  .object({
    fullName,
    employeeCode: employeeCode.min(1, 'Nhập mã nhân viên'),
    email,
    phone,
    password,
    requestedRole: z.enum(['nv', 'cht', 'qlkv'], { errorMap: () => ({ message: 'Chọn vai trò đề nghị' }) }),
    storeId: id.nullable().optional(),
    areaId: id.nullable().optional(),
  })
  .superRefine((b, ctx) => {
    if (b.requestedRole !== 'qlkv' && !b.storeId) ctx.addIssue({ code: 'custom', path: ['storeId'], message: 'Chọn nhà thuốc đang làm việc' });
    if (b.requestedRole === 'qlkv' && !b.areaId) ctx.addIssue({ code: 'custom', path: ['areaId'], message: 'Chọn khu vực phụ trách' });
  });

const scopeFields = {
  role: z.enum(ACCOUNT_ROLES),
  storeIds: z.array(id).default([]),
  areaIds: z.array(id).default([]),
  canBuddy: z.boolean().default(false),
};

/** Mục 5.3: CHT bắt buộc ≥ 1 cửa hàng; QLKV bắt buộc ≥ 1 khu vực */
function scopeRule(b: { role: string; storeIds: number[]; areaIds: number[] }, ctx: z.RefinementCtx) {
  if (b.role === 'cht' && !b.storeIds.length) ctx.addIssue({ code: 'custom', path: ['storeIds'], message: 'Cửa hàng trưởng phải được gán ít nhất 1 cửa hàng' });
  if (b.role === 'qlkv' && !b.areaIds.length) ctx.addIssue({ code: 'custom', path: ['areaIds'], message: 'QLKV phải được gán ít nhất 1 khu vực' });
}

export const ApproveUserBody = z.object(scopeFields).superRefine(scopeRule);
export const RejectUserBody = z.object({ note: z.string().trim().min(1, 'Nhập lý do từ chối').max(1000) });

/** Người thay cho một phân công khi khóa, cho nghỉ hoặc đổi vai trò tài khoản (mục 5.4 điều 3, R20) */
export const HandoverItem = z.object({ runId: id, role: z.enum(ASSIGNMENT_ROLES), userId: id });

export const UpdateUserBody = z
  .object({
    fullName,
    employeeCode: employeeCode.nullable(),
    phone,
    ...scopeFields,
    status: z.enum(['active', 'locked', 'left']),
    rowVersion,
    handover: z.array(HandoverItem).default([]),
  })
  .superRefine(scopeRule);

export const CreateUserBody = z
  .object({ fullName, employeeCode: employeeCode.nullable().default(null), email, phone, password, ...scopeFields })
  .superRefine(scopeRule);

/** Nhập tài khoản hàng loạt (mục 5.6): commit = false chỉ xem trước */
export const ImportUsersBody = z.object({ csv: z.string().min(1, 'Chọn tệp CSV').max(500_000, 'Tệp quá lớn'), commit: z.boolean().default(false) });

export const AreaBody = z.object({
  code: z.string().trim().min(1, 'Nhập mã khu vực').max(20),
  name: z.string().trim().min(1, 'Nhập tên khu vực').max(100),
  active: z.boolean().default(true),
});
export const StoreBody = z.object({
  code: z.string().trim().min(1, 'Nhập mã cửa hàng').max(20),
  name: z.string().trim().min(1, 'Nhập tên cửa hàng').max(100),
  address: z.string().trim().max(200).default(''),
  areaId: id,
  active: z.boolean().default(true),
});

// ---------- Vận hành lượt Level (mục 9.3, 10.2) ----------

export const StageSignBody = z.object({ step: z.number().int().min(0) });

export const PauseBody = z
  .object({ from: isoDate, to: isoDate, reason: z.string().trim().min(1, 'Nhập lý do tạm dừng').max(500) })
  .refine((b) => b.to >= b.from, { path: ['to'], message: 'Ngày kết thúc tạm dừng phải từ ngày bắt đầu trở đi' });
export const PauseDecisionBody = z.object({ approve: z.boolean(), note: z.string().trim().max(500).default('') });

export const AssignmentBody = z.object({ role: z.enum(ASSIGNMENT_ROLES), userId: id });
export const TransferBody = z.object({ storeId: id, chtId: id.nullable().optional(), qlkvId: id.nullable().optional() });
export const StopStaffBody = z.object({
  reason: z.string().trim().min(1, 'Nhập lý do ngừng theo dõi').max(500),
  handover: z.array(HandoverItem).default([]),
});

/** Xóa hẳn hồ sơ nhân viên: gõ lại đúng họ tên để xác nhận, lý do ghi vào nhật ký hệ thống */
export const DeleteStaffBody = z.object({
  confirmName: z.string().trim().min(1, 'Nhập họ tên nhân viên để xác nhận'),
  reason: z.string().trim().min(1, 'Nhập lý do xóa hồ sơ').max(500),
});

export const MarkReadBody = z.object({ ids: z.array(id).optional(), all: z.boolean().optional() });

// ---------- Onboarding Cửa hàng trưởng ----------

/** Gán checklist CHT cho một tài khoản CHT (BP ĐT hoặc QLKV trong khu vực) */
export const CreateChtRunBody = z.object({
  userId: id,
  track: z.enum(CHT_TRACKS, { errorMap: () => ({ message: 'Chọn loại checklist CHT' }) }),
  storeId: z.number({ required_error: 'Chọn cửa hàng', invalid_type_error: 'Chọn cửa hàng' }).int().positive('Chọn cửa hàng'),
  startDate: isoDate,
  trainingMode: z.enum(['online', 'offline'], { errorMap: () => ({ message: 'Chọn hình thức training tuần đầu' }) }),
  trainerId: z.number({ required_error: 'Chọn người phụ trách Đào tạo', invalid_type_error: 'Chọn người phụ trách Đào tạo' }).int().positive('Chọn người phụ trách Đào tạo'),
  qlkvId: z.number({ required_error: 'Chọn QLKV', invalid_type_error: 'Chọn QLKV' }).int().positive('Chọn QLKV'),
  buddyId: id.nullable().optional(),
  /** Thâm niên NVBH (tháng) khi CHT thăng tiến chưa có hồ sơ NVBH trong hệ thống */
  seniorityMonths: z.number().int().min(0).max(600).nullable().optional(),
});
export const ChtJournalBody = z.object({
  mood: z.string().trim().max(100).nullable().optional(),
  difficulties: z.string().max(2000).optional(),
  actions: z.string().max(2000).optional(),
  managerNote: z.string().max(2000).optional(),
});
export const ATTRITION_RISKS = ['low', 'medium', 'high'] as const;
export const ChtEvaluationBody = z.object({
  ratings: z.record(z.string(), z.number().int().min(1).max(5)),
  risk: z.enum(ATTRITION_RISKS).nullable(),
  suggestion: z.string().max(2000).default(''),
});
export const ChtConfirmBody = z.object({ note: z.string().trim().max(1000).default('') });
export const ChtMetaBody = z.object({ managerNote: z.string().max(2000) });

export type CreateChtRunBodyT = z.infer<typeof CreateChtRunBody>;
export type ChtJournalBodyT = z.infer<typeof ChtJournalBody>;
export type ChtEvaluationBodyT = z.infer<typeof ChtEvaluationBody>;

export type RegisterBodyT = z.infer<typeof RegisterBody>;
export type ApproveUserBodyT = z.infer<typeof ApproveUserBody>;
export type UpdateUserBodyT = z.infer<typeof UpdateUserBody>;
export type CreateUserBodyT = z.infer<typeof CreateUserBody>;
export type HandoverItemT = z.infer<typeof HandoverItem>;
export type AreaBodyT = z.infer<typeof AreaBody>;
export type StoreBodyT = z.infer<typeof StoreBody>;
export type PauseBodyT = z.infer<typeof PauseBody>;
export type TransferBodyT = z.infer<typeof TransferBody>;
export type StopStaffBodyT = z.infer<typeof StopStaffBody>;
export type DeleteStaffBodyT = z.infer<typeof DeleteStaffBody>;

export type SalesBodyT = z.infer<typeof SalesBody>;
export type ObservationBodyT = z.infer<typeof ObservationBody>;
export type SaveReviewBodyT = z.infer<typeof SaveReviewBody>;
export type SaveDraftBodyT = z.infer<typeof SaveDraftBody>;
export type ApproveBodyT = z.infer<typeof ApproveBody>;
export type LoginBodyT = z.infer<typeof LoginBody>;
export type ConfirmBodyT = z.infer<typeof ConfirmBody>;
export type ConfirmManyBodyT = z.infer<typeof ConfirmManyBody>;
export type UndoBodyT = z.infer<typeof UndoBody>;
export type ReworkBodyT = z.infer<typeof ReworkBody>;
export type StatusBodyT = z.infer<typeof StatusBody>;
