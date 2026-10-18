import type {
  ClockView,
  CreateStaffBodyT,
  DemoAccount,
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
  reject: (id: number, note: string) => api.post<VersionDetailResponse>(`/versions/${id}/reject`, { note }),
  approve: (id: number, effectiveFrom: string) => api.post<VersionDetailResponse>(`/versions/${id}/approve`, { effectiveFrom }),
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
};
