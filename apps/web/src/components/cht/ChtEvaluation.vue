<script setup lang="ts">
import { ATTRITION_RISKS, RATING_SCALE, RISK_LABEL, type AttritionRisk } from '@lotrinh/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, reactive, ref, toRef, watch } from 'vue';
import { chtApi, useChtOnboarding, useMutate } from '@/api/queries';
import { useToast } from '@/composables/toast';
import { fmtDateTime } from '@/format';

/**
 * Đánh giá tổng kết tuần đầu (cuối tab "Nhật ký theo dõi" của file Excel): Đào tạo chấm sao từng tiêu chí,
 * đánh giá nguy cơ nghỉ việc, đề xuất hỗ trợ tuần 2; quản lý cấp trên xác nhận thì lượt onboarding hoàn thành.
 */
const props = defineProps<{ runId: number }>();
const qc = useQueryClient();
const toast = useToast();
const mutate = useMutate();
const { data: v, isLoading, error } = useChtOnboarding(toRef(() => props.runId));
const form = reactive<{ ratings: Record<string, number>; risk: AttritionRisk | ''; suggestion: string }>({ ratings: {}, risk: '', suggestion: '' });
const confirmNote = ref('');
const busy = ref(false);

watch(
  () => v.value?.evaluation,
  (e) => {
    if (!e) return;
    form.ratings = { ...e.ratings };
    form.risk = e.risk ?? '';
    form.suggestion = e.suggestion;
  },
  { immediate: true },
);
const dirty = computed(() => {
  const e = v.value?.evaluation;
  return !!e && (JSON.stringify(form.ratings) !== JSON.stringify(e.ratings) || form.risk !== (e.risk ?? '') || form.suggestion !== e.suggestion);
});

function setRating(key: string, value: string) {
  const n = Number(value);
  const next = { ...form.ratings };
  if (n) next[key] = n;
  else delete next[key];
  form.ratings = next;
}

async function save() {
  busy.value = true;
  try {
    qc.setQueryData(['cht', props.runId], await chtApi.evaluation(props.runId, { ratings: form.ratings, risk: form.risk || null, suggestion: form.suggestion }));
    toast.show('Đã lưu đánh giá tuần đầu');
  } catch (err) {
    toast.show((err as Error).message);
  } finally {
    busy.value = false;
  }
}

async function confirm() {
  if (!window.confirm('Xác nhận tổng kết tuần đầu? Lượt onboarding sẽ chuyển "Hoàn thành", nhật ký và đánh giá không sửa được nữa.')) return;
  busy.value = true;
  await mutate(() => chtApi.confirm(props.runId, confirmNote.value.trim()), 'Đã xác nhận tổng kết tuần đầu');
  busy.value = false;
}
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="v" class="stack">
    <div class="card pad stack">
      <div class="h2">Đánh giá tổng kết tuần đầu</div>
      <div v-for="r in v.ratings" :key="r.key" class="rowf sp" style="border-top: 1px solid var(--line); padding-top: 8px">
        <span>{{ r.label }}</span>
        <select :value="form.ratings[r.key] ?? ''" :disabled="!v.permissions.evaluate" :aria-label="r.label" @change="setRating(r.key, ($event.target as HTMLSelectElement).value)">
          <option value="">–</option>
          <option v-for="s in RATING_SCALE" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
      </div>
      <div class="rowf sp" style="border-top: 1px solid var(--line); padding-top: 8px">
        <span>Nguy cơ nghỉ việc (Đào tạo đánh giá)</span>
        <select v-model="form.risk" :disabled="!v.permissions.evaluate" aria-label="Nguy cơ nghỉ việc">
          <option value="">–</option>
          <option v-for="k in ATTRITION_RISKS" :key="k" :value="k">{{ RISK_LABEL[k] }}</option>
        </select>
      </div>
      <label class="f">
        Đề xuất hỗ trợ ưu tiên trong tuần 2
        <textarea v-model="form.suggestion" rows="3" :disabled="!v.permissions.evaluate"></textarea>
      </label>
      <div class="rowf sp">
        <span class="sm mut"><template v-if="v.evaluation.savedByName">Lưu bởi {{ v.evaluation.savedByName }} · {{ fmtDateTime(v.evaluation.savedAt) }}</template></span>
        <button v-if="v.permissions.evaluate" class="btn pri" type="button" :disabled="busy || !dirty" @click="save">Lưu đánh giá</button>
      </div>
    </div>

    <div v-if="v.evaluation.confirmedAt" class="alert ok">
      <div>
        <b>Xác nhận quản lý cấp trên:</b> {{ v.evaluation.confirmedByName }} · {{ fmtDateTime(v.evaluation.confirmedAt) }}
        <template v-if="v.evaluation.confirmNote"> · {{ v.evaluation.confirmNote }}</template>
      </div>
    </div>
    <div v-else-if="v.permissions.confirm" class="card pad stack" style="border-color: var(--accent)">
      <div class="h2">Xác nhận quản lý cấp trên</div>
      <ul v-if="v.problems.length" class="ul sm">
        <li v-for="p in v.problems" :key="p">Còn thiếu: {{ p.toLowerCase() }}</li>
      </ul>
      <textarea v-model="confirmNote" rows="2" placeholder="Ý kiến của quản lý (không bắt buộc)" aria-label="Ý kiến xác nhận"></textarea>
      <div><button class="btn pri" type="button" :disabled="busy || v.problems.length > 0 || dirty" @click="confirm">Xác nhận tổng kết tuần đầu</button></div>
      <div v-if="dirty" class="sm mut">Lưu đánh giá trước khi xác nhận.</div>
    </div>
    <div v-else class="alert"><div>Chờ QLKV phụ trách xác nhận tổng kết tuần đầu.</div></div>
  </div>
</template>
