import type { AccountRole, AssignmentRole, AttritionRisk, CriterionResult, ReviewResult, TaskRole, TaskStatus, Track, UserStatus, VersionContent } from '@lotrinh/shared';
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Mô hình dữ liệu (mục 13). Ngày nghiệp vụ dùng kiểu date (chuỗi YYYY-MM-DD),
 * thời điểm thao tác dùng timestamptz. Dữ liệu nghiệp vụ không xóa vật lý (R21).
 */

const ts = (name: string) => timestamp(name, { withTimezone: true });
const day = (name: string) => date(name, { mode: 'string' });

// ---------- 13.1 Tổ chức và người dùng ----------

export const areas = pgTable('areas', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
});

export const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  address: text('address'),
  areaId: integer('area_id')
    .notNull()
    .references(() => areas.id),
  active: boolean('active').notNull().default(true),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  employeeCode: text('employee_code').unique(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  role: text('role').$type<AccountRole>().notNull(),
  status: text('status').$type<UserStatus>().notNull().default('pending'),
  canBuddy: boolean('can_buddy').notNull().default(false),
  /** Thông tin người đăng ký đề nghị (mục 5.1); BP ĐT chốt vai trò, phạm vi khi duyệt */
  requestedRole: text('requested_role').$type<AccountRole>(),
  requestedStoreId: integer('requested_store_id').references(() => stores.id),
  requestedAreaId: integer('requested_area_id').references(() => areas.id),
  /** Lý do từ chối đăng ký (mục 5.4 điều 5) */
  reviewNote: text('review_note'),
  reviewedBy: integer('reviewed_by'),
  reviewedAt: ts('reviewed_at'),
  rowVersion: integer('row_version').notNull().default(0),
  lastSeenAt: ts('last_seen_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

/** Thông báo trong ứng dụng (mục 10.6); dedupe_key chống trùng khi job chạy lại (mục 14.9) */
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    dedupeKey: text('dedupe_key').unique(),
    /** Ngày nghiệp vụ lúc tạo */
    businessDate: day('business_date').notNull(),
    createdAt: ts('created_at').notNull(),
    readAt: ts('read_at'),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.readAt)],
);

export const userStoreScopes = pgTable(
  'user_store_scopes',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    storeId: integer('store_id')
      .notNull()
      .references(() => stores.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.storeId] })],
);

export const userAreaScopes = pgTable(
  'user_area_scopes',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    areaId: integer('area_id')
      .notNull()
      .references(() => areas.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.areaId] })],
);

export const credentials = pgTable('credentials', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id),
  passwordHash: text('password_hash').notNull(),
  passwordChangedAt: ts('password_changed_at').notNull().defaultNow(),
});

// ---------- 13.2 Phiên bản (nội dung lưu một tài liệu JSONB bất biến) ----------

/**
 * draft: nháp · pending: chờ duyệt · active: đã ban hành (đang, sắp hoặc hết hiệu lực tính theo ngày hiệu lực).
 * expired giữ lại cho dữ liệu cũ; trạng thái hiển thị tính bằng versionState().
 */
export type VersionStatus = 'draft' | 'pending' | 'active' | 'expired';

