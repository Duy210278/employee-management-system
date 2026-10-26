<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { pageHeaderOverride } from '@/composables/pageHeader';

/**
 * Dải tiêu đề trang (theo mẫu DTP LMS): tên trang, dòng mô tả hoặc đường dẫn, nút thao tác bên phải.
 * Trang gửi nút thao tác lên đây bằng <Teleport defer to="#page-actions">.
 */
const props = defineProps<{ fallbackTitle?: string }>();
const route = useRoute();
const o = computed(() => pageHeaderOverride());
const title = computed(() => o.value?.title ?? route.meta.title ?? props.fallbackTitle ?? '');
const crumbs = computed(() => o.value?.crumbs ?? []);
// Trang có đường dẫn (cấp 2 trở lên) không lặp lại mô tả của trang cha
const desc = computed(() => o.value?.desc ?? (crumbs.value.length ? '' : (route.meta.desc ?? '')));
</script>

<template>
  <section class="phead" :aria-label="title">
    <div class="wrap phead-in" :class="{ wide: route.meta.wide }">
      <div class="phead-text">
        <h1 class="phead-title">{{ title }}</h1>
        <nav v-if="crumbs.length" class="crumbs" aria-label="Đường dẫn">
          <template v-for="(c, i) in crumbs" :key="i">
            <RouterLink :to="c.to">{{ c.label }}</RouterLink>
            <span class="sep" aria-hidden="true">›</span>
          </template>
          <span aria-current="page">{{ title }}</span>
        </nav>
        <p v-if="desc" class="phead-desc">{{ desc }}</p>
      </div>
      <div id="page-actions" class="phead-actions"></div>
    </div>
    <svg class="phead-deco" viewBox="0 0 640 120" preserveAspectRatio="none" aria-hidden="true">
      <path d="M40 -10 C 90 70, 300 105, 470 128" fill="none" stroke="currentColor" stroke-width="1.4" vector-effect="non-scaling-stroke" />
      <path d="M430 132 C 450 80, 560 70, 600 132" fill="none" stroke="currentColor" stroke-width="1.4" vector-effect="non-scaling-stroke" />
    </svg>
  </section>
</template>
