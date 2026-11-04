import type {
  AlertsResponse,
  ChtEvaluationBodyT,
  ChtFormOptions,
  ChtJournalBodyT,
  ChtOnboardingResponse,
  CreateChtRunBodyT,
  ApproveUserBodyT,
  AreaBodyT,
  AssignmentRole,
  AuditLogResponse,
  ClockView,
  ConfirmManyResult,
  CreateUserBodyT,
  ImportUsersResponse,
  JobName,
  JobResult,
  NotificationsResponse,
  OrgResponse,
  PauseBodyT,
  RegisterBodyT,
  RegisterOptions,
  RunManageResponse,
  StopStaffBodyT,
  DeleteStaffBodyT,
  StoreBodyT,
  TransferBodyT,
  UpdateUserBodyT,
  UserDetailResponse,
  UserListResponse,
  CreateStaffBodyT,
  DemoAccount,
  FrameworkResponse,
  InboxResponse,
  MeResponse,
  ObservationBodyT,
  ObservationsResponse,
  OverviewResponse,
  ReviewResponse,
  RunTasksResponse,
  SalesResponse,
  SaveReviewBodyT,
  StaffFormOptions,
  StaffListResponse,
  StaffProfileResponse,
  TaskEventView,
  TaskStatus,
  TaskView,
  TodayResponse,
  VersionContent,
  VersionDetailResponse,
  VersionListResponse,
} from '@lotrinh/shared';
import { QueryCache, QueryClient, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, ref, type Ref } from 'vue';
import { useToast } from '@/composables/toast';
import { api, ApiError } from './client';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401 && location.pathname !== '/dang-nhap') {
        queryClient.clear();
        location.assign('/dang-nhap');
      }
    },
  }),
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: true, staleTime: 10_000 },
  },
});

export const fetchMe = () => api.get<MeResponse>('/me');

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: fetchMe, staleTime: 30_000 });
export const useToday = () => useQuery({ queryKey: ['today'], queryFn: () => api.get<TodayResponse>('/me/today') });
export const useInbox = (enabled: Ref<boolean>) =>
  useQuery({ queryKey: ['inbox'], queryFn: () => api.get<InboxResponse>('/me/inbox'), enabled });
export const useDemoAccounts = (enabled: Ref<boolean>) =>
  useQuery({ queryKey: ['demo-accounts'], queryFn: () => api.get<DemoAccount[]>('/demo/accounts'), enabled, staleTime: 60_000 });
export const useOverview = (runId: Ref<number | null>) =>
  useQuery({
    queryKey: computed(() => ['overview', runId.value]),
    queryFn: () => api.get<OverviewResponse>(`/runs/${runId.value}/overview`),
    enabled: computed(() => runId.value !== null),
  });
export const useStaffList = () => useQuery({ queryKey: ['staff'], queryFn: () => api.get<StaffListResponse>('/staff') });
export const useStaffProfile = (staffId: Ref<number | null>) =>
  useQuery({
    queryKey: computed(() => ['staff', staffId.value]),
    queryFn: () => api.get<StaffProfileResponse>(`/staff/${staffId.value}`),
    enabled: computed(() => staffId.value !== null),
  });
export const useStaffFormOptions = () =>
  useQuery({ queryKey: ['staff-form-options'], queryFn: () => api.get<StaffFormOptions>('/staff/form-options') });
export const useRunTasks = (runId: Ref<number | null>) =>
  useQuery({
    queryKey: computed(() => ['run-tasks', runId.value]),
    queryFn: () => api.get<RunTasksResponse>(`/runs/${runId.value}/tasks`),
    enabled: computed(() => runId.value !== null),
  });
export const useVersions = (enabled: Ref<boolean> = ref(true)) =>
  useQuery({ queryKey: ['versions'], queryFn: () => api.get<VersionListResponse>('/versions'), enabled });
