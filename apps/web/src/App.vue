<script setup lang="ts">
import { useToast } from '@/composables/toast';

const toast = useToast();
</script>

<template>
  <RouterView />
  <div v-if="toast.message.value" class="toast" role="status" aria-live="polite">{{ toast.message.value }}</div>
</template>