export const versions = pgTable('versions', {
  id: serial('id').primaryKey(),
  /** Cấp khi duyệt; bản nháp chưa có số */
  code: text('code').unique(),
  /** Dòng tiêu chí: hai số đầu (2.1). Cấp khi duyệt */
  criteriaLine: text('criteria_line'),
  status: text('status').$type<VersionStatus>().notNull(),
  effectiveFrom: day('effective_from'),
  effectiveTo: day('effective_to'),
  parentId: integer('parent_id'),
  changeNote: text('change_note'),
  changeKind: text('change_kind').$type<'text' | 'criteria'>(),
  /** Lý do trả về nháp: chỉ còn ở dữ liệu cũ, khi QLKV còn quyền duyệt phiên bản */
  reviewNote: text('review_note'),
  content: jsonb('content').$type<VersionContent>().notNull(),
  rowVersion: integer('row_version').notNull().default(0),
  createdBy: integer('created_by').references(() => users.id),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: ts('updated_at').notNull().defaultNow(),
  submittedBy: integer('submitted_by').references(() => users.id),
  submittedAt: ts('submitted_at'),
  approvedBy: integer('approved_by').references(() => users.id),
  approvedAt: ts('approved_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

// ---------- 13.3 Vận hành ----------

export const staff = pgTable('staff', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .unique()
    .references(() => users.id),
  employeeCode: text('employee_code'),
  fullName: text('full_name').notNull(),
  storeId: integer('store_id')
    .notNull()
    .references(() => stores.id),
  hireDate: day('hire_date').notNull(),
  currentLevel: integer('current_level').notNull().default(1),
  active: boolean('active').notNull().default(true),
  /** "Ngừng theo dõi" khi nghỉ việc (mục 9.3): dữ liệu giữ nguyên */
  stopReason: text('stop_reason'),
  stoppedAt: ts('stopped_at'),
  stoppedBy: integer('stopped_by').references(() => users.id),
  createdAt: ts('created_at').notNull().defaultNow(),
});

/** promoted: NVBH thăng chức Cửa hàng trưởng, lượt NVBH đóng và chuyển sang lượt CHT */
export type RunStatus = 'active' | 'paused' | 'review' | 'passed' | 'extended' | 'failed' | 'stopped' | 'promoted';

/** Thông tin riêng của lượt onboarding CHT (tab "Thông tin CHT" trong file Excel) */
export interface RunMeta {
  trainingMode?: 'online' | 'offline';
  previousStoreName?: string | null;
  seniorityMonths?: number | null;
  managerNote?: string;
}

export const levelRuns = pgTable(
  'level_runs',
  {
    id: serial('id').primaryKey(),
    staffId: integer('staff_id')
      .notNull()
      .references(() => staff.id),
    levelKey: integer('level_key').notNull(),
    /** nvbh: lộ trình 4 Level · cht_moi_tuyen, cht_thang_tien: checklist onboarding Cửa hàng trưởng */
    track: text('track').$type<Track>().notNull().default('nvbh'),
    meta: jsonb('meta').$type<RunMeta>().notNull().default({}),
    versionId: integer('version_id')
      .notNull()
      .references(() => versions.id),
    criteriaLine: text('criteria_line').notNull(),
    startDate: day('start_date').notNull(),
    plannedEnd: day('planned_end').notNull(),
    status: text('status').$type<RunStatus>().notNull().default('active'),
    extCount: integer('ext_count').notNull().default(0),
    ackBy: integer('ack_by').references(() => users.id),
    ackAt: ts('ack_at'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('level_runs_staff_idx').on(t.staffId)],
);

export const runAssignments = pgTable(
  'run_assignments',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id')
      .notNull()
      .references(() => levelRuns.id),
    role: text('role').$type<AssignmentRole>().notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    fromDate: day('from_date').notNull(),
    /** null: phân công đang hiệu lực */
    toDate: day('to_date'),
  },
  (t) => [index('run_assignments_run_idx').on(t.runId), index('run_assignments_user_idx').on(t.userId)],
);

export const runTasks = pgTable(
  'run_tasks',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id')
      .notNull()
      .references(() => levelRuns.id),
    itemKey: text('item_key').notNull(),
    openDate: day('open_date').notNull(),
    dueDate: day('due_date').notNull(),
    status: text('status').$type<TaskStatus>().notNull().default('todo'),
    doneDate: day('done_date'),
    naReason: text('na_reason'),
    reworkNote: text('rework_note'),
    reworkBy: integer('rework_by').references(() => users.id),
    reworkAt: ts('rework_at'),
    /** Chống ghi đè khi hai người cùng thao tác (mục 14.9) */
    rowVersion: integer('row_version').notNull().default(0),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('run_tasks_run_item_uq').on(t.runId, t.itemKey)],
);

export const taskConfirmations = pgTable(
  'task_confirmations',
  {
    id: serial('id').primaryKey(),
    taskId: integer('task_id')
      .notNull()
      .references(() => runTasks.id),
    /** Ô xác nhận được điền */
    role: text('role').$type<TaskRole>().notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    /** Vai trò thật của người điền khi xác nhận thay (ví dụ CHT xác nhận thay Buddy) */
    proxyRole: text('proxy_role').$type<TaskRole>(),
    at: ts('at').notNull(),
    note: text('note'),
    revokedAt: ts('revoked_at'),
    revokedBy: integer('revoked_by').references(() => users.id),
  },
  (t) => [
    uniqueIndex('task_confirmations_active_uq').on(t.taskId, t.role).where(sql`revoked_at is null`),
    index('task_confirmations_task_idx').on(t.taskId),
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

export const taskEvents = pgTable(
  'task_events',
  {
    id: serial('id').primaryKey(),
    taskId: integer('task_id')
      .notNull()
      .references(() => runTasks.id),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role').$type<TaskRole>(),
    proxyRole: text('proxy_role').$type<TaskRole>(),
    action: text('action').notNull(),
    note: text('note'),
    /** Dữ liệu kèm sự kiện; với action = date_change là ngày cũ, ngày mới, lý do (mục 10.2, R18) */
    data: jsonb('data').$type<DateChangeData>(),
    at: ts('at').notNull(),
  },
  (t) => [index('task_events_task_idx').on(t.taskId)],
);

/** Ký cuối giai đoạn theo chuỗi ký của giai đoạn (mục 10.2, R11, R12) */
export const stageSignoffs = pgTable(
  'stage_signoffs',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id')
      .notNull()
      .references(() => levelRuns.id),
    stageKey: text('stage_key').notNull(),
    step: integer('step').notNull(),
    role: text('role').$type<TaskRole>().notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    at: ts('at').notNull(),
  },
  (t) => [uniqueIndex('stage_signoffs_step_uq').on(t.runId, t.stageKey, t.step)],
);

export type PauseStatus = 'pending' | 'approved' | 'rejected';

/** Tạm dừng lượt Level (mục 9.3): CHT đề xuất, QLKV hoặc BP ĐT duyệt */
export const runPauses = pgTable(
  'run_pauses',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id')
      .notNull()
      .references(() => levelRuns.id),
    fromDate: day('from_date').notNull(),
    toDate: day('to_date').notNull(),
    reason: text('reason').notNull(),
    status: text('status').$type<PauseStatus>().notNull().default('pending'),
    requestedBy: integer('requested_by')
      .notNull()
      .references(() => users.id),
    requestedAt: ts('requested_at').notNull(),
    decidedBy: integer('decided_by').references(() => users.id),
    decidedAt: ts('decided_at'),
    decisionNote: text('decision_note'),
  },
  (t) => [index('run_pauses_run_idx').on(t.runId)],
);

/** Nhật ký theo dõi hằng ngày của onboarding CHT: Đào tạo ghi sau mỗi lần check-in, quản lý ghi chú */
export const runJournal = pgTable(
  'run_journal',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id')
      .notNull()
      .references(() => levelRuns.id),
    /** 0 là Ngày D */
    day: integer('day').notNull(),
    mood: text('mood'),
    difficulties: text('difficulties').notNull().default(''),
    actions: text('actions').notNull().default(''),
    managerNote: text('manager_note').notNull().default(''),
    updatedBy: integer('updated_by').references(() => users.id),
    updatedAt: ts('updated_at'),
    managerBy: integer('manager_by').references(() => users.id),
    managerAt: ts('manager_at'),
  },
  (t) => [uniqueIndex('run_journal_run_day_uq').on(t.runId, t.day)],
);