export const useVersion = (id: Ref<number | null>) =>
  useQuery({
    queryKey: computed(() => ['version', id.value]),
    queryFn: () => api.get<VersionDetailResponse>(`/versions/${id.value}`),
    enabled: computed(() => id.value !== null),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
export const useFramework = () => useQuery({ queryKey: ['framework'], queryFn: () => api.get<FrameworkResponse>('/framework') });
export const useAlerts = (enabled: Ref<boolean>) => useQuery({ queryKey: ['alerts'], queryFn: () => api.get<AlertsResponse>('/alerts'), enabled });
/** Chuông thông báo: tự làm mới mỗi phút */
export const useNotifications = (enabled: Ref<boolean>) =>
  useQuery({ queryKey: ['notifications'], queryFn: () => api.get<NotificationsResponse>('/me/notifications'), enabled, refetchInterval: 60_000 });
export const useUsers = (enabled: Ref<boolean> = ref(true)) => useQuery({ queryKey: ['users'], queryFn: () => api.get<UserListResponse>('/users'), enabled });
export const useUser = (id: Ref<number | null>) =>
  useQuery({
    queryKey: computed(() => ['users', id.value]),
    queryFn: () => api.get<UserDetailResponse>(`/users/${id.value}`),
    enabled: computed(() => id.value !== null),
    staleTime: 0,
  });
export const useOrg = () => useQuery({ queryKey: ['org'], queryFn: () => api.get<OrgResponse>('/org') });
export const useRegisterOptions = () => useQuery({ queryKey: ['register-options'], queryFn: () => api.get<RegisterOptions>('/auth/register-options'), staleTime: 60_000 });
export const useAuditLogs = (params: Ref<Record<string, string | number>>) =>
  useQuery({
    queryKey: computed(() => ['audit', params.value]),
    queryFn: () => api.get<AuditLogResponse>(`/audit-logs?${new URLSearchParams(Object.entries(params.value).filter(([, v]) => v !== '' && v !== 0).map(([k, v]) => [k, String(v)]))}`),
  });
export const useRunManage = (runId: Ref<number | null>) =>
  useQuery({
    queryKey: computed(() => ['manage', runId.value]),
    queryFn: () => api.get<RunManageResponse>(`/runs/${runId.value}/manage`),
    enabled: computed(() => runId.value !== null),
  });
export const useChtOnboarding = (runId: Ref<number | null>) =>
  useQuery({
    queryKey: computed(() => ['cht', runId.value]),
    queryFn: () => api.get<ChtOnboardingResponse>(`/runs/${runId.value}/cht`),
    enabled: computed(() => runId.value !== null),
  });
export const useChtFormOptions = (userId: Ref<number | null>) =>
  useQuery({
    queryKey: computed(() => ['cht-form', userId.value]),
    queryFn: () => api.get<ChtFormOptions>(`/cht/form-options/${userId.value}`),
    enabled: computed(() => userId.value !== null),
    staleTime: 0,
  });
const runQuery = <T>(name: string, runId: Ref<number | null>, path: string) =>
  useQuery({
    queryKey: computed(() => [name, runId.value]),
    queryFn: () => api.get<T>(`/runs/${runId.value}/${path}`),
    enabled: computed(() => runId.value !== null),
  });
export const useSales = (runId: Ref<number | null>) => runQuery<SalesResponse>('sales', runId, 'sales');
export const useObservations = (runId: Ref<number | null>) => runQuery<ObservationsResponse>('observations', runId, 'observations');
export const useReview = (runId: Ref<number | null>) => runQuery<ReviewResponse>('review', runId, 'review');
export const useTaskEvents = (taskId: Ref<number>, enabled: Ref<boolean>) =>
  useQuery({
    queryKey: computed(() => ['events', taskId.value]),
    queryFn: () => api.get<TaskEventView[]>(`/tasks/${taskId.value}/events`),
    enabled,
  });

/** Chạy một thao tác ghi, báo kết quả bằng toast rồi làm mới mọi màn hình liên quan */
export function useMutate() {
  const qc = useQueryClient();
  const toast = useToast();
  return async function mutate<T>(fn: () => Promise<T>, success: string): Promise<T | undefined> {
    try {
      const result = await fn();
      toast.show(success);
      await qc.invalidateQueries();
      return result;
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Không lưu được');
      if (err instanceof ApiError && err.code === 'STALE') await qc.invalidateQueries();
      return undefined;
    }
  };
}

export const taskApi = {
  confirm: (t: TaskView, note: string) =>
    api.post<TaskView>(`/tasks/${t.id}/confirm`, { rowVersion: t.rowVersion, role: t.actions.confirmAs?.role, note: note || undefined }),
  confirmMany: (tasks: TaskView[]) => api.post<ConfirmManyResult>('/tasks/confirm-many', { tasks: tasks.map((t) => ({ id: t.id, rowVersion: t.rowVersion })) }),
  undo: (t: TaskView) => api.post<TaskView>(`/tasks/${t.id}/undo`, { rowVersion: t.rowVersion }),
  rework: (t: TaskView, note: string) => api.post<TaskView>(`/tasks/${t.id}/rework`, { rowVersion: t.rowVersion, note }),
  status: (t: TaskView, status: Exclude<TaskStatus, 'done' | 'void'>, note: string) =>
    api.post<TaskView>(`/tasks/${t.id}/status`, { rowVersion: t.rowVersion, status, note: note || undefined }),
};

export const sessionApi = {
  login: (email: string, password: string) => api.post<{ ok: true }>('/auth/login', { email, password }),
  loginAs: (userId: number) => api.post<{ ok: true }>('/demo/login-as', { userId }),
  logout: () => api.post<{ ok: true }>('/auth/logout'),
  setClock: (body: { date?: string | null; shiftDays?: number }) => api.put<ClockView>('/demo/clock', body),
  ack: (runId: number) => api.post<{ ok: true }>(`/runs/${runId}/ack`),
  resetDemo: () => api.post<{ ok: true; today: string }>('/demo/reset'),
};

export const versionApi = {
  createDraft: (fromId: number) => api.post<{ id: number }>('/versions', { fromId }),
  save: (id: number, content: VersionContent, changeNote: string, rowVersion: number) =>
    api.put<VersionDetailResponse>(`/versions/${id}/content`, { content, changeNote, rowVersion }),
  submit: (id: number, changeNote: string) => api.post<VersionDetailResponse>(`/versions/${id}/submit`, { changeNote }),
  withdraw: (id: number) => api.post<VersionDetailResponse>(`/versions/${id}/withdraw`),
  approve: (id: number, effectiveFrom: string) => api.post<VersionDetailResponse>(`/versions/${id}/approve`, { effectiveFrom }),
  reschedule: (id: number, effectiveFrom: string) => api.put<VersionDetailResponse>(`/versions/${id}/effective`, { effectiveFrom }),
  remove: (id: number) => api.del<{ ok: true }>(`/versions/${id}`),
  exportUrl: (id: number) => `/api/v1/versions/${id}/export`,
};

export const assessmentApi = {
  /** Chỉ gửi ô vừa sửa; ô không gửi được giữ nguyên ở máy chủ */
  putSales: (runId: number, month: number, values: { total?: number | null; coef1?: number | null }) =>
    api.put<SalesResponse>(`/runs/${runId}/sales/${month}`, values),
  addObservation: (runId: number, body: ObservationBodyT) => api.post<ObservationsResponse>(`/runs/${runId}/observations`, body),
  saveReview: (runId: number, body: SaveReviewBodyT) => api.put<ReviewResponse>(`/runs/${runId}/review`, body),
  signReview: (runId: number, step: number) => api.post<ReviewResponse>(`/runs/${runId}/review/sign`, { step }),
};

export const staffApi = {
  create: (body: CreateStaffBodyT) => api.post<{ staffId: number; runId: number }>('/staff', body),
  transfer: (staffId: number, body: TransferBodyT) => api.post<RunManageResponse>(`/staff/${staffId}/transfer`, body),
  stop: (staffId: number, body: StopStaffBodyT) => api.post<RunManageResponse>(`/staff/${staffId}/stop`, body),
  remove: (staffId: number, body: DeleteStaffBodyT) => api.del<{ ok: true; fullName: string; runs: number }>(`/staff/${staffId}`, body),
  exportUrl: '/api/v1/reports/progress.csv',
};

export const runApi = {
  signStage: (runId: number, stageKey: string, step: number) => api.post<RunTasksResponse>(`/runs/${runId}/stages/${encodeURIComponent(stageKey)}/sign`, { step }),
  pause: (runId: number, body: PauseBodyT) => api.post<RunManageResponse>(`/runs/${runId}/pauses`, body),
  decidePause: (runId: number, pauseId: number, approve: boolean, note: string) =>
    api.post<RunManageResponse>(`/runs/${runId}/pauses/${pauseId}/decision`, { approve, note }),
  assign: (runId: number, role: AssignmentRole, userId: number) => api.post<RunManageResponse>(`/runs/${runId}/assignments`, { role, userId }),
};

export const userApi = {
  register: (body: RegisterBodyT) => api.post<{ ok: true }>('/auth/register', body),
  create: (body: CreateUserBodyT) => api.post<{ id: number }>('/users', body),
  update: (id: number, body: UpdateUserBodyT) => api.put<UserDetailResponse>(`/users/${id}`, body),
  approve: (id: number, body: ApproveUserBodyT) => api.post<UserDetailResponse>(`/users/${id}/approve`, body),
  reject: (id: number, note: string) => api.post<UserDetailResponse>(`/users/${id}/reject`, { note }),
  importCsv: (csv: string, commit: boolean) => api.post<ImportUsersResponse>('/users/import', { csv, commit }),
};

export const orgApi = {
  createArea: (body: AreaBodyT) => api.post<OrgResponse>('/org/areas', body),
  updateArea: (id: number, body: AreaBodyT) => api.put<OrgResponse>(`/org/areas/${id}`, body),
  createStore: (body: StoreBodyT) => api.post<OrgResponse>('/org/stores', body),
  updateStore: (id: number, body: StoreBodyT) => api.put<OrgResponse>(`/org/stores/${id}`, body),
};

/** Onboarding Cửa hàng trưởng */
export const chtApi = {
  create: (body: CreateChtRunBodyT) => api.post<{ staffId: number; runId: number }>('/cht/runs', body),
  journal: (runId: number, day: number, body: ChtJournalBodyT) => api.put<ChtOnboardingResponse>(`/runs/${runId}/cht/journal/${day}`, body),
  evaluation: (runId: number, body: ChtEvaluationBodyT) => api.put<ChtOnboardingResponse>(`/runs/${runId}/cht/evaluation`, body),
  confirm: (runId: number, note: string) => api.post<ChtOnboardingResponse>(`/runs/${runId}/cht/evaluation/confirm`, { note }),
  meta: (runId: number, managerNote: string) => api.put<ChtOnboardingResponse>(`/runs/${runId}/cht/meta`, { managerNote }),
};

export const notificationApi = {
  read: (body: { ids?: number[]; all?: boolean }) => api.post<NotificationsResponse>('/me/notifications/read', body),
};

export const demoApi = {
  runJob: (name: JobName) => api.post<JobResult>(`/demo/jobs/${name}/run`),
};
