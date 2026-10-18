import type { MeResponse } from '@lotrinh/shared';
import { createRouter, createWebHistory } from 'vue-router';
import { ApiError } from './api/client';
import { fetchMe, queryClient } from './api/queries';
import AppShell from './components/AppShell.vue';
import AdminPage from './pages/AdminPage.vue';
import DesignPage from './pages/design/DesignPage.vue';
import InboxPage from './pages/InboxPage.vue';
import LoginPage from './pages/LoginPage.vue';
import PlaceholderPage from './pages/PlaceholderPage.vue';
import StaffCreatePage from './pages/staff/StaffCreatePage.vue';
import StaffListPage from './pages/staff/StaffListPage.vue';
import StaffProfilePage from './pages/staff/StaffProfilePage.vue';
import TodayPage from './pages/TodayPage.vue';

const soon = (title: string, slice: string) => ({ component: PlaceholderPage, meta: { title, slice } });

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/dang-nhap', name: 'login', component: LoginPage, meta: { public: true } },
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
        { path: 'quan-tri', name: 'admin', component: AdminPage },
        { path: 'canh-bao', name: 'alerts', ...soon('Cảnh báo', 'giai đoạn 2') },
        { path: 'khung-nang-luc', name: 'framework', ...soon('Khung năng lực', 'giai đoạn 2') },
        { path: 'thiet-ke/:id(\\d+)?', name: 'design', component: DesignPage, meta: { wide: true } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

/** Mọi trang (trừ đăng nhập) cần phiên hợp lệ; thông tin người dùng nạp một lần rồi dùng chung */
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