/** Đánh giá tổng kết tuần đầu của onboarding CHT; quản lý cấp trên xác nhận thì lượt hoàn thành */
export const runEvaluations = pgTable('run_evaluations', {
  id: serial('id').primaryKey(),
  runId: integer('run_id')
    .notNull()
    .unique()
    .references(() => levelRuns.id),
  ratings: jsonb('ratings').$type<Record<string, number>>().notNull().default({}),
  risk: text('risk').$type<AttritionRisk>(),
  suggestion: text('suggestion').notNull().default(''),
  savedBy: integer('saved_by').references(() => users.id),
  savedAt: ts('saved_at'),
  confirmedBy: integer('confirmed_by').references(() => users.id),
  confirmedAt: ts('confirmed_at'),
  confirmNote: text('confirm_note'),
});

// ---------- Đánh giá (mục 11.5) ----------

/** Doanh số theo tháng của Level (V8), đơn vị triệu đồng; POS ghi vào cùng bảng khi tích hợp (giai đoạn 3) */
export const salesMonthly = pgTable(
  'sales_monthly',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id')
      .notNull()
      .references(() => levelRuns.id),
    monthIndex: integer('month_index').notNull(),
    total: doublePrecision('total'),
    coef1: doublePrecision('coef1'),
    source: text('source').$type<'manual' | 'pos'>().notNull().default('manual'),
    enteredBy: integer('entered_by').references(() => users.id),
    at: ts('at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sales_monthly_run_month_uq').on(t.runId, t.monthIndex)],
);

