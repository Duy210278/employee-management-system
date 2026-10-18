import type { IsoDate } from './dates';
import type { AccountRole, TaskRole, UserStatus } from './roles';
import type { InboxPriority } from './rules/assignee';
import type { TaskActions } from './rules/confirm';
import type { TaskState, TaskStatus } from './schedule/state';
import type { ChangeKind } from './change-kind/classify';
import type { KpiEvaluation } from './evaluation/kpi';
import type { CriterionResult, ReviewResult } from './evaluation/review';
import type { RubricEvaluation } from './evaluation/rubric';
import type { LevelOverview, ReviewForm, Rubric, VersionContent } from './schemas/version';

/** Hợp đồng dữ liệu API ↔ giao diện. */

export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface ClockView {
  today: IsoDate;
  realToday: IsoDate;
  simulated: boolean;
}

export interface MeResponse {
  user: {
    id: number;
    fullName: string;
    email: string;
    role: AccountRole;
    status: UserStatus;
    canBuddy: boolean;
    canApproveVersions: boolean;
  };
  /** Hồ sơ NV gắn với tài khoản (chỉ với vai trò NV) */
  staffId: number | null;
  /** Đang được phân công làm Buddy của ít nhất một lượt đang chạy */
  isBuddyNow: boolean;
  clock: ClockView;
  demoMode: boolean;
}

export interface DemoAccount {
  id: number;
  email: string;
  fullName: string;
  role: AccountRole;
  status: UserStatus;
  note: string;
}

export interface StaffSummary {
  id: number;
  fullName: string;
  employeeCode: string | null;
  storeName: string;
  areaName: string;
  hasAccount: boolean;
}

export interface LevelSummary {
  key: number;
  name: string;
  phase: string;
  motto: string;
  durationLabel: string;
  rangeLabel: string;
  totalDays: number;
  checklistName: string;
}

export interface RunSummary {
  id: number;
  levelKey: number;
  versionCode: string;
  startDate: IsoDate;
  plannedEnd: IsoDate;
  status: string;
  /** 0 là ngày đầu tiên; âm khi chưa bắt đầu */
  dayIndex: number;
  acknowledged: boolean;
  ackAt: string | null;
  ackByName: string | null;
  currentStage: { key: string; label: string; name: string; index: number } | null;
  progress: { done: number; total: number; pct: number };
  counts: { overdue: number; rework: number; waiting: number };
}

export interface ConfirmationView {
  role: TaskRole;
  userId: number;
  userName: string;
  proxyRole: TaskRole | null;
  at: string;
  note: string | null;
}

export interface TaskView {
  id: number;
  runId: number;
  staffId: number;
  staffName: string;
  itemKey: string;
  stageKey: string;
  stageLabel: string;
  category: string;
  content: string;
  guidance: string;
  gpp: boolean;
  openDate: IsoDate;
  dueDate: IsoDate;
  doneDate: IsoDate | null;
  status: TaskStatus;
  rowVersion: number;
  requiredRoles: TaskRole[];
  confirmations: ConfirmationView[];
  state: TaskState;
  rework: { note: string; byName: string; at: string } | null;
  naReason: string | null;
  blockedBy: string[];
  actions: TaskActions;
}

export interface PathStep {
  levelKey: number;
  name: string;
  phase: string;
  durationLabel: string;
  state: 'past' | 'current' | 'future';
  from: IsoDate | null;
  to: IsoDate | null;
}

export interface TodayResponse {
  today: IsoDate;
  staff: StaffSummary | null;
  run: RunSummary | null;
  level: LevelSummary | null;
  path: PathStep[];
  tasks: TaskView[];
  /** Phiếu đánh giá đang chờ NV ký nhận kết quả */
  reviewToSign: { runId: number; levelKey: number } | null;
}

export interface InboxItem extends TaskView {
  priority: InboxPriority;
}

export interface InboxGroup {
  staff: StaffSummary;
  run: RunSummary;
  level: LevelSummary;
  items: InboxItem[];
}

