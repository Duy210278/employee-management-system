import {
  ACCOUNT_ROLES,
  ASSIGNMENT_ROLES,
  ATTRITION_RISKS,
  CHT_TRACKS,
  TASK_ROLES,
  TASK_STATUSES,
  USER_STATUSES,
  type AccountRole,
  type AssignmentRole,
  type AttritionRisk,
  type CriterionResult,
  type ReviewResult,
  type TaskRole,
  type TaskStatus,
  type Track,
  type UserStatus,
  type VersionContent,
} from '@lotrinh/shared';
import { sql, type Column } from 'drizzle-orm';
import { bigint, bit, check, date, datetimeoffset, float, index, int, mssqlSchema, nvarchar, uniqueIndex } from 'drizzle-orm/mssql-core';

/**
 * Mô hình dữ liệu (mục 13) trên SQL Server, schema lotrinh. Ngày nghiệp vụ dùng DATE (chuỗi YYYY-MM-DD),
 * thời điểm thao tác dùng DATETIMEOFFSET. Chữ dùng NVARCHAR để lưu tiếng Việt. JSON lưu trong NVARCHAR(MAX)
 * kèm CHECK ISJSON. Dữ liệu nghiệp vụ không xóa vật lý (R21).
 * Script tham khảo đầy đủ: docs/thiet-ke/sqlserver/01_tao_bang.sql.
 */
export const lotrinh = mssqlSchema('lotrinh');

const ts = (name: string) => datetimeoffset(name, { precision: 3 });
/** Mặc định thời điểm hiện tại kèm múi giờ (GETDATE() không có múi giờ nên bị coi là +00:00) */
const NOW = sql`SYSDATETIMEOFFSET()`;
const day = (name: string) => date(name, { mode: 'string' });
const str = (name: string, length: number) => nvarchar(name, { length });
const text = (name: string) => nvarchar(name, { length: 'max' });
const json = (name: string) => nvarchar(name, { length: 'max', mode: 'json' });
const isJson = (col: Column) => sql`isjson(${col}) = 1`;
/** CHECK: cột chỉ nhận giá trị trong danh sách (danh sách là hằng trong code, không phải dữ liệu người dùng); NULL vẫn qua */
const oneOf = (col: Column, values: readonly string[]) => sql`${col} in (${sql.raw(values.map((v) => `N'${v}'`).join(', '))})`;

// ---------- 13.1 Tổ chức và người dùng ----------

export const areas = lotrinh.table('areas', {
  id: int('id').identity().primaryKey(),
  code: str('code', 50).notNull().unique('areas_code_uq'),
  name: str('name', 200).notNull(),
  active: bit('active').notNull().default(true),
});

export const stores = lotrinh.table('stores', {
  id: int('id').identity().primaryKey(),
  code: str('code', 50).notNull().unique('stores_code_uq'),
  name: str('name', 200).notNull(),
  address: str('address', 500),
  areaId: int('area_id')
    .notNull()
    .references(() => areas.id),
  active: bit('active').notNull().default(true),
});

export const users = lotrinh.table(
  'users',
  {
    id: int('id').identity().primaryKey(),
    employeeCode: str('employee_code', 30),
    /** Mã người dùng ở hệ thống chính */
    externalId: str('external_id', 100),
    fullName: str('full_name', 200).notNull(),
    /** Email người dùng từ hệ thống chính */
    email: str('email', 255),
    phone: str('phone', 30),
    role: str('role', 10).$type<AccountRole>().notNull(),
    status: str('status', 10).$type<UserStatus>().notNull().default('active'),
    canBuddy: bit('can_buddy').notNull().default(false),
    rowVersion: int('row_version').notNull().default(0),
    lastSeenAt: ts('last_seen_at'),
    createdAt: ts('created_at').notNull().default(NOW),
  },
  (t) => [
    uniqueIndex('users_employee_code_uq').on(t.employeeCode).where(sql`${t.employeeCode} is not null`),
    uniqueIndex('users_external_id_uq').on(t.externalId).where(sql`${t.externalId} is not null`),
    uniqueIndex('users_email_uq').on(t.email).where(sql`${t.email} is not null`),
    check('users_role_ck', oneOf(t.role, ACCOUNT_ROLES)),
    check('users_status_ck', oneOf(t.status, USER_STATUSES)),
  ],
);

