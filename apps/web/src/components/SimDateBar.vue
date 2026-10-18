<script setup lang="ts">
import type { MeResponse } from '@lotrinh/shared';
import { computed } from 'vue';
import { sessionApi, useMutate } from '@/api/queries';
import { fmtDate } from '@/format';

/** Ngày giả lập (mục 14.7): mọi người thấy dải cảnh báo khi đang giả lập; chỉ BP ĐT chỉnh được */
const props = defineProps<{ me: MeResponse }>();
const mutate = useMutate();

const clock = computed(() => props.me.clock);
const isBp = computed(() => props.me.user.role === 'bp');
const visible = computed(() => props.me.demoMode && (clock.value.simulated || isBp.value));

function shift(days: number) {
  void mutate(() => sessionApi.setClock({ shiftDays: days }), days > 0 ? `Đã tua tới +${days} ngày` : `Đã lùi ${-days} ngày`);
}
function setDate(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  if (value) void mutate(() => sessionApi.setClock({ date: value }), `Đã đặt ngày ${fmtDate(value)}`);
}
function reset() {
  void mutate(() => sessionApi.setClock({ date: null }), 'Đã về ngày thật');
}
</script>

<template>
  <div v-if="visible" class="simbar" :class="{ real: !clock.simulated }">
    <div class="wrap row">
      <span v-if="clock.simulated">
        <b>Đang giả lập ngày {{ fmtDate(clock.today) }}</b>
        <span class="mut"> · ngày thật {{ fmtDate(clock.realToday) }}</span>
      </span>
      <span v-else class="mut">Ngày giả lập (demo): đang dùng ngày thật {{ fmtDate(clock.today) }}</span>
      <template v-if="isBp">
        <div class="grow"></div>
        <button class="btn sm" type="button" @click="shift(-1)">−1 ngày</button>
        <button class="btn sm" type="button" @click="shift(1)">+1 ngày</button>
        <button class="btn sm" type="button" @click="shift(7)">+1 tuần</button>
        <input type="date" :value="clock.today" aria-label="Chọn ngày giả lập" @change="setDate" />
        <button v-if="clock.simulated" class="btn sm" type="button" @click="reset">Về ngày thật</button>
      </template>
    </div>
  </div>
</template>
