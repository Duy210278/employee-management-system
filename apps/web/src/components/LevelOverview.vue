<script setup lang="ts">
import { computed, toRef } from 'vue';
import { sessionApi, useMutate, useOverview } from '@/api/queries';
import { fmtDate, fmtDateTime } from '@/format';
import RoleChip from './RoleChip.vue';

/** Tổng quan Level (mục 9.4): NV đọc và xác nhận trước khi checklist được mở */
const props = defineProps<{ runId: number; refYear: number }>();
const { data: ov, isLoading, error } = useOverview(toRef(() => props.runId));
const mutate = useMutate();

const levelKey = computed(() => ov.value?.level.key ?? 1);
const atCounter = computed(() => {
  const p = ov.value?.people;
  if (!p) return [];
  const names = levelKey.value <= 2 ? [p.buddy, p.cht] : [p.cht, p.buddy];
  return names.filter((n): n is string => !!n);
});
const resp = (i: number) => ov.value?.overview.responsibilities[i]?.items ?? [];

function ack() {
  void mutate(() => sessionApi.ack(props.runId), `Đã xác nhận. Checklist Level ${levelKey.value} đã mở`);
}
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải tổng quan…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="ov" class="stack">
    <div class="card pad stack tint">
      <div class="rowf sp">
        <div>
          <div class="eyebrow">
            Level {{ ov.level.key }} · {{ ov.level.durationLabel }} · Giai đoạn {{ ov.level.phase }}
          </div>
          <div class="h1">{{ ov.level.name }}: “{{ ov.level.motto }}”</div>
        </div>
        <div class="sm ta-r">
          Bắt đầu <b>{{ fmtDate(ov.run.startDate, refYear) }}</b><br />
          Dự kiến kết thúc <b>{{ fmtDate(ov.run.plannedEnd, refYear) }}</b>
        </div>
      </div>
      <div class="sm">
        Level được xác định bởi năng lực hành vi quan sát được, không chỉ bởi thời gian. Thời gian là điều kiện cần, năng lực là điều kiện đủ.
      </div>
    </div>

    <div class="card pad stack">
      <div class="h2">Mục tiêu bạn cần đạt ở Level {{ ov.level.key }}</div>
      <div class="sm mut">Tất cả mục tiêu là hành vi quan sát được. CHT hoặc Buddy kiểm tra trực tiếp tại quầy.</div>
      <ol class="ul ol">
        <li v-for="(g, i) in ov.overview.goals" :key="i">
          <b v-if="g.title">{{ g.title }}: </b>{{ g.body }}
        </li>
      </ol>
    </div>

    <div class="stack">
      <div class="sec">Ai theo dõi và hỗ trợ bạn</div>
      <div class="grid g3">
        <div class="card pad stack">
          <div>
            <div class="rowf"><RoleChip :role="levelKey <= 2 ? 'buddy' : 'cht'" /><RoleChip :role="levelKey <= 2 ? 'cht' : 'buddy'" /></div>
            <div class="b mt6">{{ atCounter.join(' · ') || 'Chưa được gắn' }}</div>
            <div class="sm mut">Kèm cặp và xác nhận tại quầy</div>
          </div>
          <ul class="ul"><li v-for="(x, i) in resp(0)" :key="i">{{ x }}</li></ul>
        </div>
        <div class="card pad stack">
          <div>
            <div class="rowf"><RoleChip role="qlkv" /></div>
            <div class="b mt6">{{ ov.people.qlkv ?? 'Chưa được gắn' }}</div>
            <div class="sm mut">Theo dõi hệ thống, xác nhận các mốc lớn</div>
          </div>
          <ul class="ul"><li v-for="(x, i) in resp(1)" :key="i">{{ x }}</li></ul>
        </div>
        <div class="card pad stack">
          <div>
            <div class="rowf"><RoleChip role="bp" /></div>
            <div class="b mt6">{{ ov.people.bp.join(' · ') || 'Chưa được gắn' }}</div>
            <div class="sm mut">Nội dung, LMS, kiểm tra, chứng nhận, GPP</div>
          </div>
          <ul class="ul"><li v-for="(x, i) in resp(2)" :key="i">{{ x }}</li></ul>
        </div>
      </div>
    </div>

    <div class="card pad stack">
      <div class="h2">Chỉ tiêu doanh số Level {{ ov.level.key }}</div>
      <div class="tw">
        <table>
          <thead>
            <tr><th v-for="(h, i) in ov.overview.kpiTable[0]" :key="i">{{ h }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, r) in ov.overview.kpiTable.slice(1)" :key="r">
              <td v-for="(c, i) in row" :key="i">{{ c || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="sm mut">
        <template v-if="ov.level.key === 1">Đạt ở tháng đánh giá cuối Level 1, tối thiểu 2/2 tháng đạt KPI.</template>
        <template v-else>Số liệu hằng tháng để theo dõi xu hướng. Điều kiện chính thức là kết quả TRUNG BÌNH 2 tháng cuối của Level.</template>
        Tỉ trọng H.số 1 mục tiêu: {{ ov.level.kpi.ratio }}%.
      </div>
    </div>

    <div class="grid g2">
      <div class="card pad stack">
        <div class="h2">Nhiệm vụ trên LMS (bạn tự hoàn thành)</div>
        <ul class="ul chk-ul"><li v-for="(x, i) in ov.overview.lms" :key="i">{{ x }}</li></ul>
      </div>
      <div class="card pad stack">
        <div class="h2">Xác nhận tại quầy (người khác kiểm tra)</div>
        <ul class="ul chk-ul"><li v-for="(x, i) in ov.overview.counter" :key="i">{{ x }}</li></ul>
      </div>
    </div>

    <div v-if="ov.overview.note" class="alert"><div><b>Lưu ý:</b> {{ ov.overview.note }}</div></div>

    <div v-if="ov.run.acknowledged" class="alert ok">
      <div><b>{{ ov.run.ackByName }}</b> đã đọc và xác nhận hiểu mục tiêu, nhiệm vụ Level {{ ov.level.key }} lúc {{ fmtDateTime(ov.run.ackAt) }}.</div>
    </div>
    <div v-else-if="ov.canAck" class="card pad stack hl">
      <div class="h2">Xác nhận đã đọc</div>
      <div class="mut">
        Trước khi bắt đầu từng nhiệm vụ của Level {{ ov.level.key }}, hãy đọc mục tiêu, người đồng hành và chỉ tiêu ở trên. Sau khi xác nhận, checklist được mở.
      </div>
      <div>
        <button class="btn pri" type="button" @click="ack">{{ ov.ackOnBehalf ? 'Xác nhận thay nhân viên đã đọc' : 'Tôi đã đọc và hiểu' }}</button>
      </div>
    </div>
    <div v-else class="alert"><div>Nhân viên chưa xác nhận đã đọc tổng quan Level {{ ov.level.key }}.</div></div>
  </div>
</template>
