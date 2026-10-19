<script setup lang="ts">
import { useRouter } from 'vue-router';
import StaffRunForm from '@/components/StaffRunForm.vue';

/** Thêm nhân viên và bắt đầu lượt Level (mục 9.1, 9.2) */
const router = useRouter();
const open = (r: { staffId: number }) => router.push(`/nhan-su/${r.staffId}`);
</script>

<template>
  <div class="stack">
    <div><RouterLink class="btn sm" to="/nhan-su">← Danh sách nhân sự</RouterLink></div>
    <div class="card pad stack" style="max-width: 820px">
      <div class="h1">Thêm nhân viên</div>
      <StaffRunForm @created="open">
        <template #actions><RouterLink class="btn" to="/nhan-su">Hủy</RouterLink></template>
      </StaffRunForm>
    </div>
  </div>
</template>
