<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAlerts, useInbox, useMe, useNotifications, useUsers } from '@/api/queries';
import Icon, { type IconName } from './Icon.vue';
import PageHeader from './PageHeader.vue';
import UserMenu from './UserMenu.vue';

const { data: me } = useMe();

const hasInbox = computed(() => !!me.value && (me.value.user.role !== 'nv' || me.value.isBuddyNow));
const { data: inbox } = useInbox(hasInbox);
const badge = computed(() => (inbox.value ? inbox.value.stats.waiting + inbox.value.stats.overdue : 0));
// Huy hiệu đỏ: số nhân sự có cảnh báo đỏ (mục 4.1), số đăng ký chờ duyệt (BP ĐT), thông báo chưa đọc
const isManager = computed(() => !!me.value && me.value.user.role !== 'nv');
const { data: alerts } = useAlerts(isManager);
const redStaff = computed(() => new Set((alerts.value?.items ?? []).filter((a) => a.severity === 'red').map((a) => a.staffId)).size);
const { data: users } = useUsers(computed(() => me.value?.user.role === 'bp'));
const pendingUsers = computed(() => users.value?.items.filter((u) => u.status === 'pending').length ?? 0);
const { data: notes } = useNotifications(computed(() => !!me.value));
const bellLabel = computed(() => (notes.value?.unread ? `Thông báo, ${notes.value.unread} chưa đọc` : 'Thông báo'));
const route = useRoute();

interface Tab {
  to: string;
  label: string;
  icon: IconName;
  badge?: number;
  /** Mục con (Quản trị), hiện dưới mục cha khi đang ở trong mục đó */
  children?: { to: string; label: string; badge?: number }[];
}

/** Menu theo vai trò (mục 4.2), nằm ở thanh bên */
const tabs = computed<Tab[]>(() => {
  const m = me.value;
  if (!m) return [];
  if (m.user.role === 'nv') {
    const t: Tab[] = [
      { to: '/hom-nay', label: 'Hôm nay', icon: 'home' },
      { to: '/lo-trinh', label: 'Lộ trình của tôi', icon: 'route' },
    ];
    if (m.isBuddyNow) t.push({ to: '/viec-kem-cap', label: 'Việc kèm cặp', icon: 'mentor', badge: badge.value });
    // Khung năng lực chỉ xem: mọi vai trò đều xem được (mục 4.3)
    t.push({ to: '/khung-nang-luc', label: 'Khung năng lực', icon: 'book' });
    return t;
  }
  const t: Tab[] = [
    { to: '/viec-can-xu-ly', label: 'Việc cần xử lý', icon: 'inbox', badge: badge.value },
    { to: '/nhan-su', label: 'Nhân sự', icon: 'users' },
    { to: '/canh-bao', label: 'Cảnh báo', icon: 'alert', badge: redStaff.value },
    { to: '/khung-nang-luc', label: 'Khung năng lực', icon: 'book' },
  ];
  // CHT đang (hoặc đã) onboarding có hồ sơ nhân sự của chính mình: checklist tuần đầu nằm ở "Lộ trình của tôi"
  if (m.staffId) t.splice(1, 0, { to: '/lo-trinh', label: 'Lộ trình của tôi', icon: 'route' });
  if (m.user.role === 'bp')
    t.push(
      { to: '/thiet-ke', label: 'Thiết kế lộ trình', icon: 'design' },
      {
        to: '/quan-tri',
        label: 'Quản trị',
        icon: 'settings',
        badge: pendingUsers.value,
        children: [
          { to: '/quan-tri/tai-khoan', label: 'Tài khoản và vai trò', badge: pendingUsers.value },
          { to: '/quan-tri/danh-muc', label: 'Cửa hàng, khu vực' },
          { to: '/quan-tri/nhap-csv', label: 'Nhập tài khoản' },
          { to: '/quan-tri/nhat-ky', label: 'Nhật ký hệ thống' },
          ...(m.demoMode ? [{ to: '/quan-tri/he-thong', label: 'Công cụ demo' }] : []),
        ],
      },
    );
  return t;
});
const isOn = (to: string) => route.path === to || route.path.startsWith(to + '/');
/** Tiêu đề dự phòng: nhãn menu đang chọn */
const activeLabel = computed(() => tabs.value.find((t) => isOn(t.to))?.label);
const showHeader = computed(() => route.meta.header !== false);

// Màn hẹp: thanh bên là ngăn kéo, mở bằng nút ☰, đóng khi chọn trang, bấm ra ngoài hoặc Esc
const navOpen = ref(false);
watch(
  () => route.fullPath,
  () => (navOpen.value = false),
);
function onKey(e: KeyboardEvent) {
  if (navOpen.value && e.key === 'Escape') navOpen.value = false;
}
onMounted(() => document.addEventListener('keydown', onKey));
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="shell" :class="{ 'nav-open': navOpen }">
    <aside id="side-nav" class="side" aria-label="Điều hướng chính">
      <div class="side-top">
        <RouterLink to="/" class="brand"><img src="/upharma-mark.png" alt="" width="32" height="32" /><span>Lộ trình Upharma</span></RouterLink>
        <button class="side-close" type="button" aria-label="Đóng menu" @click="navOpen = false"><Icon name="close" :size="20" /></button>
      </div>
      <nav class="side-links">
        <template v-for="t in tabs" :key="t.to">
          <RouterLink :to="t.to" :class="{ on: isOn(t.to) }" :aria-current="isOn(t.to) && !t.children ? 'page' : undefined">
            <Icon :name="t.icon" :size="20" />
            <span class="grow">{{ t.label }}</span>
            <span v-if="t.badge" class="n">{{ t.badge }}</span>
          </RouterLink>
          <div v-if="t.children && isOn(t.to)" class="side-sub">
            <RouterLink v-for="c in t.children" :key="c.to" :to="c.to" :class="{ on: isOn(c.to) }" :aria-current="isOn(c.to) ? 'page' : undefined">
              <span class="grow">{{ c.label }}</span>
              <span v-if="c.badge" class="n">{{ c.badge }}</span>
            </RouterLink>
          </div>
        </template>
      </nav>
    </aside>
    <div v-if="navOpen" class="side-backdrop" aria-hidden="true" @click="navOpen = false"></div>

    <div class="main-col">
      <header class="top">
        <div class="top-row">
          <button class="menu-btn" type="button" aria-label="Mở menu" aria-controls="side-nav" :aria-expanded="navOpen" @click="navOpen = true">
            <Icon name="menu" :size="22" />
          </button>
          <RouterLink to="/" class="brand top-brand"><img src="/upharma-mark.png" alt="" width="32" height="32" /><span>Lộ trình Upharma</span></RouterLink>
          <div class="grow"></div>
          <div v-if="me" class="top-end">
            <RouterLink to="/thong-bao" class="bell" :class="{ on: route.path === '/thong-bao' }" :aria-label="bellLabel">
              <Icon name="bell" :size="20" />
              <span v-if="notes?.unread" class="n">{{ notes.unread > 99 ? '99+' : notes.unread }}</span>
            </RouterLink>
            <UserMenu :me="me" />
          </div>
        </div>
      </header>
      <PageHeader v-if="showHeader" :fallback-title="activeLabel" />
      <main class="wrap" :class="{ wide: route.meta.wide }">
        <RouterView />
      </main>
    </div>
  </div>
</template>
