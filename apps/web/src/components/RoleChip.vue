<script setup lang="ts">
import { roleLabelFor, roleShortFor, type TaskRole, type Track } from '@lotrinh/shared';

/** Chip vai trò: đã xác nhận có dấu ✓, chưa xác nhận viền đứt (mục 15.3). Trên lượt CHT, "NV" hiện là "CHT", "BP ĐT" là "Đào tạo" */
withDefaults(defineProps<{ role: TaskRole; state?: 'plain' | 'done' | 'pending'; track?: Track }>(), { state: 'plain', track: 'nvbh' });
</script>

<template>
  <span
    class="rl"
    :class="[role, { off: state === 'pending' }]"
    :title="roleLabelFor(role, track) + (state === 'done' ? ': đã xác nhận' : state === 'pending' ? ': chưa xác nhận' : '')"
  >
    <template v-if="state === 'done'">✓ </template>{{ roleShortFor(role, track) }}
  </span>
</template>
