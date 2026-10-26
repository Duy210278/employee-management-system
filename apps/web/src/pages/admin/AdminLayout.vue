<script setup lang="ts">
import { computed } from 'vue';
import { useMe } from '@/api/queries';

/** Quản trị (mục 4.3): chỉ BP Đào tạo; các mục con nằm dưới "Quản trị" ở thanh bên */
const { data: me } = useMe();
const isBp = computed(() => me.value?.user.role === 'bp');
</script>

<template>
  <div v-if="!isBp" class="card empty"><h3>Chỉ BP Đào tạo dùng được trang này</h3></div>
  <div v-else class="page">
    <RouterView />
  </div>
</template>
