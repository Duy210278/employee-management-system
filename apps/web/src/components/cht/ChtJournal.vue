<script setup lang="ts">
import type { ChtJournalBodyT, ChtJournalRow } from '@lotrinh/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { reactive, ref, toRef, watch } from 'vue';
import { chtApi, useChtOnboarding } from '@/api/queries';
import { useToast } from '@/composables/toast';
import { fmtDate, fmtDateTime } from '@/format';

/** Nhật ký theo dõi hằng ngày (tab "Nhật ký theo dõi" của file Excel): Đào tạo ghi sau mỗi lần check-in, quản lý đọc và ghi chú */
const props = defineProps<{ runId: number; refYear: number }>();
const qc = useQueryClient();
const toast = useToast();
const { data: v, isLoading, error } = useChtOnboarding(toRef(() => props.runId));
const drafts = reactive<Record<number, { mood: string; difficulties: string; actions: string; managerNote: string }>>({});
const busy = ref<number | null>(null);

const draftOf = (r: ChtJournalRow) => ({ mood: r.mood ?? '', difficulties: r.difficulties, actions: r.actions, managerNote: r.managerNote });
watch(
  v,
  (val) => {
    for (const r of val?.journal ?? []) drafts[r.day] = draftOf(r);
  },
  { immediate: true },
);
const changed = (r: ChtJournalRow) => JSON.stringify(drafts[r.day]) !== JSON.stringify(draftOf(r));

async function save(r: ChtJournalRow) {
  const d = drafts[r.day];
  const perm = v.value!.permissions;
  const body: ChtJournalBodyT = {};
  if (perm.journal && (d.mood !== (r.mood ?? '') || d.difficulties !== r.difficulties || d.actions !== r.actions)) {
    Object.assign(body, { mood: d.mood || null, difficulties: d.difficulties, actions: d.actions });
  }
  if (perm.managerNote && d.managerNote !== r.managerNote) body.managerNote = d.managerNote;
  busy.value = r.day;
  try {
    qc.setQueryData(['cht', props.runId], await chtApi.journal(props.runId, r.day, body));
    toast.show(`Đã lưu nhật ký ${r.label}`);
  } catch (err) {
    toast.show((err as Error).message);
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="v" class="stack">
    <div class="sm mut">Đào tạo ghi sau mỗi lần check-in cuối ngày · Quản lý đọc để nắm tình trạng CHT và ghi chú.</div>
    <div v-for="r in v.journal" :key="r.day" class="card pad stack">
      <div class="rowf sp">
        <b>{{ r.label }} · {{ fmtDate(r.date, refYear) }}</b>
        <span class="sm mut">
          <template v-if="r.updatedByName">Đào tạo: {{ r.updatedByName }} · {{ fmtDateTime(r.updatedAt) }}</template>
          <template v-if="r.managerByName"> · Quản lý: {{ r.managerByName }} · {{ fmtDateTime(r.managerAt) }}</template>
          <template v-if="!r.updatedByName && !r.managerByName">Chưa ghi</template>
        </span>
      </div>
      <div class="form">
        <label class="f">
          Cảm xúc CHT
          <select v-model="drafts[r.day].mood" :disabled="!v.permissions.journal">
            <option value="">–</option>
            <option v-for="m in v.moods" :key="m" :value="m">{{ m }}</option>
          </select>
        </label>
        <label class="f">Khó khăn / Thắc mắc ghi nhận<textarea v-model="drafts[r.day].difficulties" rows="2" :disabled="!v.permissions.journal"></textarea></label>
        <label class="f">Hành động hỗ trợ đã thực hiện<textarea v-model="drafts[r.day].actions" rows="2" :disabled="!v.permissions.journal"></textarea></label>
        <label class="f">Ghi chú quản lý<textarea v-model="drafts[r.day].managerNote" rows="2" :disabled="!v.permissions.managerNote"></textarea></label>
      </div>
      <div v-if="v.permissions.journal || v.permissions.managerNote">
        <button class="btn sm pri" type="button" :disabled="busy !== null || !changed(r)" @click="save(r)">Lưu {{ r.label }}</button>
      </div>
    </div>
    <div v-if="!v.permissions.journal && !v.permissions.managerNote" class="sm mut">
      {{ v.runStatus === 'passed' ? 'Đã xác nhận tổng kết tuần đầu: nhật ký chỉ xem.' : 'Đào tạo (BP ĐT) ghi nhật ký; QLKV phụ trách ghi chú quản lý.' }}
    </div>
  </div>
</template>