export interface InboxResponse {
  today: IsoDate;
  stats: { waiting: number; overdue: number; dueSoon: number; staffCount: number };
  /** Lượt đang chạy có việc cần xử lý */
  groups: InboxGroup[];
  /** Lượt sắp bắt đầu: việc giai đoạn đầu ở trạng thái "Sắp mở" */
  upcoming: InboxGroup[];
  /** Phiếu đánh giá cần người dùng điền hoặc ký */
  signatures: SignatureTodo[];
}

export interface StageView {
  key: string;
  index: number;
  label: string;
  name: string;
  goal: string;
  from: IsoDate;
  to: IsoDate;
}

export interface RunTasksResponse {
  today: IsoDate;
  staff: StaffSummary;
  level: LevelSummary;
  run: RunSummary;
  stages: StageView[];
  tasks: TaskView[];
}

export interface OverviewResponse {
  run: RunSummary;
  staff: StaffSummary;
  level: LevelSummary & { kpi: { total: number; coef1: number; ratio: number } };
  overview: LevelOverview;
  people: { buddy: string | null; cht: string | null; qlkv: string | null; bp: string[] };
  /** Người xem bấm được "Tôi đã đọc và hiểu" (hoặc xác nhận thay khi NV chưa có tài khoản) */
  canAck: boolean;
  ackOnBehalf: boolean;
}

/** Một dòng bảng Nhân sự (mục 11.4) */
export interface StaffListItem {
  staff: StaffSummary;
  run: RunSummary | null;
  level: LevelSummary | null;
  /** Tín hiệu cảnh báo tối thiểu khi chưa có module Cảnh báo (giai đoạn 2) */
  flags: { overdue7: number; noBuddy: boolean; noCht: boolean };
}

export interface StaffListResponse {
  today: IsoDate;
  items: StaffListItem[];
  canCreate: boolean;
}

export interface StaffProfileResponse {
  today: IsoDate;
  staff: StaffSummary & { hireDate: IsoDate; currentLevel: number; accountEmail: string | null };
  /** Lượt Level đang mở (hoặc gần nhất) */
  run: RunSummary | null;
  level: LevelSummary | null;
  people: { buddy: string | null; cht: string | null; qlkv: string | null };
  path: PathStep[];
  /** Mọi lượt Level của NV, mới nhất trước */
  history: { runId: number; levelKey: number; levelName: string; versionCode: string; startDate: IsoDate; plannedEnd: IsoDate; status: string }[];
  isSelf: boolean;
}

export interface PersonOption {
  id: number;
  fullName: string;
  note: string;
}

export interface StaffFormOptions {
  today: IsoDate;
  stores: { id: number; name: string; areaName: string; defaultChtId: number | null; defaultQlkvId: number | null }[];
  buddies: PersonOption[];
  chts: PersonOption[];
  qlkvs: PersonOption[];
  /** Tài khoản NV đã duyệt, chưa gắn hồ sơ nào */
  accounts: PersonOption[];
  levels: { key: number; name: string; durationLabel: string }[];
}

/** Trạng thái hiển thị của phiên bản (mục 8.2); "đang hiệu lực" tính theo ngày hiệu lực so với hôm nay */
export type VersionState = 'draft' | 'pending' | 'current' | 'scheduled' | 'expired';

export interface VersionListItem {
  id: number;
  /** null với bản nháp: số được cấp khi duyệt (mục 8.3) */
  code: string | null;
  criteriaLine: string | null;
  state: VersionState;
  effectiveFrom: IsoDate | null;
  effectiveTo: IsoDate | null;
  parentId: number | null;
  parentCode: string | null;
  changeNote: string | null;
  changeKind: ChangeKind | null;
  reviewNote: string | null;
  itemCount: number;
  /** Số lượt Level đang chạy theo dòng tiêu chí này */
  activeRuns: number;
  createdAt: string;
  createdByName: string | null;
  submittedAt: string | null;
  submittedByName: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
}

