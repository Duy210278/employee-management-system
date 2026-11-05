<script setup lang="ts">
import { kpiRule, reviewFormOf, ROLE_SHORT } from '@lotrinh/shared';
import { computed, ref } from 'vue';
import { useFramework, useMe } from '@/api/queries';
import { usePageHeader } from '@/composables/pageHeader';
import GppModules from '@/components/GppModules.vue';
import { fmtDate } from '@/format';

/**
 * Khung năng lực của phiên bản đang hiệu lực, chỉ xem (mục 4.3).
 * Chỉ BP Đào tạo sửa được, qua "Thiết kế lộ trình" → bản nháp → duyệt → ban hành.
 */
const { data: me } = useMe();
const { data: fw, isLoading, error } = useFramework();
const levelKey = ref(1);
const level = computed(() => fw.value?.levels.find((l) => l.key === levelKey.value));
const rule = computed(() => (level.value ? kpiRule(level.value) : null));
const form = computed(() => (level.value ? reviewFormOf(level.value) : null));
const refYear = computed(() => Number(fw.value?.today.slice(0, 4) ?? 0));
/** Đoạn giới thiệu: các đoạn liền nhau bắt đầu bằng "- " gộp thành một danh sách gạch đầu dòng */
const introBlocks = computed(() => {
  const out: { list: boolean; lines: string[] }[] = [];
  for (const raw of fw.value?.framework?.intro ?? []) {
    const m = /^\s*[-•]\s+/.exec(raw);
    const line = m ? raw.slice(m[0].length) : raw;
    const last = out[out.length - 1];
    if (m && last?.list) last.lines.push(line);
    else out.push({ list: !!m, lines: [line] });
  }
  return out;
});
usePageHeader(() =>
  fw.value ? { desc: `Bộ lộ trình v${fw.value.versionCode}${fw.value.effectiveFrom ? ` · hiệu lực từ ${fmtDate(fw.value.effectiveFrom, refYear.value)}` : ''}` } : null,
);
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải Khung năng lực…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="fw" class="page">
    <Teleport defer to="#page-actions">
      <RouterLink v-if="me?.user.role === 'bp'" class="btn" to="/thiet-ke">Sửa trong Thiết kế lộ trình</RouterLink>
    </Teleport>
    <div class="alert info">
      <div>Chỉ xem. BP Đào tạo là bộ phận duy nhất sửa Khung năng lực: mọi thay đổi đi qua bản nháp, được duyệt và ban hành thành phiên bản mới.</div>
    </div>

    <template v-if="fw.framework">
      <div class="card pad stack">
        <template v-for="(b, i) in introBlocks" :key="i">
          <ul v-if="b.list" class="ul">
            <li v-for="(x, j) in b.lines" :key="j">{{ x }}</li>
          </ul>
          <p v-else>{{ b.lines[0] }}</p>
        </template>
      </div>
      <div v-for="[t, rows] in ([['Định nghĩa Level', fw.framework.levelTable], ['Trách nhiệm ba bên', fw.framework.responsibilityTable], ['Chỉ tiêu doanh số theo Level', fw.framework.kpiTable]] as const)" :key="t" class="card pad stack">
        <div class="h2">{{ t }}</div>
        <div class="tw">
          <table>
            <thead>
              <tr><th v-for="(h, i) in rows[0]" :key="i">{{ h }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(row, r) in rows.slice(1)" :key="r"><td v-for="(c, i) in row" :key="i">{{ c || '—' }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <div class="sec">Chi tiết theo Level</div>
    <div class="seg self-start" role="tablist" aria-label="Chọn Level">
      <button
        v-for="l in fw.levels"
        :key="l.key"
        type="button"
        role="tab"
        :aria-current="levelKey === l.key"
        :aria-selected="levelKey === l.key"
        @click="levelKey = l.key"
      >
        Level {{ l.key }} · {{ l.name }}
      </button>
    </div>

    <template v-if="level && rule && form">
      <div class="card pad stack">
        <div class="eyebrow">
          Level {{ level.key }} · {{ level.durationLabel }} ({{ level.rangeLabel }}) · Giai đoạn {{ level.phase }}
        </div>
        <div class="h1">{{ level.name }}: “{{ level.motto }}”</div>
        <div class="rowf sm">
          <span class="pill">{{ level.totalDays }} ngày</span>
          <span class="pill">{{ level.stageCount }} giai đoạn</span>
          <span class="pill">{{ level.itemCount }} đầu việc ({{ level.checklistName }})</span>
        </div>
      </div>

      <div class="card pad stack">
        <div class="h2">Mục tiêu</div>
        <ol class="ul ol">
          <li v-for="(g, i) in level.overview.goals" :key="i"><b v-if="g.title">{{ g.title }}: </b>{{ g.body }}</li>
        </ol>
      </div>

      <div class="grid g3">
        <div v-for="(r, i) in level.overview.responsibilities" :key="i" class="card pad stack">
          <b>{{ r.heading }}</b>
          <ul class="ul"><li v-for="(x, j) in r.items" :key="j">{{ x }}</li></ul>
        </div>
      </div>

      <div class="card pad stack">
        <div class="h2">Chỉ tiêu doanh số</div>
        <div class="rowf sm">
          <span>DS tổng <b>{{ level.kpi.total }}</b> tr/tháng</span>
          <span>DS hệ số 1 <b>{{ level.kpi.coef1 }}</b> tr/tháng</span>
          <span>Tỉ trọng H.số 1 <b>{{ level.kpi.ratio }}%</b></span>
        </div>
        <div class="sm mut">
          Cách xét: {{ rule.method === 'all_months' ? 'mọi tháng' : 'trung bình các tháng' }} từ tháng {{ rule.windowFrom }} đến tháng {{ rule.windowTo }} của Level
          phải đạt cả DS tổng và DS hệ số 1.
        </div>
        <div v-if="level.overview.kpiTable.length > 1" class="tw">
          <table>
            <thead>
              <tr><th v-for="(h, i) in level.overview.kpiTable[0]" :key="i">{{ h }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(row, r) in level.overview.kpiTable.slice(1)" :key="r"><td v-for="(c, i) in row" :key="i">{{ c || '—' }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid g2">
        <div class="card pad stack">
          <div class="h2">Nhiệm vụ trên LMS</div>
          <ul class="ul chk-ul"><li v-for="(x, i) in level.overview.lms" :key="i">{{ x }}</li></ul>
        </div>
        <div class="card pad stack">
          <div class="h2">Xác nhận tại quầy</div>
          <ul class="ul chk-ul"><li v-for="(x, i) in level.overview.counter" :key="i">{{ x }}</li></ul>
        </div>
      </div>

      <div class="card pad stack">
        <div class="h2">Phiếu đánh giá tổng kết</div>
        <div v-if="level.reviewCriteria.length" class="tw">
          <table>
            <thead>
              <tr><th>Tiêu chí</th><th>Ngưỡng đạt</th><th>Nguồn dữ liệu</th></tr>
            </thead>
            <tbody>
              <tr v-for="(c, i) in level.reviewCriteria" :key="i"><td>{{ c.name }}</td><td>{{ c.threshold }}</td><td class="sm mut">{{ c.source || '—' }}</td></tr>
            </tbody>
          </table>
        </div>
        <ul class="ul sm">
          <li v-for="p in form.prompts" :key="p.key">{{ p.text }}<template v-if="p.minPoints"> (tối thiểu {{ p.minPoints }} ý)</template></li>
        </ul>
        <div class="sm">
          Kết quả: <b>{{ form.passLabel }}</b>
          <template v-if="form.extension.enabled"> · Gia hạn {{ form.extension.months }} tháng, tối đa {{ form.extension.maxTimes }} lần</template>
          <template v-if="form.allowFail"> · Không đạt (đóng lượt)</template>
        </div>
        <div class="rowf sm tight">
          Chuỗi ký:
          <span v-for="(r, i) in form.signers" :key="r" class="rl" :class="r">{{ i + 1 }}. {{ ROLE_SHORT[r] }}</span>
        </div>
      </div>
    </template>

    <GppModules />

    <div class="card pad stack">
      <div class="h2">Phụ lục C. Rubric quan sát tư vấn (dùng chung mọi Level)</div>
      <div class="sm mut">
        Ca đạt khi tổng ≥ {{ fw.rubric.passTotal }}/{{ fw.rubric.criteria.length * fw.rubric.scaleMax }}<template v-if="fw.rubric.forbidOne"> và không tiêu chí nào 1 điểm</template>.
        Tối thiểu {{ fw.rubric.minObsPerMonth }} ca/tháng, mục tiêu {{ fw.rubric.targetRate }}% ca đạt.
      </div>
      <div class="tw">
        <table>
          <thead>
            <tr><th>Tiêu chí</th><th>1 điểm</th><th>2 điểm</th><th>3 điểm</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in fw.rubric.criteria" :key="c.key">
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
