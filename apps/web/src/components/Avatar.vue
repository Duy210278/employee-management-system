<script setup lang="ts">
import { computed } from 'vue';
import { initials } from '@/format';

/** Vòng tròn chữ viết tắt tên người dùng, nhân viên */
const props = withDefaults(defineProps<{ name: string; size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' });
const text = computed(() => initials(props.name));
</script>

<template>
  <span class="avatar" :class="size === 'md' ? '' : size" aria-hidden="true">{{ text }}</span>
</template>
