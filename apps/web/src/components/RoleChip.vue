<script setup lang="ts">
import { ROLE_LABEL, ROLE_SHORT, type TaskRole } from '@lotrinh/shared';

/** Chip vai trò: đã xác nhận có dấu ✓, chưa xác nhận viền đứt (mục 15.3) */
withDefaults(defineProps<{ role: TaskRole; state?: 'plain' | 'done' | 'pending' }>(), { state: 'plain' });
</script>

<template>
  <span class="rl" :class="[role, { off: state === 'pending' }]" :title="ROLE_LABEL[role] + (state === 'done' ? ': đã xác nhận' : state === 'pending' ? ': chưa xác nhận' : '')">
    <template v-if="state === 'done'">✓ </template>{{ ROLE_SHORT[role] }}
  </span>
</template>
