<script setup lang="ts">
import { countPoints, outcomeStep, reviewProblems, type CriterionResult, type ReviewResult } from '@lotrinh/shared';
import { computed, reactive, ref, toRef, watch } from 'vue';
import { assessmentApi, useMutate, useReview } from '@/api/queries';
import { fmtDate, fmtDateTime, yearOf } from '@/format';

/** Tab Chuyển Level (mục 11.5, theo promoTab của N3): số liệu tự động, phiếu đánh giá, chuỗi ký */
const props = defineProps<{ runId: number }>();
const { data, isLoading, error } = useReview(toRef(() => props.runId));
const mutate = useMutate();
const busy = ref(false);

const draft = reactive({ criteria: [] as CriterionResult[], notes: {} as Record<string, string>, result: '' as ReviewResult | '', goals: '' });
// Nạp lại bản điền khi máy chủ trả phiếu mới (sau khi lưu, ký, hoặc mở vòng gia hạn)
watch(
  () => [data.value?.review.rowVersion, data.value?.round, data.value?.review.status, props.runId],
  () => {
    const r = data.value?.review;
    if (!r) return;
    draft.criteria = [...r.criteria];
    draft.notes = { ...r.notes };
    draft.result = r.result ?? '';
    draft.goals = r.goals;
  },
  { immediate: true },
);

const d = computed(() => data.value!);
const refYear = computed(() => (data.value ? yearOf(data.value.today) : new Date().getFullYear()));
const passed = computed(() => draft.criteria.filter((c) => c === 'pass').length);
const dirty = computed(() => {
  const r = data.value?.review;
  if (!r) return false;
  return JSON.stringify([draft.criteria, draft.notes, draft.result || null, draft.goals]) !== JSON.stringify([r.criteria, r.notes, r.result, r.goals]);
});
const kpiTone = computed(() => ({ pass: 'ok', fail: 'bad', missing: '' })[d.value.auto.kpi.state]);
/** Kiểm tra R13, R14 ngay trên bản đang điền (máy chủ kiểm tra lại khi ký) */
const problems = computed(() =>
  reviewProblems(d.value.form, { criteria: draft.criteria, notes: draft.notes, result: draft.result || null, goals: draft.goals }, d.value.extCount),
);
const outcomeIdx = computed(() => outcomeStep(d.value.form.signers));

async function save() {
  busy.value = true;
  await mutate(
    () =>
      assessmentApi.saveReview(props.runId, {
        criteria: draft.criteria,
        notes: draft.notes,
        result: draft.result || null,
        goals: draft.goals,
        rowVersion: d.value.review.rowVersion,
      }),
    'Đã lưu phiếu',
  );
  busy.value = false;
}

