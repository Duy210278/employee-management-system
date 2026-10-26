<script setup lang="ts">
import { scoreObservation } from '@lotrinh/shared';
import { computed, reactive, ref, toRef, watch } from 'vue';
import { assessmentApi, useMutate, useObservations } from '@/api/queries';
import { useToast } from '@/composables/toast';
import { fmtDate, yearOf } from '@/format';

/** Tab Quan sát Rubric (mục 11.5, Phụ lục C, theo obsTab của N3) */
const props = defineProps<{ runId: number }>();
const { data, isLoading, error } = useObservations(toRef(() => props.runId));
const mutate = useMutate();
const toast = useToast();
const busy = ref(false);

const form = reactive({ date: '', note: '', scores: {} as Record<string, number> });
watch(
  data,
  (d) => {
    if (!d) return;
    if (!form.date) form.date = d.today;
    for (const c of d.rubric.criteria) if (!(c.key in form.scores)) form.scores[c.key] = 2;
  },
  { immediate: true },
);

const refYear = computed(() => (data.value ? yearOf(data.value.today) : new Date().getFullYear()));
const preview = computed(() => (data.value ? scoreObservation(data.value.rubric, form.scores) : null));
const summaryTone = computed(() => {
  const s = data.value?.summary;
  if (!s?.count) return '';
  return s.meetsTarget === null ? 'info' : s.meetsTarget ? 'ok' : 'warn';
});
const describe = (c: { d1: string; d2: string; d3: string }, v: number) => [c.d1, c.d2, c.d3][v - 1] ?? '';
/** Tên ngắn của tiêu chí: hai chữ đầu ("Khai thác", "An toàn"; "Upsell / Cross-sell" → "Upsell") */
const short = (name: string) => name.split(' / ')[0].split(/\s+/).slice(0, 2).join(' ');

async function submit() {
  if (!form.date) return toast.show('Chọn ngày quan sát');
  busy.value = true;
  const res = await mutate(() => assessmentApi.addObservation(props.runId, { date: form.date, scores: { ...form.scores }, note: form.note.trim() }), 'Đã lưu ca quan sát');
  busy.value = false;
  if (res) {
    form.note = '';
    for (const k of Object.keys(form.scores)) form.scores[k] = 2;
  }
}
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="data" class="stack">
    <form v-if="data.canAdd" class="card pad stack" @submit.prevent="submit">
      <div class="h2">Ghi một ca quan sát</div>
      <div class="sm mut">
        Chọn ngẫu nhiên, không báo trước nhân viên. Đạt khi tổng ≥ {{ data.rubric.passTotal }}/{{ data.rubric.criteria.length * data.rubric.scaleMax }}
        <template v-if="data.rubric.forbidOne"> và không tiêu chí nào 1 điểm</template>. Quan sát ít nhất {{ data.rubric.minObsPerMonth }} ca/tháng.
      </div>
      <label class="f w-sm">
        Ngày quan sát
        <input v-model="form.date" type="date" :min="data.runStart" :max="data.today" required />
      </label>
      <div v-for="c in data.rubric.criteria" :key="c.key" class="rub">
        <div>
          <b>{{ c.name }}</b> <span v-if="c.critical" class="pill bad">Trọng yếu</span>
          <div class="sm mut">{{ form.scores[c.key] }} — {{ describe(c, form.scores[c.key]) }}</div>
        </div>
        <div class="score" role="radiogroup" :aria-label="c.name">
          <label v-for="v in data.rubric.scaleMax" :key="v" :title="describe(c, v)">
            <input v-model.number="form.scores[c.key]" type="radio" :name="`s-${c.key}`" :value="v" />
            <span>{{ v }}</span>
          </label>
        </div>
      </div>
      <label class="f">Nhận xét<textarea v-model="form.note" rows="2"></textarea></label>
      <div class="rowf">
        <button class="btn pri" type="submit" :disabled="busy">Lưu ca quan sát</button>
        <span v-if="preview" class="pill" :class="preview.passed ? 'ok' : 'bad'">
          {{ preview.total }}/{{ preview.max }} · {{ preview.passed ? 'Đạt' : 'Chưa đạt' }}<template v-if="preview.ones.length"> (1 điểm: {{ preview.ones.join(', ') }})</template>
        </span>
      </div>
    </form>

    <div class="card clip">
      <div class="stg">
        <b>Các ca đã quan sát</b>
        <div class="rowf">
          <span class="pill" :class="data.thisMonth >= data.rubric.minObsPerMonth ? 'ok' : 'warn'">Tháng này {{ data.thisMonth }}/{{ data.rubric.minObsPerMonth }} ca</span>
          <span class="pill" :class="summaryTone">{{ data.summary.label }}</span>
        </div>
      </div>
      <div v-for="o in data.items" :key="o.id" class="item">
        <div class="rowf sp">
          <span><b>{{ fmtDate(o.date, refYear) }}</b> · {{ o.observerName }}</span>
          <span class="pill" :class="o.passed ? 'ok' : 'bad'">{{ o.total }}/{{ o.max }} · {{ o.passed ? 'Đạt' : 'Chưa đạt' }}</span>
        </div>
        <div class="sm mut mono">{{ data.rubric.criteria.map((c) => `${short(c.name)} ${o.scores[c.key] ?? '—'}`).join(' · ') }}</div>
        <div v-if="o.note" class="sm">{{ o.note }}</div>
      </div>
      <div v-if="!data.items.length" class="empty">Chưa có ca quan sát nào.</div>
    </div>
    <div v-if="data.summary.meetsTarget === null && data.summary.count" class="sm mut">
      Cần ít nhất {{ data.rubric.minObsPerMonth }} ca để kết luận tỉ lệ tư vấn đạt so với mục tiêu {{ data.rubric.targetRate }}%.
    </div>
  </div>
</template>
