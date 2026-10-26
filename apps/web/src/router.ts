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

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean;
    /** Tên trang trên dải tiêu đề; trang có tiêu đề động tự đặt qua usePageHeader() */
    title?: string;
    /** Dòng mô tả ngắn dưới tiêu đề của trang cấp 1 */
    desc?: string;
    /** false: không có dải tiêu đề (Hôm nay của NV, lời chào đã là tiêu đề) */
    header?: boolean;
    /** Khung rộng 1440 px (Thiết kế lộ trình) */
    wide?: boolean;
    slice?: string;
  }
}

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
        { path: 'hom-nay', name: 'today', component: TodayPage, meta: { header: false } },
        { path: 'viec-kem-cap', name: 'mentoring', component: InboxPage, meta: { title: 'Việc kèm cặp', desc: 'Việc của nhân viên bạn đang kèm cặp: mục đã báo xong chờ bạn xác nhận, việc sắp đến hạn' } },
        { path: 'viec-can-xu-ly', name: 'inbox', component: InboxPage, meta: { title: 'Việc cần xử lý', desc: 'Mục nhân viên đã báo xong, chữ ký chờ bạn và việc sắp đến hạn của nhân sự bạn phụ trách' } },
        { path: 'lo-trinh', name: 'mine', component: StaffProfilePage, meta: { title: 'Lộ trình của tôi' } },
        { path: 'nhan-su', name: 'staff', component: StaffListPage, meta: { title: 'Nhân sự', desc: 'Nhân sự trong phạm vi của bạn; người có cảnh báo đỏ xếp trước' } },
        { path: 'nhan-su/them', name: 'staff-create', component: StaffCreatePage, meta: { title: 'Thêm nhân viên' } },
        { path: 'nhan-su/:id(\\d+)', name: 'staff-profile', component: StaffProfilePage, meta: { title: 'Hồ sơ nhân viên' } },
        { path: 'canh-bao', name: 'alerts', component: AlertsPage, meta: { title: 'Cảnh báo', desc: 'Tính trực tiếp theo ngày nghiệp vụ mỗi lần mở trang; đỏ trước, vàng sau' } },
        { path: 'thong-bao', name: 'notifications', component: NotificationsPage, meta: { title: 'Thông báo' } },
        { path: 'khung-nang-luc', name: 'framework', component: FrameworkPage, meta: { title: 'Khung năng lực NVBH' } },
        { path: 'thiet-ke/:id(\\d+)?', name: 'design', component: DesignPage, meta: { wide: true } },
        {
          path: 'quan-tri',
          component: AdminLayout,
          meta: { title: 'Quản trị', desc: 'Tài khoản và vai trò, cửa hàng, khu vực, nhập liệu, nhật ký và cấu hình hệ thống' },
          children: [
            { path: '', redirect: { name: 'accounts' } },
            { path: 'tai-khoan', name: 'accounts', component: AccountsPage, meta: { title: 'Tài khoản và vai trò', desc: 'Duyệt đăng ký, tạo tài khoản, gán vai trò, phạm vi và quyền bổ sung' } },
            { path: 'tai-khoan/:id(\\d+)', name: 'account', component: AccountDetailPage },
            { path: 'danh-muc', name: 'org', component: OrgPage, meta: { title: 'Cửa hàng, khu vực', desc: 'Danh mục cửa hàng, khu vực dùng cho hồ sơ nhân viên và tài khoản' } },
            { path: 'nhap-csv', name: 'import', component: ImportPage, meta: { title: 'Nhập tài khoản', desc: 'Nhập nhiều tài khoản cùng lúc từ tệp CSV' } },
            { path: 'nhat-ky', name: 'audit', component: AuditPage, meta: { title: 'Nhật ký hệ thống', desc: 'Mọi thao tác ghi dữ liệu, theo người thao tác và thời điểm' } },
            { path: 'he-thong', name: 'admin', component: SystemPage, meta: { title: 'Cấu hình', desc: 'Ai ban hành phiên bản; công cụ demo: ngày giả lập, khôi phục dữ liệu mẫu' } },
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
