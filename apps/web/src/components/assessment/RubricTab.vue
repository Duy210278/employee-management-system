<script setup lang="ts">
import { scoreObservation } from '@lotrinh/shared';
import { computed, reactive, ref, toRef, watch } from 'vue';
import { assessmentApi, useMutate, useObservations } from '@/api/queries';
import { useToast } from '@/composables/toast';
import { fmtDate } from '@/format';
import Icon from '../Icon.vue';

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

const preview = computed(() => (data.value ? scoreObservation(data.value.rubric, form.scores) : null));
const summaryTone = computed(() => {
  const s = data.value?.summary;
  if (!s?.count) return '';
  return s.meetsTarget === null ? 'info' : s.meetsTarget ? 'ok' : 'warn';
});
const describe = (c: { d1: string; d2: string; d3: string }, v: number) => [c.d1, c.d2, c.d3][v - 1] ?? '';
/** Màu điểm từng tiêu chí: điểm tối đa xanh, 1 điểm đỏ */
const scoreTone = (v: number | undefined) => (v === undefined ? '' : v === 1 ? 'bad' : v >= (data.value?.rubric.scaleMax ?? 3) ? 'ok' : '');

// Bảng các ca đã quan sát: bấm dòng hoặc mũi tên để xem điểm từng tiêu chí
const opened = reactive(new Set<number>());
const toggle = (id: number) => (opened.has(id) ? opened.delete(id) : opened.add(id));

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
      <table v-if="data.items.length" class="rt click ck obs">
        <thead>
          <tr>
            <th>Ngày quan sát</th>
            <th>Người đánh giá</th>
            <th>Điểm</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="o in data.items" :key="o.id">
            <tr :class="{ on: opened.has(o.id) }" @click="toggle(o.id)">
              <td data-l="Ngày quan sát" class="nowrap b">{{ fmtDate(o.date) }}</td>
              <td data-l="Người đánh giá">{{ o.observerName }}</td>
              <td data-l="Điểm" class="nowrap">{{ o.total }}/{{ o.max }}</td>
              <td data-l="Trạng thái">
                <div><span class="pill" :class="o.passed ? 'ok' : 'bad'">{{ o.passed ? 'Đạt' : 'Chưa đạt' }}</span></div>
                <div v-if="o.ones.length" class="sm bad-text">1 điểm: {{ o.ones.join(', ') }}</div>
              </td>
              <td class="ck-tog">
                <button
                  class="btn ghost sm"
                  type="button"
                  :aria-expanded="opened.has(o.id)"
                  :aria-label="(opened.has(o.id) ? 'Thu gọn ca ' : 'Xem điểm ca ') + fmtDate(o.date)"
                  @click.stop="toggle(o.id)"
                >
                  <Icon class="caret" name="chevron" />
                </button>
              </td>
            </tr>
            <tr v-if="opened.has(o.id)" class="ck-more">
              <td colspan="5">
                <div class="more">
                  <section class="more-box">
                    <h4>Điểm từng tiêu chí</h4>
                    <div v-for="c in data.rubric.criteria" :key="c.key" class="obs-row">
                      <span><b>{{ c.name }}</b> <span v-if="c.critical" class="pill bad">Trọng yếu</span></span>
                      <span class="pill" :class="scoreTone(o.scores[c.key])">{{ o.scores[c.key] ?? '—' }}/{{ data.rubric.scaleMax }}</span>
                      <span class="mut">{{ describe(c, o.scores[c.key] ?? 0) }}</span>
                    </div>
                  </section>
                  <section v-if="o.note" class="more-box">
                    <h4>Nhận xét</h4>
                    <div>{{ o.note }}</div>
                  </section>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <div v-else class="empty">Chưa có ca quan sát nào.</div>
    </div>
    <div v-if="data.summary.meetsTarget === null && data.summary.count" class="sm mut">
      Cần ít nhất {{ data.rubric.minObsPerMonth }} ca để kết luận tỉ lệ tư vấn đạt so với mục tiêu {{ data.rubric.targetRate }}%.
    </div>

    <!-- Bảng Rubric như ở trang Khung năng lực, theo phiên bản của lượt Level này -->
    <div class="card pad stack">
      <div class="h2">Rubric quan sát tư vấn (dùng chung mọi Level)</div>
      <div class="sm mut">
        Ca đạt khi tổng ≥ {{ data.rubric.passTotal }}/{{ data.rubric.criteria.length * data.rubric.scaleMax }}<template v-if="data.rubric.forbidOne"> và không tiêu chí nào 1 điểm</template>.
        Tối thiểu {{ data.rubric.minObsPerMonth }} ca/tháng, mục tiêu {{ data.rubric.targetRate }}% ca đạt.
      </div>
      <div class="tw">
        <table>
          <thead>
            <tr><th>Tiêu chí</th><th>1 điểm</th><th>2 điểm</th><th>3 điểm</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in data.rubric.criteria" :key="c.key">
              <td><b>{{ c.name }}</b> <span v-if="c.critical" class="pill bad">Trọng yếu</span></td>
              <td class="sm">{{ c.d1 }}</td>
              <td class="sm">{{ c.d2 }}</td>
              <td class="sm">{{ c.d3 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
