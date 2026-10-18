<script setup lang="ts">
import type { Level } from '@lotrinh/shared';
import { computed } from 'vue';
import { useDesigner } from '@/designer/editor';

/** Thang thời gian giai đoạn của Level (mục 7.3): khối nối nhau, vạch "Hết Level", vùng vượt tô gạch đỏ */
const props = defineProps<{ level: Level }>();
const d = useDesigner();

const span = computed(() => Math.max(props.level.totalDays, ...props.level.stages.map((s) => s.offsetEnd), 1));
const pct = (n: number) => `${(Math.max(0, n) / span.value) * 100}%`;
const blocks = computed(() =>
  props.level.stages.map((s) => ({
    key: s.key,
    order: s.order,
    label: s.label,
    left: pct(s.offsetStart),
    width: pct(Math.max(0, s.offsetEnd - s.offsetStart)),
    bad: d.issuesFor({ stageKey: s.key }).some((i) => i.level === 'error'),
    title: `${s.label}: ngày ${s.offsetStart}–${s.offsetEnd}${s.name ? ' · ' + s.name : ''}`,
  })),
);
const overflow = computed(() => span.value > props.level.totalDays);
</script>

<template>
  <div class="tl" :aria-label="`Thang thời gian Level ${level.key}`">
    <div class="tl-track">
      <button
        v-for="b in blocks"
        :key="b.key"
        type="button"
        class="tl-block"
        :class="[`lv${level.key}`, { bad: b.bad }]"
        :style="{ left: b.left, width: b.width }"
        :title="b.title"
        @click="d.focus({ levelKey: level.key, stageKey: b.key })"
      >
        {{ b.order }}
      </button>
      <div v-if="overflow" class="tl-over" :style="{ left: pct(level.totalDays), width: pct(span - level.totalDays) }" title="Vượt thời gian Level"></div>
      <div class="tl-end" :style="{ left: pct(level.totalDays) }"><span>Hết Level · ngày {{ level.totalDays }}</span></div>
    </div>
  </div>
</template>
