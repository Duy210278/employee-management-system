<script setup lang="ts">
import type { TaskState } from '@lotrinh/shared';

defineProps<{ state: TaskState }>();
</script>

<template>
  <span class="pill" :class="state.tone === 'neutral' ? '' : state.tone">{{ state.label }}</span>
</template>
