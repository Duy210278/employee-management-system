<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();
</script>

<template>
  <div class="card empty">
    <h3>{{ route.meta.title }}</h3>
    <div>Màn hình này đang được xây dựng, thuộc {{ route.meta.slice }} trong kế hoạch triển khai.</div>
  </div>
</template>
