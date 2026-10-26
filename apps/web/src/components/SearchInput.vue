<script setup lang="ts">
import Icon from './Icon.vue';

/** Ô tìm kiếm có biểu tượng kính lúp */
defineProps<{ placeholder: string; label: string }>();
const model = defineModel<string>({ required: true });
</script>

<template>
  <label class="search">
    <Icon name="search" :size="16" />
    <input v-model="model" type="search" :placeholder="placeholder" :aria-label="label" />
  </label>
</template>
