<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAlerts, useInbox, useMe, useNotifications, useUsers, useVersions } from '@/api/queries';
import Icon from './Icon.vue';
import PageHeader from './PageHeader.vue';
import SimDateBar from './SimDateBar.vue';
import UserMenu from './UserMenu.vue';

const { data: me } = useMe();

const hasInbox = computed(() => !!me.value && (me.value.user.role !== 'nv' || me.value.isBuddyNow));
const { data: inbox } = useInbox(hasInbox);
const badge = computed(() => (inbox.value ? inbox.value.stats.waiting + inbox.value.stats.overdue : 0));
// Người duyệt phiên bản (quyền bổ sung, mục 3.2) có tab riêng với số bản chờ duyệt
const { data: versions } = useVersions(computed(() => !!me.value?.user.canApproveVersions && me.value.user.role !== 'bp'));
const pendingVersions = computed(() => versions.value?.items.filter((i) => i.state === 'pending').length ?? 0);
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
  badge?: number;
}

/** Tab theo vai trò (mục 4.2) */
const tabs = computed<Tab[]>(() => {
  const m = me.value;
  if (!m) return [];
  if (m.user.role === 'nv') {
    const t: Tab[] = [
      { to: '/hom-nay', label: 'Hôm nay' },
      { to: '/lo-trinh', label: 'Lộ trình của tôi' },
    ];
    if (m.isBuddyNow) t.push({ to: '/viec-kem-cap', label: 'Việc kèm cặp', badge: badge.value });
    return t;
  }
  const t: Tab[] = [
    { to: '/viec-can-xu-ly', label: 'Việc cần xử lý', badge: badge.value },
    { to: '/nhan-su', label: 'Nhân sự' },
    { to: '/canh-bao', label: 'Cảnh báo', badge: redStaff.value },
    { to: '/khung-nang-luc', label: 'Khung năng lực' },
  ];
  // CHT đang (hoặc đã) onboarding có hồ sơ nhân sự của chính mình: checklist tuần đầu nằm ở "Lộ trình của tôi"
  if (m.staffId) t.splice(1, 0, { to: '/lo-trinh', label: 'Lộ trình của tôi' });
  if (m.user.role === 'bp') t.push({ to: '/thiet-ke', label: 'Thiết kế lộ trình' }, { to: '/quan-tri', label: 'Quản trị', badge: pendingUsers.value });
  else if (m.user.canApproveVersions) t.push({ to: '/thiet-ke', label: 'Duyệt phiên bản', badge: pendingVersions.value });
  return t;
});
const isOn = (t: Tab) => route.path === t.to || route.path.startsWith(t.to + '/');
/** Tiêu đề dự phòng: nhãn menu đang chọn (vd. "Duyệt phiên bản" với người duyệt) */
const activeLabel = computed(() => tabs.value.find(isOn)?.label);
const showHeader = computed(() => route.meta.header !== false);
</script>

<template>
  <header class="top">
    <div class="wrap top-row" :class="{ wide: route.meta.wide }">
      <RouterLink to="/" class="brand"><i>U</i><span>Lộ trình Upharma</span></RouterLink>
      <nav class="nav" aria-label="Điều hướng">
        <RouterLink v-for="t in tabs" :key="t.to" :to="t.to" :class="{ on: isOn(t) }" :aria-current="isOn(t) ? 'page' : undefined">
          {{ t.label }}<span v-if="t.badge" class="n">{{ t.badge }}</span>
        </RouterLink>
      </nav>
      <div v-if="me" class="top-end">
        <RouterLink to="/thong-bao" class="bell" :class="{ on: route.path === '/thong-bao' }" :aria-label="bellLabel">
          <Icon name="bell" :size="20" />
          <span v-if="notes?.unread" class="n">{{ notes.unread > 99 ? '99+' : notes.unread }}</span>
        </RouterLink>
        <UserMenu :me="me" />
      </div>
    </div>
  </header>
  <SimDateBar v-if="me" :me="me" />
  <PageHeader v-if="showHeader" :fallback-title="activeLabel" />
  <main class="wrap" :class="{ wide: route.meta.wide }">
    <RouterView />
  </main>
</template>
