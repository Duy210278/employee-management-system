<script setup lang="ts">
import { useRouter } from 'vue-router';
import StaffRunForm from '@/components/StaffRunForm.vue';
import { usePageHeader } from '@/composables/pageHeader';

/** Thêm nhân viên và bắt đầu lượt Level (mục 9.1, 9.2) */
const router = useRouter();
const open = (r: { staffId: number }) => router.push(`/nhan-su/${r.staffId}`);
usePageHeader(() => ({ crumbs: [{ label: 'Nhân sự', to: '/nhan-su' }] }));
</script>

<template>
  <div class="card pad stack narrow">
    <div class="h2">Thông tin nhân viên và Level bắt đầu</div>
    <StaffRunForm @created="open">
      <template #actions><RouterLink class="btn" to="/nhan-su">Hủy</RouterLink></template>
    </StaffRunForm>
  </div>
</template>
