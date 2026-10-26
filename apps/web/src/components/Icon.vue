<script setup lang="ts">
/** Biểu tượng nét mảnh dùng chung (vẽ bằng currentColor) */
export type IconName = 'search' | 'chevron' | 'logout' | 'bell' | 'swap' | 'calendar' | 'back';

withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 18 });

const PATHS: Record<IconName, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.35-4.35',
  chevron: 'm9 6 6 6-6 6',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4',
  bell: 'M18 9a6 6 0 1 0-12 0c0 6-2.5 8-2.5 8h17S18 15 18 9ZM13.7 20a2 2 0 0 1-3.4 0',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  calendar: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  back: 'm15 6-6 6 6 6',
};
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="PATHS[name]" />
  </svg>
</template>