export interface VersionListResponse {
  today: IsoDate;
  items: VersionListItem[];
  canEdit: boolean;
  canApprove: boolean;
}

export interface VersionDetailResponse {
  today: IsoDate;
  version: VersionListItem & { rowVersion: number };
  content: VersionContent;
  /** Bản gốc để giao diện phân loại thay đổi ngay khi soạn */
  parentContent: VersionContent | null;
  parentLine: string | null;
  existingCodes: string[];
  permissions: { edit: boolean; submit: boolean; withdraw: boolean; approve: boolean; reject: boolean; remove: boolean; createDraft: boolean };
}

// ---------- Đánh giá: doanh số, Rubric, phiếu đánh giá (mục 11.5) ----------

export interface SalesMonthView {
  month: number;
  total: number | null;
  coef1: number | null;
  inWindow: boolean;
  enteredByName: string | null;
  at: string | null;
}

export interface SalesResponse {
  today: IsoDate;
  runId: number;
  levelKey: number;
  months: number;
  /** Tháng của Level đang diễn ra */
  currentMonth: number;
  rows: SalesMonthView[];
  kpi: KpiEvaluation;
  canEdit: boolean;
}

export interface ObservationView {
  id: number;
  date: IsoDate;
  scores: Record<string, number>;
  total: number;
  max: number;
  passed: boolean;
  ones: string[];
  note: string | null;
  observerName: string;
  createdAt: string;
}

export interface ObservationsResponse {
  today: IsoDate;
  runId: number;
  runStart: IsoDate;
  rubric: Rubric;
  items: ObservationView[];
  summary: RubricEvaluation;
  /** Số ca trong tháng của Level đang diễn ra (mục tiêu ≥ minObsPerMonth) */
  thisMonth: number;
  canAdd: boolean;
}

export interface ReviewStepView {
  step: number;
  role: TaskRole;
  label: string;
  signedByName: string | null;
  at: string | null;
  state: 'signed' | 'next' | 'waiting';
  canSign: boolean;
}

export interface ReviewResponse {
  today: IsoDate;
  run: RunSummary;
  staff: StaffSummary;
  level: LevelSummary;
  form: ReviewForm;
  criteria: { name: string; threshold: string; source: string }[];
  resultLabels: Record<ReviewResult, string>;
  /** 0 = lần đầu, 1.. = vòng sau gia hạn */
  round: number;
  extCount: number;
  review: {
    id: number | null;
    criteria: CriterionResult[];
    notes: Record<string, string>;
    result: ReviewResult | null;
    goals: string;
    status: 'draft' | 'signing' | 'done';
    rowVersion: number | null;
    savedByName: string | null;
    savedAt: string | null;
    appliedAt: string | null;
  };
  /** Phiếu mở từ ngày mở giai đoạn cuối (mục 10.2) */
  opensOn: IsoDate;
  isOpen: boolean;
  auto: { checklist: { done: number; total: number; pct: number }; overdue: number; rubric: RubricEvaluation; kpi: KpiEvaluation };
  /** Kết quả gợi ý theo nguồn dữ liệu của tiêu chí (POS, Rubric) */
  suggestions: ({ value: 'pass' | 'fail'; reason: string } | null)[];
  steps: ReviewStepView[];
  /** Những điều còn thiếu trước khi ký bước đầu (R13, R14) */
  problems: string[];
  canEdit: boolean;
  /** Kết quả đã áp dụng: chuyển Level, gia hạn, đóng lượt */
  outcome: string | null;
  history: { round: number; result: ReviewResult | null; goals: string; appliedAt: string | null }[];
}

/** Một chữ ký đang chờ người dùng (nhóm "Chữ ký chờ bạn", mục 11.3) */
export interface SignatureTodo {
  runId: number;
  staffId: number;
  staffName: string;
  storeName: string;
  levelKey: number;
  step: number;
  totalSteps: number;
  label: string;
}

export interface TaskEventView {
  id: number;
  at: string;
  userName: string;
  role: TaskRole | null;
  action: string;
  actionLabel: string;
  note: string | null;
}
