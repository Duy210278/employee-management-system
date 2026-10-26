<script setup lang="ts">
import { addDays, diffDays, TRAINING_MODE_LABEL } from '@lotrinh/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref, toRef, watch } from 'vue';
import { chtApi, sessionApi, useChtOnboarding, useMutate, useOverview } from '@/api/queries';
import { useToast } from '@/composables/toast';
import { fmtDate, fmtDateTime } from '@/format';

/** Tổng quan onboarding CHT: thông tin như tab "Thông tin CHT" của file Excel, lưu ý, ghi chú quản lý cấp trên, xác nhận đã đọc */
const props = defineProps<{ runId: number; refYear: number }>();
const qc = useQueryClient();
const toast = useToast();
const mutate = useMutate();
const { data: v, isLoading, error } = useChtOnboarding(toRef(() => props.runId));
const { data: ov } = useOverview(toRef(() => props.runId));
const note = ref('');
const busy = ref(false);
watch(
  () => v.value?.meta.managerNote,
  (n) => (note.value = n ?? ''),
  { immediate: true },
);
const lastDay = computed(() => (v.value ? addDays(v.value.plannedEnd, -1) : ''));
const lastOffset = computed(() => (v.value ? diffDays(v.value.plannedEnd, v.value.startDate) - 1 : 0));

async function saveNote() {
  busy.value = true;
  try {
    qc.setQueryData(['cht', props.runId], await chtApi.meta(props.runId, note.value));
    toast.show('Đã lưu ghi chú quản lý');
  } catch (err) {
    toast.show((err as Error).message);
  } finally {
    busy.value = false;
  }
}
const ack = () => mutate(() => sessionApi.ack(props.runId), 'Đã xác nhận. Checklist tuần đầu đã mở');
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="v" class="stack">
    <div class="card pad stack tint">
      <div class="eyebrow">Onboarding · {{ v.trackName }}</div>
      <div class="h1">{{ v.title }}</div>
      <div v-if="v.goal"><b>Mục tiêu tuần đầu:</b> {{ v.goal }}</div>
      <div class="sm">
        Ngày D <b>{{ fmtDate(v.startDate, refYear) }}</b> → Ngày D+{{ lastOffset }} <b>{{ fmtDate(lastDay, refYear) }}</b>
        <template v-if="v.runStatus === 'passed'"> · <span class="pill ok">Đã hoàn thành tuần đầu</span></template>
      </div>
    </div>

    <div class="card pad">
      <div class="form">
        <div><div class="sm mut">Hình thức training tuần đầu</div><b>{{ v.meta.trainingMode ? TRAINING_MODE_LABEL[v.meta.trainingMode] : '—' }}</b></div>
        <div><div class="sm mut">Người phụ trách Đào tạo</div><b>{{ v.people.trainer ?? 'Chưa gắn' }}</b></div>
        <div><div class="sm mut">Quản lý khu vực (QLKV)</div><b>{{ v.people.qlkv ?? 'Chưa gắn' }}</b></div>
        <div><div class="sm mut">Buddy (CHT cũ / người QLKV chỉ định)</div><b>{{ v.people.buddy ?? 'Không có' }}</b></div>
        <template v-if="v.track === 'cht_thang_tien'">
          <div><div class="sm mut">Thâm niên NVBH</div><b>{{ v.meta.seniorityMonths !== null ? `${v.meta.seniorityMonths} tháng` : '—' }}</b></div>
          <div><div class="sm mut">Cửa hàng từng làm việc</div><b>{{ v.meta.previousStoreName ?? '—' }}</b></div>
        </template>
      </div>
    </div>

    <div v-if="v.tip" class="alert info"><div>💡 {{ v.tip }}</div></div>
    <div v-if="v.notes.length" class="card pad stack">
      <div class="h2">{{ v.track === 'cht_thang_tien' ? 'Điểm khác biệt so với CHT mới tuyển' : 'Lưu ý' }}</div>
      <ul class="ul plain">
        <li v-for="(n, i) in v.notes" :key="i">{{ n }}</li>
      </ul>
    </div>

    <div class="card pad stack">
      <div class="h2">Ghi chú quản lý cấp trên</div>
      <template v-if="v.permissions.managerNote">
        <textarea v-model="note" rows="3" placeholder="QLKV, BP ĐT ghi nhận định hướng, lưu ý cho CHT" aria-label="Ghi chú quản lý cấp trên"></textarea>
        <div><button class="btn sm" type="button" :disabled="busy || note === v.meta.managerNote" @click="saveNote">Lưu ghi chú</button></div>
      </template>
      <div v-else class="sm pre" :class="{ mut: !v.meta.managerNote }">{{ v.meta.managerNote || 'Chưa có ghi chú.' }}</div>
    </div>

    <template v-if="ov">
      <div v-if="ov.run.acknowledged" class="alert ok">
        <div><b>{{ ov.run.ackByName }}</b> đã đọc và xác nhận hiểu mục tiêu tuần đầu lúc {{ fmtDateTime(ov.run.ackAt) }}.</div>
      </div>
      <div v-else-if="ov.canAck" class="card pad stack hl">
        <div class="h2">Xác nhận đã đọc</div>
        <div class="mut">Đọc mục tiêu và lưu ý ở trên trước khi bắt đầu. Sau khi xác nhận, checklist tuần đầu được mở.</div>
        <div><button class="btn pri" type="button" @click="ack">Tôi đã đọc và hiểu</button></div>
      </div>
      <div v-else class="alert"><div>Cửa hàng trưởng chưa xác nhận đã đọc tổng quan.</div></div>
    </template>
  </div>
</template>