/** Thông báo trong ứng dụng (mục 10.6); dedupe_key chống trùng khi job chạy lại (mục 14.9) */
export const notifications = lotrinh.table(
  'notifications',
  {
    id: int('id').identity().primaryKey(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    type: str('type', 50).notNull(),
    title: str('title', 300).notNull(),
    body: text('body'),
    link: str('link', 500),
    dedupeKey: str('dedupe_key', 200),
    /** Ngày nghiệp vụ lúc tạo */
    businessDate: day('business_date').notNull(),
    createdAt: ts('created_at').notNull(),
    readAt: ts('read_at'),
  },
  (t) => [
    index('notifications_user_idx').on(t.userId, t.readAt),
    uniqueIndex('notifications_dedupe_uq').on(t.dedupeKey).where(sql`${t.dedupeKey} is not null`),
  ],
);

/** Phạm vi dữ liệu: CHT theo cửa hàng (store_id), QLKV theo khu vực (area_id); mỗi dòng đúng một trong hai */
export const userScopes = lotrinh.table(
  'user_scopes',
  {
    id: int('id').identity().primaryKey(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    storeId: int('store_id').references(() => stores.id),
    areaId: int('area_id').references(() => areas.id),
  },
  (t) => [
    check('user_scopes_one_of', sql`(${t.storeId} is not null and ${t.areaId} is null) or (${t.storeId} is null and ${t.areaId} is not null)`),
    uniqueIndex('user_scopes_store_uq').on(t.userId, t.storeId).where(sql`${t.storeId} is not null`),
    uniqueIndex('user_scopes_area_uq').on(t.userId, t.areaId).where(sql`${t.areaId} is not null`),
  ],
);

// ---------- 13.2 Phiên bản (nội dung lưu một tài liệu JSON bất biến) ----------

/**
 * draft: nháp · pending: chờ duyệt · active: đã ban hành (đang, sắp hoặc hết hiệu lực tính theo ngày hiệu lực).
 * expired giữ lại cho dữ liệu cũ; trạng thái hiển thị tính bằng versionState().
 * Bản đã gửi duyệt hoặc ban hành được trigger chặn sửa nội dung, xóa, đưa về nháp (R03, migration viết tay).
 */
export const VERSION_STATUSES = ['draft', 'pending', 'active', 'expired'] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

export const versions = lotrinh.table(
  'versions',
  {
    id: int('id').identity().primaryKey(),
    /** Cấp khi duyệt; bản nháp chưa có số */
    code: str('code', 30),
    /** Dòng tiêu chí: hai số đầu (2.1). Cấp khi duyệt */
    criteriaLine: str('criteria_line', 10),
    status: str('status', 10).$type<VersionStatus>().notNull(),
    effectiveFrom: day('effective_from'),
    effectiveTo: day('effective_to'),
    parentId: int('parent_id'),
    changeNote: text('change_note'),
    changeKind: str('change_kind', 10).$type<'text' | 'criteria'>(),
    /** Lý do trả về nháp: chỉ còn ở dữ liệu cũ, khi QLKV còn quyền duyệt phiên bản */
    reviewNote: text('review_note'),
    content: json('content').$type<VersionContent>().notNull(),
    rowVersion: int('row_version').notNull().default(0),
    createdBy: int('created_by').references(() => users.id),
    updatedBy: int('updated_by').references(() => users.id),
    updatedAt: ts('updated_at').notNull().default(NOW),
    submittedBy: int('submitted_by').references(() => users.id),
    submittedAt: ts('submitted_at'),
    approvedBy: int('approved_by').references(() => users.id),
    approvedAt: ts('approved_at'),
    createdAt: ts('created_at').notNull().default(NOW),
  },
  (t) => [
    uniqueIndex('versions_code_uq').on(t.code).where(sql`${t.code} is not null`),
    check('versions_status_ck', oneOf(t.status, VERSION_STATUSES)),
    check('versions_change_kind_ck', oneOf(t.changeKind, ['text', 'criteria'])),
    check('versions_effective_ck', sql`${t.effectiveTo} is null or ${t.effectiveFrom} is null or ${t.effectiveTo} >= ${t.effectiveFrom}`),
    check('versions_content_json_ck', isJson(t.content)),
  ],
);

// ---------- 13.3 Vận hành ----------

export const staff = lotrinh.table(
  'staff',
  {
    id: int('id').identity().primaryKey(),
    userId: int('user_id').references(() => users.id),
    employeeCode: str('employee_code', 30),
    fullName: str('full_name', 200).notNull(),
    storeId: int('store_id')
      .notNull()
      .references(() => stores.id),
    hireDate: day('hire_date').notNull(),
    currentLevel: int('current_level').notNull().default(1),
    active: bit('active').notNull().default(true),
    /** "Ngừng theo dõi" khi nghỉ việc (mục 9.3): dữ liệu giữ nguyên */
    stopReason: text('stop_reason'),
    stoppedAt: ts('stopped_at'),
    stoppedBy: int('stopped_by').references(() => users.id),
    createdAt: ts('created_at').notNull().default(NOW),
  },
  (t) => [
    uniqueIndex('staff_user_uq').on(t.userId).where(sql`${t.userId} is not null`),
    uniqueIndex('staff_employee_code_uq').on(t.employeeCode).where(sql`${t.employeeCode} is not null`),
    index('staff_store_idx').on(t.storeId),
    check('staff_level_ck', sql`${t.currentLevel} between 1 and 4`),
  ],
);

/** promoted: NVBH thăng chức Cửa hàng trưởng, lượt NVBH đóng và chuyển sang lượt CHT */
export const RUN_STATUSES = ['active', 'paused', 'review', 'passed', 'extended', 'failed', 'stopped', 'promoted'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** Thông tin riêng của lượt onboarding CHT (tab "Thông tin CHT" trong file Excel) */
export interface RunMeta {
  trainingMode?: 'online' | 'offline';
  previousStoreName?: string | null;
  seniorityMonths?: number | null;
  managerNote?: string;
}

export const levelRuns = lotrinh.table(
  'level_runs',
  {
    id: int('id').identity().primaryKey(),
    staffId: int('staff_id')
      .notNull()
      .references(() => staff.id),
    levelKey: int('level_key').notNull(),
    /** nvbh: lộ trình 4 Level · cht_moi_tuyen, cht_thang_tien: checklist onboarding Cửa hàng trưởng */
    track: str('track', 20).$type<Track>().notNull().default('nvbh'),
    meta: json('meta').$type<RunMeta>().notNull().default({}),
    versionId: int('version_id')
      .notNull()
      .references(() => versions.id),
    startDate: day('start_date').notNull(),
    plannedEnd: day('planned_end').notNull(),
    status: str('status', 10).$type<RunStatus>().notNull().default('active'),
    extCount: int('ext_count').notNull().default(0),
    ackBy: int('ack_by').references(() => users.id),
    ackAt: ts('ack_at'),
    createdBy: int('created_by').references(() => users.id),
    createdAt: ts('created_at').notNull().default(NOW),
  },
  (t) => [
    index('level_runs_staff_idx').on(t.staffId),
    check('level_runs_level_ck', sql`${t.levelKey} between 1 and 4`),
    check('level_runs_track_ck', oneOf(t.track, ['nvbh', ...CHT_TRACKS])),
    check('level_runs_status_ck', oneOf(t.status, RUN_STATUSES)),
    check('level_runs_dates_ck', sql`${t.plannedEnd} >= ${t.startDate}`),
    check('level_runs_meta_json_ck', isJson(t.meta)),
    // Mỗi nhân viên chỉ một lượt đang mở (cùng danh sách với OPEN_RUN_STATUSES ở runs/task-views.ts)
    uniqueIndex('level_runs_one_open_uq').on(t.staffId).where(sql`${t.status} in (N'active', N'paused', N'review')`),
  ],
);

export const runAssignments = lotrinh.table(
  'run_assignments',
  {
    id: int('id').identity().primaryKey(),
    runId: int('run_id')
      .notNull()
      .references(() => levelRuns.id),
    role: str('role', 10).$type<AssignmentRole>().notNull(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    fromDate: day('from_date').notNull(),
    /** null: phân công đang hiệu lực */
    toDate: day('to_date'),
  },
  (t) => [
    index('run_assignments_run_idx').on(t.runId),
    index('run_assignments_user_idx').on(t.userId),
    check('run_assignments_role_ck', oneOf(t.role, ASSIGNMENT_ROLES)),
    check('run_assignments_dates_ck', sql`${t.toDate} is null or ${t.toDate} >= ${t.fromDate}`),
    // Mỗi vai trò chỉ một người đang hiệu lực
    uniqueIndex('run_assignments_active_uq').on(t.runId, t.role).where(sql`${t.toDate} is null`),
  ],
);

export const runTasks = lotrinh.table(
  'run_tasks',
  {
    id: int('id').identity().primaryKey(),
    runId: int('run_id')
      .notNull()
      .references(() => levelRuns.id),
    itemKey: str('item_key', 100).notNull(),
    openDate: day('open_date').notNull(),
    dueDate: day('due_date').notNull(),
    status: str('status', 10).$type<TaskStatus>().notNull().default('todo'),
    doneDate: day('done_date'),
    naReason: text('na_reason'),
    reworkNote: text('rework_note'),
    reworkBy: int('rework_by').references(() => users.id),
    reworkAt: ts('rework_at'),
    /** Chống ghi đè khi hai người cùng thao tác (mục 14.9) */
    rowVersion: int('row_version').notNull().default(0),
    updatedAt: ts('updated_at').notNull().default(NOW),
  },
  (t) => [
    uniqueIndex('run_tasks_run_item_uq').on(t.runId, t.itemKey),
    check('run_tasks_status_ck', oneOf(t.status, TASK_STATUSES)),
    check('run_tasks_dates_ck', sql`${t.dueDate} >= ${t.openDate}`),
    check('run_tasks_done_ck', sql`${t.status} <> N'done' or ${t.doneDate} is not null`),
    check('run_tasks_na_ck', sql`${t.status} <> N'na' or ${t.naReason} is not null`),
  ],
);

export const taskConfirmations = lotrinh.table(
  'task_confirmations',
  {
    id: int('id').identity().primaryKey(),
    taskId: int('task_id')
      .notNull()
      .references(() => runTasks.id),
    /** Ô xác nhận được điền */
    role: str('role', 10).$type<TaskRole>().notNull(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    /** Vai trò thật của người điền khi xác nhận thay (ví dụ CHT xác nhận thay Buddy) */
    proxyRole: str('proxy_role', 10).$type<TaskRole>(),
    at: ts('at').notNull(),
    note: text('note'),
    revokedAt: ts('revoked_at'),
    revokedBy: int('revoked_by').references(() => users.id),
  },
  (t) => [
    uniqueIndex('task_confirmations_active_uq').on(t.taskId, t.role).where(sql`${t.revokedAt} is null`),
    index('task_confirmations_task_idx').on(t.taskId),
    check('task_confirmations_role_ck', oneOf(t.role, TASK_ROLES)),
    check('task_confirmations_proxy_ck', oneOf(t.proxyRole, TASK_ROLES)),
  ],
);

/** Mỗi lần tính lại ngày của đầu việc ghi một sự kiện date_change (mục 10.2, R18) */
export interface DateChangeData {
  oldOpen: string;
  oldDue: string;
  newOpen: string;
  newDue: string;
  reason: 'pause' | 'extend' | 'migrate';
  /** Id của đề xuất tạm dừng hoặc phiếu gia hạn gây ra thay đổi */
  refId: number | null;
}

export const taskEvents = lotrinh.table(
  'task_events',
  {
    id: int('id').identity().primaryKey(),
    taskId: int('task_id')
      .notNull()
      .references(() => runTasks.id),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    role: str('role', 10).$type<TaskRole>(),
    proxyRole: str('proxy_role', 10).$type<TaskRole>(),
    action: str('action', 50).notNull(),
    note: text('note'),
    /** Dữ liệu kèm sự kiện; với action = date_change là ngày cũ, ngày mới, lý do (mục 10.2, R18) */
    data: json('data').$type<DateChangeData>(),
    at: ts('at').notNull(),
  },
  (t) => [
    index('task_events_task_idx').on(t.taskId),
    check('task_events_role_ck', oneOf(t.role, TASK_ROLES)),
    check('task_events_proxy_ck', oneOf(t.proxyRole, TASK_ROLES)),
    check('task_events_data_json_ck', sql`${t.data} is null or isjson(${t.data}) = 1`),
  ],
);

export const PAUSE_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type PauseStatus = (typeof PAUSE_STATUSES)[number];

/** Tạm dừng lượt Level (mục 9.3): CHT đề xuất, QLKV hoặc BP ĐT duyệt */
export const runPauses = lotrinh.table(
  'run_pauses',
  {
    id: int('id').identity().primaryKey(),
    runId: int('run_id')
      .notNull()
      .references(() => levelRuns.id),
    fromDate: day('from_date').notNull(),
    toDate: day('to_date').notNull(),
    reason: text('reason').notNull(),
    status: str('status', 10).$type<PauseStatus>().notNull().default('pending'),
    requestedBy: int('requested_by')
      .notNull()
      .references(() => users.id),
    requestedAt: ts('requested_at').notNull(),
    decidedBy: int('decided_by').references(() => users.id),
    decidedAt: ts('decided_at'),
    decisionNote: text('decision_note'),
  },
  (t) => [
    index('run_pauses_run_idx').on(t.runId),
    check('run_pauses_status_ck', oneOf(t.status, PAUSE_STATUSES)),
    check('run_pauses_dates_ck', sql`${t.toDate} >= ${t.fromDate}`),
  ],
);

/** Nhật ký theo dõi hằng ngày của onboarding CHT: Đào tạo ghi sau mỗi lần check-in, quản lý ghi chú */
export const runJournal = lotrinh.table(
  'run_journal',
  {
    id: int('id').identity().primaryKey(),
    runId: int('run_id')
      .notNull()
      .references(() => levelRuns.id),
    /** 0 là Ngày D */
    day: int('day').notNull(),
    mood: str('mood', 100),
    difficulties: text('difficulties').notNull().default(''),
    actions: text('actions').notNull().default(''),
    managerNote: text('manager_note').notNull().default(''),
    updatedBy: int('updated_by').references(() => users.id),
    updatedAt: ts('updated_at'),
    managerBy: int('manager_by').references(() => users.id),
    managerAt: ts('manager_at'),
  },
  (t) => [uniqueIndex('run_journal_run_day_uq').on(t.runId, t.day)],
);

/** Đánh giá tổng kết tuần đầu của onboarding CHT; quản lý cấp trên xác nhận thì lượt hoàn thành */
export const runEvaluations = lotrinh.table(
  'run_evaluations',
  {
    id: int('id').identity().primaryKey(),
    runId: int('run_id')
      .notNull()
      .unique('run_evaluations_run_uq')
      .references(() => levelRuns.id),
    ratings: json('ratings').$type<Record<string, number>>().notNull().default({}),
    risk: str('risk', 10).$type<AttritionRisk>(),
    suggestion: text('suggestion').notNull().default(''),
    savedBy: int('saved_by').references(() => users.id),
    savedAt: ts('saved_at'),
    confirmedBy: int('confirmed_by').references(() => users.id),
    confirmedAt: ts('confirmed_at'),
    confirmNote: text('confirm_note'),
  },
  (t) => [check('run_evaluations_risk_ck', oneOf(t.risk, ATTRITION_RISKS)), check('run_evaluations_ratings_json_ck', isJson(t.ratings))],
);

// ---------- Đánh giá (mục 11.5) ----------

/** Doanh số theo tháng của Level (V8), đơn vị triệu đồng; POS ghi vào cùng bảng khi tích hợp (giai đoạn 3) */
export const salesMonthly = lotrinh.table(
  'sales_monthly',
  {
    id: int('id').identity().primaryKey(),
    runId: int('run_id')
      .notNull()
      .references(() => levelRuns.id),
    monthIndex: int('month_index').notNull(),
    total: float('total'),
    coef1: float('coef1'),
    source: str('source', 10).$type<'manual' | 'pos'>().notNull().default('manual'),
    enteredBy: int('entered_by').references(() => users.id),
    at: ts('at').notNull().default(NOW),
  },
  (t) => [uniqueIndex('sales_monthly_run_month_uq').on(t.runId, t.monthIndex), check('sales_monthly_source_ck', oneOf(t.source, ['manual', 'pos']))],
);

/** Ca quan sát Rubric (Phụ lục C): điểm theo mã tiêu chí của phiên bản */
export const observations = lotrinh.table(
  'observations',
  {
    id: int('id').identity().primaryKey(),
    runId: int('run_id')
      .notNull()
      .references(() => levelRuns.id),
    obsDate: day('obs_date').notNull(),
    scores: json('scores').$type<Record<string, number>>().notNull(),
    note: text('note'),
    observerId: int('observer_id')
      .notNull()
      .references(() => users.id),
    createdAt: ts('created_at').notNull().default(NOW),
  },
  (t) => [index('observations_run_idx').on(t.runId), check('observations_scores_json_ck', isJson(t.scores))],
);

/** Phiếu đánh giá tổng kết; mỗi vòng gia hạn là một phiếu mới (round) */
export const levelReviews = lotrinh.table(
  'level_reviews',
  {
    id: int('id').identity().primaryKey(),
    runId: int('run_id')
      .notNull()
      .references(() => levelRuns.id),
    round: int('round').notNull().default(0),
    criteriaResults: json('criteria_results').$type<CriterionResult[]>().notNull().default([]),
    notes: json('notes').$type<Record<string, string>>().notNull().default({}),
    result: str('result', 10).$type<ReviewResult>(),
    extGoals: text('ext_goals').notNull().default(''),
    status: str('status', 10).$type<'draft' | 'signing' | 'done'>().notNull().default('draft'),
    savedBy: int('saved_by').references(() => users.id),
    savedAt: ts('saved_at'),
    /** Thời điểm kết quả được áp dụng (chuyển Level, gia hạn, đóng lượt) */
    appliedAt: ts('applied_at'),
    rowVersion: int('row_version').notNull().default(0),
    createdAt: ts('created_at').notNull().default(NOW),
  },
  (t) => [
    uniqueIndex('level_reviews_run_round_uq').on(t.runId, t.round),
    check('level_reviews_result_ck', oneOf(t.result, ['pass', 'extend', 'fail'])),
    check('level_reviews_status_ck', oneOf(t.status, ['draft', 'signing', 'done'])),
    check('level_reviews_criteria_json_ck', isJson(t.criteriaResults)),
    check('level_reviews_notes_json_ck', isJson(t.notes)),
  ],
);

/**
 * Chữ ký theo chuỗi ký: cuối giai đoạn (stage_key, mục 10.2, R11, R12) hoặc phiếu đánh giá tổng kết
 * (review_id, mục 11.5). Mỗi dòng đúng một trong hai cột; mỗi bước ký một lần.
 */
export const signoffs = lotrinh.table(
  'signoffs',
  {
    id: int('id').identity().primaryKey(),
    runId: int('run_id')
      .notNull()
      .references(() => levelRuns.id),
    stageKey: str('stage_key', 100),
    reviewId: int('review_id').references(() => levelReviews.id),
    step: int('step').notNull(),
    role: str('role', 10).$type<TaskRole>().notNull(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    at: ts('at').notNull(),
  },
  (t) => [
    check('signoffs_one_of', sql`(${t.stageKey} is not null and ${t.reviewId} is null) or (${t.stageKey} is null and ${t.reviewId} is not null)`),
    uniqueIndex('signoffs_stage_step_uq').on(t.runId, t.stageKey, t.step).where(sql`${t.stageKey} is not null`),
    uniqueIndex('signoffs_review_step_uq').on(t.reviewId, t.step).where(sql`${t.reviewId} is not null`),
    index('signoffs_run_idx').on(t.runId),
    check('signoffs_role_ck', oneOf(t.role, TASK_ROLES)),
  ],
);

export const auditLogs = lotrinh.table(
  'audit_logs',
  {
    id: bigint('id', { mode: 'number' }).identity().primaryKey(),
    userId: int('user_id').references(() => users.id),
    action: str('action', 100).notNull(),
    entity: str('entity', 50),
    entityId: str('entity_id', 100),
    payload: json('payload'),
    at: ts('at').notNull().default(NOW),
    ip: str('ip', 64),
  },
  (t) => [
    index('audit_logs_entity_idx').on(t.entity, t.entityId),
    index('audit_logs_at_idx').on(t.at),
    check('audit_logs_payload_json_ck', sql`${t.payload} is null or isjson(${t.payload}) = 1`),
  ],
);
