import type { IsoDate } from './dates';
import type { Alert, AlertSeverity } from './alerts/rules';
import type { AccountRole, AssignmentRole, TaskRole, UserStatus } from './roles';
import type { PauseSpan } from './schedule/run';
import type { InboxPriority } from './rules/assignee';
import type { TaskActions } from './rules/confirm';
import type { TaskState, TaskStatus } from './schedule/state';
import type { ChangeKind } from './change-kind/classify';
import type { KpiEvaluation } from './evaluation/kpi';
import type { CriterionResult, ReviewResult } from './evaluation/review';
import type { RubricEvaluation } from './evaluation/rubric';
import type { ChtTrackKey, LevelOverview, ReviewForm, Rubric, Track, VersionContent } from './schemas/version';

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
  /** NVBH 4 Level hoặc một loại checklist CHT */
  track: Track;
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
  /** Lần tạm dừng đang diễn ra hôm nay (mục 9.3) */
  pause: PauseSpan | null;
  /** Tổng số ngày đã tạm dừng (đã duyệt) */
  pausedDays: number;
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
  track: Track;
  staffId: number;
  staffName: string;
  itemKey: string;
  stageKey: string;
  stageLabel: string;
  category: string;
  content: string;
  guidance: string;
  gpp: boolean;
  /** Checklist CHT: buổi, người hỗ trợ, link hướng dẫn */
  session: 'sang' | 'chieu' | 'cuoi_ngay' | null;
  supporter: string | null;
  link: string | null;
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
  /** Ký giai đoạn, phiếu đánh giá, đề xuất tạm dừng cần người dùng xử lý */
  signatures: SignatureTodo[];
  /** QLKV: việc của người khác trong khu vực quá hạn hơn escalateDays (mục 11.3, T-L08) */
  areaAlerts: AreaAlertItem[];
}

export interface AreaAlertItem {
  taskId: number;
  runId: number;
  staffId: number;
  staffName: string;
  storeName: string;
  itemKey: string;
  content: string;
  overdueDays: number;
  /** Vai trò còn thiếu xác nhận */
  waitingFor: TaskRole[];
}

export interface StageSignStepView {
  step: number;
  role: TaskRole;
  label: string;
  signedByName: string | null;
  at: string | null;
  state: 'signed' | 'next' | 'waiting';
  canSign: boolean;
}

/** Ký cuối giai đoạn (mục 10.2, R11, R12) */
export interface StageSignView {
  opensOn: IsoDate;
  dueOn: IsoDate;
  complete: boolean;
  ready: boolean;
  overdue: boolean;
  blocked: string | null;
  steps: StageSignStepView[];
}

export interface StageView {
  key: string;
  index: number;
  label: string;
  name: string;
  goal: string;
  from: IsoDate;
  to: IsoDate;
  /** null khi giai đoạn không cấu hình chuỗi ký */
  sign: StageSignView | null;
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
  /** Cảnh báo theo quy tắc mục 11.6 */
  alerts: Alert[];
}

export interface StaffListResponse {
  today: IsoDate;
  items: StaffListItem[];
  canCreate: boolean;
  canExport: boolean;
}

/** Trang Cảnh báo (mục 11.6): mỗi dòng một cảnh báo, đỏ trước vàng sau */
export interface AlertRow extends Alert {
  track: Track;
  staffId: number;
  staffName: string;
  employeeCode: string | null;
  storeName: string;
  levelKey: number;
  runId: number;
}

export interface AlertsResponse {
  today: IsoDate;
  items: AlertRow[];
  counts: { red: number; yellow: number; staff: number };
}