async function sign(step: number) {
  if (dirty.value) {
    await save();
  }
  if (step === outcomeIdx.value) {
    const r = d.value.review.result;
    const what = r === 'pass' ? (d.value.level.key < 4 ? `chuyển nhân viên lên Level ${d.value.level.key + 1} ngay hôm nay` : 'ghi nhận đạt chuẩn Level 4') : r === 'extend' ? `gia hạn Level thêm ${d.value.form.extension.months} tháng` : 'đóng lượt với kết quả Không đạt';
    if (!confirm(`Ký bước này sẽ ${what}. Tiếp tục?`)) return;
  }
  busy.value = true;
  await mutate(() => assessmentApi.signReview(props.runId, step), 'Đã ký');
  busy.value = false;
}
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải phiếu…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="data" class="stack">
    <div class="grid g4">
      <div class="card stat"><b>{{ Math.round(d.auto.checklist.pct * 100) }}%</b><span>Checklist ({{ d.auto.checklist.done }}/{{ d.auto.checklist.total }})</span></div>
      <div class="card stat" :class="{ bad: d.auto.overdue }"><b>{{ d.auto.overdue }}</b><span>Mục đang trễ hạn</span></div>
      <div class="card stat"><b>{{ d.auto.rubric.rate === null ? '—' : `${d.auto.rubric.rate}%` }}</b><span>Ca Rubric đạt ({{ d.auto.rubric.count }} ca)</span></div>
      <div class="card stat" :class="{ bad: kpiTone === 'bad' }"><b class="txt">{{ d.auto.kpi.label }}</b><span>Doanh số</span></div>
    </div>

    <div v-if="d.outcome" class="alert ok"><div><b>{{ d.outcome }}</b></div></div>
    <div v-if="!d.isOpen" class="alert info">
      <div>Phiếu đánh giá Level {{ d.level.key }} mở từ <b>{{ fmtDate(d.opensOn, refYear) }}</b> (ngày mở giai đoạn cuối).</div>
    </div>
    <div v-else-if="d.auto.checklist.pct < 1 && d.run.status === 'active' && !d.outcome" class="alert">
      <div>Còn <b>{{ d.auto.checklist.total - d.auto.checklist.done }}</b> mục checklist chưa hoàn thành. Nên hoàn tất trước khi đề xuất chuyển Level.</div>
    </div>
    <div v-for="h in d.history" :key="h.round" class="alert info">
      <div>Vòng {{ h.round + 1 }}: <b>{{ d.resultLabels[h.result ?? 'extend'] }}</b><template v-if="h.goals"> · mục tiêu: {{ h.goals.split('\n').join('; ') }}</template></div>
    </div>

    <div class="card pad stack">
      <div class="h2">
        Phiếu đánh giá tổng kết Level {{ d.level.key }}<template v-if="d.round"> · vòng gia hạn {{ d.round }}</template>
      </div>
      <div class="sm mut">{{ d.form.flow }}</div>
      <div class="tw">
        <table>
          <thead>
            <tr><th>Tiêu chí</th><th>Ngưỡng đạt</th><th>Nguồn dữ liệu</th><th>Kết quả</th></tr>
          </thead>
          <tbody>
            <tr v-for="(c, i) in d.criteria" :key="i">
              <td>{{ c.name }}</td>
              <td>{{ c.threshold }}</td>
              <td class="sm mut pre">{{ c.source }}</td>
              <td>
                <select v-model="draft.criteria[i]" :disabled="!d.canEdit" :aria-label="c.name">
                  <option value="">—</option>
                  <option value="pass">Đạt</option>
                  <option value="fail">Chưa đạt</option>
                </select>
                <div v-if="d.suggestions[i]" class="sm" :class="d.suggestions[i]!.value === 'pass' ? 'ok-text' : 'bad-text'">
                  Gợi ý: {{ d.suggestions[i]!.value === 'pass' ? 'Đạt' : 'Chưa đạt' }} · {{ d.suggestions[i]!.reason }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <span class="pill self-start" :class="{ ok: d.criteria.length > 0 && passed === d.criteria.length }">{{ passed }}/{{ d.criteria.length }} tiêu chí đạt</span>

      <label v-for="p in d.form.prompts" :key="p.key" class="f">
        <span class="rowf sp">
          <span>{{ p.text }}</span>
          <span v-if="p.minPoints" class="pill" :class="countPoints(draft.notes[p.key] ?? '') >= p.minPoints ? 'ok' : 'warn'">
            {{ countPoints(draft.notes[p.key] ?? '') }}/{{ p.minPoints }} ý
          </span>
        </span>
        <textarea v-model="draft.notes[p.key]" rows="3" :disabled="!d.canEdit" placeholder="Mỗi ý một dòng"></textarea>
      </label>

      <label class="f w-md">
        Kết quả đề xuất
        <select v-model="draft.result" :disabled="!d.canEdit">
          <option value="">Chọn kết quả</option>
          <option value="pass">{{ d.resultLabels.pass }}</option>
          <option v-if="d.form.extension.enabled" value="extend">{{ d.resultLabels.extend }} ({{ d.form.extension.months }} tháng)</option>
          <option v-if="d.form.allowFail" value="fail">{{ d.resultLabels.fail }}</option>
        </select>
      </label>
      <template v-if="draft.result === 'extend'">
        <label class="f">
          <span class="rowf sp">
            <span>Mục tiêu cần đạt trong thời gian gia hạn (tối đa {{ d.form.extension.maxGoals }} mục)</span>
            <span class="pill" :class="countPoints(draft.goals) && countPoints(draft.goals) <= d.form.extension.maxGoals ? 'ok' : 'warn'">
              {{ countPoints(draft.goals) }}/{{ d.form.extension.maxGoals }}
            </span>
          </span>
          <textarea v-model="draft.goals" rows="3" :disabled="!d.canEdit" placeholder="Mỗi mục tiêu một dòng"></textarea>
        </label>
        <div class="sm mut">Đã gia hạn {{ d.extCount }}/{{ d.form.extension.maxTimes }} lần.</div>
      </template>

      <ul v-if="problems.length && d.isOpen && d.review.status === 'draft'" class="ie-issues">
        <li v-for="p in problems" :key="p" class="warning">{{ p }}</li>
      </ul>
      <div v-if="d.canEdit" class="rowf">
        <button class="btn" type="button" :disabled="busy || !dirty" @click="save">Lưu phiếu</button>
        <span v-if="d.review.savedAt" class="sm mut">Lưu lần cuối: {{ d.review.savedByName }} · {{ fmtDateTime(d.review.savedAt) }}</span>
      </div>
      <div v-else-if="d.isOpen && d.review.status === 'draft' && d.run.status === 'active'" class="sm mut">
        {{ d.level.key === 1 ? 'Buddy, CHT phụ trách hoặc BP Đào tạo điền phiếu.' : 'CHT phụ trách hoặc BP Đào tạo điền phiếu.' }}
      </div>
    </div>

    <div class="card clip">
      <div class="stg"><b>Chuỗi ký</b><span class="sm mut">Ký theo thứ tự; bước sau mở khi bước trước đã ký</span></div>
      <div v-for="s in d.steps" :key="s.step" class="item rowf sp">
        <div>
          <b>{{ s.step + 1 }}. {{ s.label }}</b>
          <span v-if="s.step === outcomeIdx" class="pill info">áp dụng kết quả</span>
          <div class="sm mut">
            <template v-if="s.signedByName">{{ s.signedByName }} · {{ fmtDateTime(s.at) }}</template>
            <template v-else-if="s.state === 'next'">Đến lượt ký</template>
            <template v-else>Chưa đến lượt</template>
          </div>
        </div>
        <span v-if="s.state === 'signed'" class="pill ok">Đã ký</span>
        <button
          v-else-if="s.canSign"
          class="btn pri sm"
          type="button"
          :disabled="busy || (s.step === 0 && problems.length > 0)"
          :title="s.step === 0 && problems.length ? problems[0] : ''"
          @click="sign(s.step)"
        >
          Ký xác nhận
        </button>
        <span v-else class="pill">{{ s.state === 'next' ? 'Chờ ký' : 'Chưa đến lượt' }}</span>
      </div>
    </div>
  </div>
</template>
