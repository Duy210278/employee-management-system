<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useMe, useUsers } from '@/api/queries';

/** Quản trị (mục 4.3): chỉ BP Đào tạo */
const route = useRoute();
const { data: me } = useMe();
const isBp = computed(() => me.value?.user.role === 'bp');
const { data: users } = useUsers(isBp);
const pending = computed(() => users.value?.items.filter((u) => u.status === 'pending').length ?? 0);
const links = computed(() => [
  { to: '/quan-tri/tai-khoan', label: 'Tài khoản và vai trò', badge: pending.value },
  { to: '/quan-tri/danh-muc', label: 'Cửa hàng, khu vực' },
  { to: '/quan-tri/nhap-csv', label: 'Nhập tài khoản' },
  { to: '/quan-tri/nhat-ky', label: 'Nhật ký hệ thống' },
  { to: '/quan-tri/he-thong', label: me.value?.demoMode ? 'Cấu hình, công cụ demo' : 'Cấu hình' },
]);
</script>

<template>
  <div class="stack">
    <div class="h2">Quản trị</div>
    <div v-if="!isBp" class="card empty"><h3>Chỉ BP Đào tạo dùng được trang này</h3></div>
    <template v-else>
      <nav class="sub" aria-label="Mục quản trị">
        <RouterLink v-for="l in links" :key="l.to" :to="l.to" class="subl" :aria-current="route.path === l.to || route.path.startsWith(l.to + '/') ? 'page' : undefined">
          {{ l.label }}<span v-if="l.badge" class="n">{{ l.badge }}</span>
        </RouterLink>
      </nav>
      <RouterView />
    </template>
  </div>
</template>
