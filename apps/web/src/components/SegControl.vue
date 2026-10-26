<script setup lang="ts" generic="T extends string | number | boolean">
/** Nhóm nút liền chọn một giá trị (bộ lọc Level, mức cảnh báo…) */
defineProps<{ options: { value: T; label: string; count?: number }[]; label: string; small?: boolean }>();
const model = defineModel<T>({ required: true });
</script>

<template>
  <div class="seg" :class="{ sm: small }" role="group" :aria-label="label">
    <button v-for="o in options" :key="String(o.value)" type="button" :aria-pressed="model === o.value" @click="model = o.value">
      {{ o.label }}<span v-if="o.count !== undefined" class="c">{{ o.count }}</span>
    </button>
  </div>
</template>