/** Ca quan sát Rubric (Phụ lục C): điểm theo mã tiêu chí của phiên bản */
export const observations = pgTable(
  'observations',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id')
      .notNull()
      .references(() => levelRuns.id),
    obsDate: day('obs_date').notNull(),
    scores: jsonb('scores').$type<Record<string, number>>().notNull(),
    note: text('note'),
    observerId: integer('observer_id')
      .notNull()
      .references(() => users.id),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('observations_run_idx').on(t.runId)],
);

/** Phiếu đánh giá tổng kết; mỗi vòng gia hạn là một phiếu mới (round) */
export const levelReviews = pgTable(
  'level_reviews',
  {
    id: serial('id').primaryKey(),
    runId: integer('run_id')
      .notNull()
      .references(() => levelRuns.id),
    round: integer('round').notNull().default(0),
    criteriaResults: jsonb('criteria_results').$type<CriterionResult[]>().notNull().default([]),
    notes: jsonb('notes').$type<Record<string, string>>().notNull().default({}),
    result: text('result').$type<ReviewResult>(),
    extGoals: text('ext_goals').notNull().default(''),
    status: text('status').$type<'draft' | 'signing' | 'done'>().notNull().default('draft'),
    savedBy: integer('saved_by').references(() => users.id),
    savedAt: ts('saved_at'),
    /** Thời điểm kết quả được áp dụng (chuyển Level, gia hạn, đóng lượt) */
    appliedAt: ts('applied_at'),
    rowVersion: integer('row_version').notNull().default(0),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('level_reviews_run_round_uq').on(t.runId, t.round)],
);

export const reviewSignatures = pgTable(
  'review_signatures',
  {
    id: serial('id').primaryKey(),
    reviewId: integer('review_id')
      .notNull()
      .references(() => levelReviews.id),
    step: integer('step').notNull(),
    role: text('role').$type<TaskRole>().notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    at: ts('at').notNull(),
  },
  (t) => [uniqueIndex('review_signatures_step_uq').on(t.reviewId, t.step)],
);

export const auditLogs = pgTable('audit_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  entity: text('entity'),
  entityId: text('entity_id'),
  payload: jsonb('payload'),
  at: ts('at').notNull().defaultNow(),
  ip: text('ip'),
});
