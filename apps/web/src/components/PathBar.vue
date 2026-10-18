<script setup lang="ts">
import type { PathStep } from '@lotrinh/shared';
import { fmtDate } from '@/format';

/** Thanh "Lộ trình 4 Level" (mục 9.2): Level đã qua tô xanh, Level hiện tại tô màu nhấn */
defineProps<{ path: PathStep[]; forStaff: boolean; refYear: number }>();
</script>

<template>
  <div class="path">
    <div v-for="p in path" :key="p.levelKey" :class="{ past: p.state === 'past', cur: p.state === 'current', dim: forStaff && p.state === 'future' }">
      <b>Level {{ p.levelKey }}</b>{{ p.durationLabel }} · {{ p.phase }}
      <div class="dt">
        <template v-if="p.from">{{ fmtDate(p.from, refYear) }} → {{ fmtDate(p.to, refYear) }}</template>
        <template v-else-if="p.state === 'future'">{{ forStaff ? 'Mở khi bạn lên Level này' : 'Chưa bắt đầu' }}</template>
        <template v-else>—</template>
      </div>
    </div>
  </div>
</template>
