<script setup lang="ts">
import type { PathStep } from '@lotrinh/shared';
import { fmtDate } from '@/format';

/** Thanh "Lộ trình 4 Level" (mục 9.2) dạng các bước nối nhau: Level đã qua có ✓, Level hiện tại tô màu nhấn */
defineProps<{ path: PathStep[]; forStaff: boolean; refYear: number }>();
</script>

<template>
  <ol class="steps" aria-label="Lộ trình 4 Level">
    <li
      v-for="p in path"
      :key="p.levelKey"
      :class="{ past: p.state === 'past', cur: p.state === 'current', dim: forStaff && p.state === 'future' }"
      :aria-current="p.state === 'current' ? 'step' : undefined"
    >
      <span class="dot" aria-hidden="true">{{ p.state === 'past' ? '✓' : p.levelKey }}</span>
      <b>Level {{ p.levelKey }}<template v-if="p.state === 'past'"> · đã qua</template></b>
      <span class="ph">{{ p.durationLabel }} · {{ p.phase }}</span>
      <span class="dt">
        <template v-if="p.from">{{ fmtDate(p.from, refYear) }} → {{ fmtDate(p.to, refYear) }}</template>
        <template v-else-if="p.state === 'future'">{{ forStaff ? 'Mở khi bạn lên Level này' : 'Chưa bắt đầu' }}</template>
        <template v-else>—</template>
      </span>
    </li>
  </ol>
</template>