export interface StaffProfileResponse {
  today: IsoDate;
  alerts: Alert[];
  /** Người xem được đổi phân công, tạm dừng, chuyển cửa hàng, ngừng theo dõi */
  canManage: boolean;
  staff: StaffSummary & {
    hireDate: IsoDate;
    currentLevel: number;
    accountEmail: string | null;
    active: boolean;
    stopReason: string | null;
    stoppedAt: string | null;
  };
  /** Lượt Level đang mở (hoặc gần nhất) */
  run: RunSummary | null;
  level: LevelSummary | null;
  people: { buddy: string | null; cht: string | null; qlkv: string | null; trainer: string | null };
  path: PathStep[];
  /** Mọi lượt Level của NV, mới nhất trước */
  history: { runId: number; track: Track; levelKey: number; levelName: string; versionCode: string; startDate: IsoDate; plannedEnd: IsoDate; status: string }[];
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

/** Khung năng lực đang hiệu lực, chỉ xem (mục 4.3) */
export interface FrameworkResponse {
  today: IsoDate;
  versionCode: string;
  effectiveFrom: IsoDate | null;
  framework: VersionContent['framework'] | null;
  rubric: Rubric;
  levels: (Omit<VersionContent['levels'][number], 'stages'> & { stageCount: number; itemCount: number })[];
}

export interface PublishingSettings {
  /** V20: BP Đào tạo tự duyệt và ban hành phiên bản, không cần người duyệt riêng */
  bpSelfPublish: boolean;
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
  /** Bản đã duyệt mà chưa tới ngày hiệu lực: khoảng ngày được chọn lại (max = null khi không có bản nào sau) */
  effectiveRange: { min: IsoDate; max: IsoDate | null } | null;
  permissions: {
    edit: boolean;
    submit: boolean;
    withdraw: boolean;
    approve: boolean;
    reject: boolean;
    remove: boolean;
    createDraft: boolean;
    /** Đổi ngày hiệu lực của bản "Sắp hiệu lực" */
    reschedule: boolean;
  };
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

/** Một việc ký/duyệt đang chờ người dùng (nhóm "Chữ ký chờ bạn", mục 11.3) */
export interface SignatureTodo {
  kind: 'review' | 'stage' | 'pause';
  runId: number;
  staffId: number;
  staffName: string;
  storeName: string;
  levelKey: number;
  step: number;
  totalSteps: number;
  label: string;
  /** Dòng phụ: tên giai đoạn, khoảng tạm dừng… */
  detail: string | null;
  dueOn: IsoDate | null;
  overdue: boolean;
  /** Tab của hồ sơ NV để mở thẳng */
  tab: 'review' | 'check' | 'manage';
}

// ---------- Quản trị người dùng (mục 5) ----------

export interface OrgOptions {
  areas: { id: number; code: string; name: string; active: boolean }[];
  stores: { id: number; code: string; name: string; areaId: number; areaName: string; active: boolean }[];
}

export interface UserListItem {
  id: number;
  fullName: string;
  employeeCode: string | null;
  email: string;
  phone: string | null;
  role: AccountRole;
  status: UserStatus;
  canBuddy: boolean;
  canApproveVersions: boolean;
  stores: { id: number; name: string }[];
  areas: { id: number; name: string }[];
  staffId: number | null;
  lastSeenAt: string | null;
  createdAt: string;
  /** Đề nghị lúc đăng ký (chỉ với tài khoản tự đăng ký) */
  requested: { role: AccountRole; storeId: number | null; storeName: string | null; areaId: number | null; areaName: string | null } | null;
  reviewNote: string | null;
}

export interface UserListResponse {
  items: UserListItem[];
  options: OrgOptions;
}

export interface UserChangeView {
  id: number;
  at: string;
  byName: string | null;
  field: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
}

/** Một phân công đang hiệu lực trên lượt Level còn mở */
export interface AssignmentView {
  runId: number;
  staffId: number;
  staffName: string;
  /** Tài khoản của chính NV (không được làm Buddy cho chính mình) */
  staffUserId: number | null;
  storeName: string;
  levelKey: number;
  role: AssignmentRole;
}

export interface UserDetailResponse {
  user: UserListItem & { rowVersion: number; staffName: string | null };
  history: UserChangeView[];
  assignments: AssignmentView[];
  /** Người nhận chuyển giao theo vai trò phân công */
  candidates: Record<AssignmentRole, PersonOption[]>;
  options: OrgOptions;
  /** Là BP ĐT hoạt động cuối cùng (R19) */
  isLastBp: boolean;
}

export interface ImportRowView {
  line: number;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  storeCode: string;
  areaCode: string;
  canBuddy: boolean;
  errors: string[];
}

export interface ImportUsersResponse {
  rows: ImportRowView[];
  valid: number;
  invalid: number;
  /** Số tài khoản đã tạo khi commit = true */
  imported: number | null;
  /** Mật khẩu ban đầu của tài khoản được nhập */
  initialPassword: string;
}

export interface OrgResponse {
  areas: { id: number; code: string; name: string; active: boolean; storeCount: number; qlkvNames: string[] }[];
  stores: { id: number; code: string; name: string; address: string | null; areaId: number; areaName: string; active: boolean; chtNames: string[]; staffCount: number }[];
}

// ---------- Vận hành lượt Level (mục 9.3) ----------

export interface PauseView {
  id: number;
  from: IsoDate;
  to: IsoDate;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedByName: string;
  requestedAt: string;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

export interface RunManageResponse {
  today: IsoDate;
  runId: number;
  track: Track;
  staffId: number;
  levelKey: number;
  runStatus: string;
  startDate: IsoDate;
  plannedEnd: IsoDate;
  storeId: number;
  people: { buddyId: number | null; chtId: number | null; qlkvId: number | null; trainerId: number | null };
  options: {
    buddies: PersonOption[];
    chts: PersonOption[];
    qlkvs: PersonOption[];
    trainers: PersonOption[];
    stores: { id: number; name: string; areaName: string; defaultChtId: number | null; defaultQlkvId: number | null }[];
  };
  pauses: PauseView[];
  permissions: { assign: boolean; requestPause: boolean; decidePause: boolean; transfer: boolean; stop: boolean };
  /** Lượt của người khác mà NV này đang làm Buddy: phải chuyển giao khi ngừng theo dõi */
  buddyOf: AssignmentView[];
  active: boolean;
}

// ---------- Thông báo, nhật ký, job ----------

export interface NotificationView {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  businessDate: IsoDate;
  createdAt: string;
  read: boolean;
}

export interface NotificationsResponse {
  items: NotificationView[];
  unread: number;
}

export interface AuditLogView {
  id: number;
  at: string;
  userId: number | null;
  userName: string | null;
  action: string;
  label: string;
  entity: string | null;
  entityId: string | null;
  payload: unknown;
  ip: string | null;
}

export interface AuditLogResponse {
  items: AuditLogView[];
  total: number;
  page: number;
  pageSize: number;
  users: { id: number; fullName: string }[];
  actions: { value: string; label: string }[];
}

export type JobName = 'version-activate' | 'daily-digest' | 'escalation' | 'alerts-refresh' | 'run-start-reminder';

export interface JobResult {
  name: JobName;
  label: string;
  date: IsoDate;
  created: number;
  message: string;
}

export interface RegisterOptions {
  areas: { id: number; name: string }[];
  stores: { id: number; name: string; areaId: number; areaName: string }[];
}

// ---------- Onboarding Cửa hàng trưởng ----------

export type AttritionRisk = 'low' | 'medium' | 'high';

export interface ChtJournalRow {
  /** 0 là Ngày D */
  day: number;
  label: string;
  date: IsoDate;
  mood: string | null;
  difficulties: string;
  actions: string;
  managerNote: string;
  updatedByName: string | null;
  updatedAt: string | null;
  managerByName: string | null;
  managerAt: string | null;
}

export interface ChtEvaluationView {
  ratings: Record<string, number>;
  risk: AttritionRisk | null;
  suggestion: string;
  savedByName: string | null;
  savedAt: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
  confirmNote: string | null;
}

/** Hồ sơ onboarding CHT: thông tin, nhật ký theo dõi hằng ngày, đánh giá tổng kết tuần đầu */
export interface ChtOnboardingResponse {
  today: IsoDate;
  runId: number;
  staffId: number;
  track: ChtTrackKey;
  trackName: string;
  title: string;
  goal: string;
  tip: string;
  notes: string[];
  moods: string[];
  ratings: { key: string; label: string }[];
  startDate: IsoDate;
  plannedEnd: IsoDate;
  runStatus: string;
  meta: { trainingMode: 'online' | 'offline' | null; previousStoreName: string | null; seniorityMonths: number | null; managerNote: string };
  people: { learner: string; trainer: string | null; qlkv: string | null; buddy: string | null };
  journal: ChtJournalRow[];
  evaluation: ChtEvaluationView;
  permissions: { journal: boolean; managerNote: boolean; evaluate: boolean; confirm: boolean };
  /** Còn thiếu gì trước khi quản lý xác nhận tổng kết */
  problems: string[];
}

/** Lựa chọn cho form "Gán checklist CHT" */
export interface ChtFormOptions {
  today: IsoDate;
  user: { id: number; fullName: string; employeeCode: string | null; role: AccountRole; status: UserStatus; storeIds: number[] };
  /** Hồ sơ đào tạo sẵn có (CHT thăng tiến từ NVBH) */
  staff: { id: number; storeName: string; hireDate: IsoDate; seniorityMonths: number; currentRun: { runId: number; track: Track; levelKey: number; status: string } | null } | null;
  /** Lượt CHT đang mở (nếu có thì không gán thêm) */
  openChtRun: { runId: number; staffId: number; track: ChtTrackKey } | null;
  tracks: { key: ChtTrackKey; name: string; title: string; days: number; items: number }[];
  /** Checklist CHT chỉ có ở bản sắp hiệu lực: Ngày D phải từ ngày hiệu lực của bản đó */
  chtFrom: { date: IsoDate; code: string } | null;
  suggestedTrack: ChtTrackKey;
  stores: { id: number; name: string; areaName: string; defaultQlkvId: number | null }[];
  trainers: PersonOption[];
  qlkvs: PersonOption[];
  buddies: PersonOption[];
}

export type { AlertSeverity };

export interface TaskEventView {
  id: number;
  at: string;
  userName: string;
  role: TaskRole | null;
  action: string;
  actionLabel: string;
  note: string | null;
}
