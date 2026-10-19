import type { MeResponse } from '@lotrinh/shared';
import { createRouter, createWebHistory } from 'vue-router';
import { ApiError } from './api/client';
import { fetchMe, queryClient } from './api/queries';
import AppShell from './components/AppShell.vue';
import AccountDetailPage from './pages/admin/AccountDetailPage.vue';
import AccountsPage from './pages/admin/AccountsPage.vue';
import AdminLayout from './pages/admin/AdminLayout.vue';
import AuditPage from './pages/admin/AuditPage.vue';
import ImportPage from './pages/admin/ImportPage.vue';
import OrgPage from './pages/admin/OrgPage.vue';
import SystemPage from './pages/admin/SystemPage.vue';
import AlertsPage from './pages/AlertsPage.vue';
import DesignPage from './pages/design/DesignPage.vue';
import FrameworkPage from './pages/FrameworkPage.vue';
import InboxPage from './pages/InboxPage.vue';
import LoginPage from './pages/LoginPage.vue';
import NotificationsPage from './pages/NotificationsPage.vue';
import PendingPage from './pages/PendingPage.vue';
import PlaceholderPage from './pages/PlaceholderPage.vue';
import RegisterPage from './pages/RegisterPage.vue';
import StaffCreatePage from './pages/staff/StaffCreatePage.vue';
import StaffListPage from './pages/staff/StaffListPage.vue';
import StaffProfilePage from './pages/staff/StaffProfilePage.vue';
import TodayPage from './pages/TodayPage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/dang-nhap', name: 'login', component: LoginPage, meta: { public: true } },
    { path: '/dang-ky', name: 'register', component: RegisterPage, meta: { public: true } },
    { path: '/cho-duyet', name: 'pending', component: PendingPage, meta: { public: true } },
    {
      path: '/',
      component: AppShell,
      children: [
        {
          // beforeEnter chạy sau guard toàn cục nên thông tin người dùng đã được nạp (redirect thì chạy trước guard)
          path: '',
          name: 'home',
          component: PlaceholderPage,
          beforeEnter: () => {
            const me = queryClient.getQueryData<MeResponse>(['me']);
            return me?.user.role === 'nv' ? { name: 'today' } : { name: 'inbox' };
          },
        },
        { path: 'hom-nay', name: 'today', component: TodayPage },
        { path: 'viec-kem-cap', name: 'mentoring', component: InboxPage },
        { path: 'viec-can-xu-ly', name: 'inbox', component: InboxPage },
        { path: 'lo-trinh', name: 'mine', component: StaffProfilePage },
        { path: 'nhan-su', name: 'staff', component: StaffListPage },
        { path: 'nhan-su/them', name: 'staff-create', component: StaffCreatePage },
        { path: 'nhan-su/:id(\\d+)', name: 'staff-profile', component: StaffProfilePage },
        { path: 'canh-bao', name: 'alerts', component: AlertsPage },
        { path: 'thong-bao', name: 'notifications', component: NotificationsPage },
        { path: 'khung-nang-luc', name: 'framework', component: FrameworkPage },
        { path: 'thiet-ke/:id(\\d+)?', name: 'design', component: DesignPage, meta: { wide: true } },
        {
          path: 'quan-tri',
          component: AdminLayout,
          children: [
            { path: '', redirect: { name: 'accounts' } },
            { path: 'tai-khoan', name: 'accounts', component: AccountsPage },
            { path: 'tai-khoan/:id(\\d+)', name: 'account', component: AccountDetailPage },
            { path: 'danh-muc', name: 'org', component: OrgPage },
            { path: 'nhap-csv', name: 'import', component: ImportPage },
            { path: 'nhat-ky', name: 'audit', component: AuditPage },
            { path: 'he-thong', name: 'admin', component: SystemPage },
          ],
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

/** Mọi trang (trừ đăng nhập, đăng ký) cần phiên hợp lệ; thông tin người dùng nạp một lần rồi dùng chung */
router.beforeEach(async (to) => {
  if (to.meta.public) return true;
  try {
    await queryClient.fetchQuery({ queryKey: ['me'], queryFn: fetchMe, staleTime: 30_000 });
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return { name: 'login' };
    throw err;
  }
});
