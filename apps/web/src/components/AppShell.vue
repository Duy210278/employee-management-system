<script setup lang="ts">
import { ROLE_LABEL } from '@lotrinh/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { sessionApi, useDemoAccounts, useInbox, useMe, useVersions } from '@/api/queries';
import { useToast } from '@/composables/toast';
import SimDateBar from './SimDateBar.vue';

const router = useRouter();
const qc = useQueryClient();
const toast = useToast();
const { data: me } = useMe();

const hasInbox = computed(() => !!me.value && (me.value.user.role !== 'nv' || me.value.isBuddyNow));
const { data: inbox } = useInbox(hasInbox);
const { data: accounts } = useDemoAccounts(computed(() => !!me.value?.demoMode));
const badge = computed(() => (inbox.value ? inbox.value.stats.waiting + inbox.value.stats.overdue : 0));
// Người duyệt phiên bản (quyền bổ sung, mục 3.2) có tab riêng với số bản chờ duyệt
const { data: versions } = useVersions(computed(() => !!me.value?.user.canApproveVersions && me.value.user.role !== 'bp'));
const pendingVersions = computed(() => versions.value?.items.filter((i) => i.state === 'pending').length ?? 0);
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
    { to: '/canh-bao', label: 'Cảnh báo' },
    { to: '/khung-nang-luc', label: 'Khung năng lực' },
  ];
  if (m.user.role === 'bp') t.push({ to: '/thiet-ke', label: 'Thiết kế lộ trình' }, { to: '/quan-tri', label: 'Quản trị' });
  else if (m.user.canApproveVersions) t.push({ to: '/thiet-ke', label: 'Duyệt phiên bản', badge: pendingVersions.value });
  return t;
});

const roleLabel = computed(() => (me.value ? ROLE_LABEL[me.value.user.role] : ''));
const activeAccounts = computed(() => (accounts.value ?? []).filter((a) => a.status === 'active'));

async function switchAccount(event: Event) {
  const userId = Number((event.target as HTMLSelectElement).value);
  if (!userId || userId === me.value?.user.id) return;
  try {
    await sessionApi.loginAs(userId);
    qc.clear();
    await router.push('/');
    toast.show(`Đã chuyển sang ${activeAccounts.value.find((a) => a.id === userId)?.fullName ?? 'tài khoản khác'}`);
  } catch (err) {
    toast.show((err as Error).message);
  }
}

async function logout() {
  await sessionApi.logout().catch(() => undefined);
  qc.clear();
  await router.push('/dang-nhap');
}
</script>

<template>
  <header class="top">
    <div class="wrap">
      <div class="row">
        <RouterLink to="/" class="brand"><i>U</i>Lộ trình Upharma</RouterLink>
        <div class="grow"></div>
        <div v-if="me" class="me">
          <template v-if="me.demoMode && activeAccounts.length">
            <label class="mut sm" for="acctSw">Đổi tài khoản</label>
            <select id="acctSw" :value="me.user.id" @change="switchAccount">
              <option v-for="a in activeAccounts" :key="a.id" :value="a.id">{{ a.fullName }} · {{ ROLE_LABEL[a.role] }}</option>
            </select>
          </template>
          <span>
            <b>{{ me.user.fullName }}</b>
            <span class="mut"> · {{ roleLabel }}</span>
          </span>
          <button class="btn sm" type="button" @click="logout">Đăng xuất</button>
        </div>
      </div>
      <nav class="tabs" aria-label="Điều hướng">
        <RouterLink v-for="t in tabs" :key="t.to" :to="t.to" :class="{ on: route.path === t.to || route.path.startsWith(t.to + '/') }">
          {{ t.label }}<span v-if="t.badge" class="n">{{ t.badge }}</span>
        </RouterLink>
      </nav>
    </div>
  </header>
  <SimDateBar v-if="me" :me="me" />
  <main class="wrap" :class="{ wide: route.meta.wide }">
    <RouterView />
  </main>
</template>
