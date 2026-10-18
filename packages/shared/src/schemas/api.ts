import { z } from 'zod';
import { isIsoDate } from '../dates';
import { TASK_ROLES } from '../roles';
import { VersionContentSchema } from './version';

/** Dữ liệu vào của API, dùng chung cho form giao diện và kiểm tra ở server. */

const rowVersion = z.number({ required_error: 'Thiếu rowVersion' }).int().min(0);
const note = z.string().trim().max(1000, 'Ghi chú tối đa 1000 ký tự');

export const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  password: z.string().min(1, 'Nhập mật khẩu'),
});

export const LoginAsBody = z.object({ userId: z.number().int().positive() });

export const ClockBody = z
  .object({
    date: z
      .string()
      .refine(isIsoDate, 'Ngày phải có dạng YYYY-MM-DD')
      .nullable()
      .optional(),
    shiftDays: z.number().int().min(-366).max(366).optional(),
  })
  .refine((b) => b.date !== undefined || b.shiftDays !== undefined, 'Cần date hoặc shiftDays');

export const ConfirmBody = z.object({
  role: z.enum(TASK_ROLES).optional(),
  note: note.optional(),
  rowVersion,
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
export const ReturnBody = z.object({ note: z.string().trim().min(1, 'Nhập lý do trả về để BP Đào tạo biết cần sửa gì').max(2000) });

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

export type SalesBodyT = z.infer<typeof SalesBody>;
export type ObservationBodyT = z.infer<typeof ObservationBody>;
export type SaveReviewBodyT = z.infer<typeof SaveReviewBody>;
export type SaveDraftBodyT = z.infer<typeof SaveDraftBody>;
export type ApproveBodyT = z.infer<typeof ApproveBody>;
export type LoginBodyT = z.infer<typeof LoginBody>;
export type ClockBodyT = z.infer<typeof ClockBody>;
export type ConfirmBodyT = z.infer<typeof ConfirmBody>;
export type UndoBodyT = z.infer<typeof UndoBody>;
export type ReworkBodyT = z.infer<typeof ReworkBody>;
export type StatusBodyT = z.infer<typeof StatusBody>;
