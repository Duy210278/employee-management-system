<script setup lang="ts">
import { runTitle } from '@lotrinh/shared';
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMe, useStaffProfile } from '@/api/queries';
import ReviewTab from '@/components/assessment/ReviewTab.vue';
import ChtEvaluation from '@/components/cht/ChtEvaluation.vue';
import ChtJournal from '@/components/cht/ChtJournal.vue';
import ChtOverview from '@/components/cht/ChtOverview.vue';
import RubricTab from '@/components/assessment/RubricTab.vue';
import SalesTab from '@/components/assessment/SalesTab.vue';
import LevelOverview from '@/components/LevelOverview.vue';
import PathBar from '@/components/PathBar.vue';
import RoleChip from '@/components/RoleChip.vue';
import RunManagePanel from '@/components/RunManagePanel.vue';
import StageChecklist from '@/components/StageChecklist.vue';
import { fmtDate, yearOf } from '@/format';

/** Hồ sơ nhân viên (mục 11.5); "Lộ trình của tôi" là chế độ xem của chính NV */
const route = useRoute();
const router = useRouter();
const { data: me } = useMe();
const isMine = computed(() => route.name === 'mine');
const staffId = computed<number | null>(() => (isMine.value ? (me.value?.staffId ?? null) : Number(route.params.id)));
const { data: p, isLoading, error } = useStaffProfile(staffId);

const refYear = computed(() => (p.value ? yearOf(p.value.today) : new Date().getFullYear()));
const run = computed(() => p.value?.run ?? null);
const pct = computed(() => Math.round((run.value?.progress.pct ?? 0) * 100));
const hasRed = computed(() => !!p.value?.alerts.some((a) => a.severity === 'red'));

type Tab = 'over' | 'check' | 'sales' | 'rubric' | 'review' | 'cht-journal' | 'cht-review' | 'history' | 'manage';

/** Bộ chọn Level để xem lại các Level đã qua (mục 11.5); mặc định lượt hiện tại. Lưu trên URL để mở thẳng từ "Chữ ký chờ bạn" */
const selectedRunId = computed(() => {
  const q = Number(route.query.run);
  return p.value?.history.some((h) => h.runId === q) ? q : (run.value?.id ?? null);
});
const selected = computed(() => p.value?.history.find((h) => h.runId === selectedRunId.value) ?? null);
/** Lượt onboarding CHT có nhật ký và đánh giá tuần đầu thay cho doanh số, Rubric, phiếu chuyển Level */
const selectedCht = computed(() => (selected.value?.track ?? run.value?.track ?? 'nvbh') !== 'nvbh');
const tabs = computed<{ key: Tab; label: string }[]>(() => [
  { key: 'over', label: 'Tổng quan' },
  { key: 'check', label: 'Checklist' },
  ...(selectedCht.value
    ? [
        { key: 'cht-journal' as const, label: 'Nhật ký theo dõi' },
        { key: 'cht-review' as const, label: 'Đánh giá tuần đầu' },
      ]
    : [
        { key: 'sales' as const, label: 'Doanh số' },
        { key: 'rubric' as const, label: 'Quan sát Rubric' },
        { key: 'review' as const, label: 'Chuyển Level' },
      ]),
  { key: 'history', label: 'Lịch sử lượt' },
  // Đổi phân công, tạm dừng, chuyển cửa hàng, ngừng theo dõi (mục 9.3): CHT, QLKV trong phạm vi, BP ĐT
  ...(p.value?.canManage ? [{ key: 'manage' as const, label: 'Phân công & tạm dừng' }] : []),
]);

const viewingCurrent = computed(() => selectedRunId.value === run.value?.id);
/** NV phải đọc Tổng quan của lượt hiện tại trước khi các tab khác mở (mục 9.4) */
const gated = computed(() => !!p.value?.isSelf && viewingCurrent.value && !!run.value && !run.value.acknowledged);
const tab = computed<Tab>(() => {
  if (gated.value) return 'over';
  const q = route.query.tab as Tab;
  return tabs.value.some((t) => t.key === q) ? q : 'check';
});
function go(query: { tab?: Tab; run?: number }) {
  void router.replace({ query: { ...route.query, ...query } });
}
// Vừa xác nhận đã đọc thì chuyển sang Checklist
watch(gated, (g, was) => {
  if (was && !g) go({ tab: 'check' });
});
const STATUS_LABEL: Record<string, string> = {
  active: 'Đang chạy',
  paused: 'Tạm dừng',
  review: 'Chờ đánh giá',
  passed: 'Đạt',
  extended: 'Gia hạn',
  failed: 'Không đạt',
  stopped: 'Dừng',
  promoted: 'Thăng chức CHT',
};
</script>

<template>
  <div class="stack">
    <div v-if="!isMine"><RouterLink class="btn sm" to="/nhan-su">← Danh sách nhân sự</RouterLink></div>

    <div v-if="isMine && me && !me.staffId" class="card empty">
      <h3>Hồ sơ của bạn chưa được tạo</h3>
      <div>Nhờ Cửa hàng trưởng hoặc BP Đào tạo tạo hồ sơ nhân viên và gắn với tài khoản của bạn.</div>
    </div>
    <div v-else-if="isLoading" class="card empty">Đang tải hồ sơ…</div>
    <div v-else-if="error" class="card pad stack">
      <div class="alert bad"><div>{{ error.message }}</div></div>
      <div class="sm mut">Bạn chỉ xem được hồ sơ trong phạm vi cửa hàng, khu vực được gán hoặc nhân viên mình phụ trách.</div>
    </div>

    <template v-else-if="p && run && p.level">
      <div class="card pad stack">
        <div class="rowf sp">
          <div>
            <div class="h1">{{ p.staff.fullName }}</div>
            <div class="sm mut">
              <template v-if="p.staff.employeeCode">{{ p.staff.employeeCode }} · </template>{{ p.staff.storeName }} · {{ p.staff.areaName }} · Nhận việc
              {{ fmtDate(p.staff.hireDate, refYear) }}
              <template v-if="p.staff.accountEmail"> · {{ p.staff.accountEmail }}</template>
              <template v-else> · chưa có tài khoản</template>
            </div>
          </div>
          <div class="rowf">
            <span class="pill info">
              {{ runTitle(run) }} ·
              {{ run.dayIndex < 0 ? `bắt đầu ${fmtDate(run.startDate, refYear)}` : `ngày ${run.dayIndex + 1}/${p.level.totalDays}` }}
            </span>
            <span class="pill" :class="run.acknowledged ? 'ok' : 'warn'">{{ run.acknowledged ? 'Đã đọc tổng quan' : 'Chưa đọc tổng quan' }}</span>
            <span class="pill">{{ p.level.checklistName }} v{{ run.versionCode }}</span>
          </div>
        </div>
        <div v-if="run.track === 'nvbh'" class="rowf sm">
          <span><RoleChip role="buddy" /> {{ p.people.buddy ?? 'chưa gắn' }}</span>
          <span><RoleChip role="cht" /> {{ p.people.cht ?? 'chưa gắn' }}</span>
          <span><RoleChip role="qlkv" /> {{ p.people.qlkv ?? 'chưa gắn' }}</span>
        </div>
        <div v-else class="rowf sm">
          <span><RoleChip role="bp" :track="run.track" /> {{ p.people.trainer ?? 'chưa gắn' }}</span>
          <span><RoleChip role="qlkv" /> {{ p.people.qlkv ?? 'chưa gắn' }}</span>
          <span><RoleChip role="buddy" /> {{ p.people.buddy ?? 'không có' }}</span>
        </div>
        <PathBar v-if="p.path.length" :path="p.path" :for-staff="p.isSelf" :ref-year="refYear" />
        <div class="rowf">
          <div class="bar grow"><i :style="{ width: pct + '%' }"></i></div>
          <span class="sm mut">{{ runTitle(run) }}: {{ run.progress.done }}/{{ run.progress.total }} mục · {{ pct }}%</span>
        </div>
        <div v-if="!p.staff.active" class="alert">
          <div><b>Đã ngừng theo dõi</b><template v-if="p.staff.stopReason">: {{ p.staff.stopReason }}</template>. Dữ liệu được giữ nguyên để tra cứu.</div>
        </div>
        <div v-if="run.pause" class="alert info">
          <div>Đang <b>tạm dừng</b> {{ fmtDate(run.pause.from, refYear) }} → {{ fmtDate(run.pause.to, refYear) }}. Các mốc chưa xong đã lùi tương ứng.</div>
        </div>
        <div v-if="p.alerts.length && !p.isSelf" class="alert" :class="{ bad: hasRed }">
          <ul class="ul" style="margin: 0">
            <li v-for="a in p.alerts" :key="a.key"><span class="pill" :class="a.severity === 'red' ? 'bad' : 'warn'">{{ a.severity === 'red' ? 'Đỏ' : 'Vàng' }}</span> {{ a.message }}</li>
          </ul>
        </div>
        <div v-if="p.isSelf && run.counts.rework" class="alert bad"><div>{{ run.counts.rework }} mục đang bị yêu cầu làm lại.</div></div>
      </div>

      <div v-if="gated" class="alert">
        <div>Hãy đọc <b>Tổng quan {{ runTitle(run) }}</b> và xác nhận ở cuối trang. Các mục còn lại sẽ mở sau đó.</div>
      </div>
      <div class="rowf sp">
        <div class="sub" role="tablist">
          <button
            v-for="t in tabs"
            :key="t.key"
            type="button"
            role="tab"
            :aria-selected="tab === t.key"
            :aria-current="tab === t.key"
            :disabled="gated && t.key !== 'over'"
            @click="go({ tab: t.key })"
          >
            {{ t.label }}
          </button>
        </div>
        <div v-if="p.history.length > 1" class="sub" aria-label="Chọn Level để xem">
          <button
            v-for="h in [...p.history].reverse()"
            :key="h.runId"
            type="button"
            :aria-current="h.runId === selectedRunId"
            @click="go({ run: h.runId })"
          >
            {{ runTitle(h) }}<template v-if="h.status !== 'active'"> · {{ STATUS_LABEL[h.status] ?? h.status }}</template>
          </button>
        </div>
      </div>
      <div v-if="!viewingCurrent && selected" class="alert info">
        <div>Đang xem lại <b>{{ runTitle(selected) }}</b> ({{ fmtDate(selected.startDate, refYear) }} → {{ fmtDate(selected.plannedEnd, refYear) }}).</div>
      </div>

      <template v-if="selectedRunId !== null">
        <template v-if="tab === 'over'">
          <ChtOverview v-if="selectedCht" :key="`co${selectedRunId}`" :run-id="selectedRunId" :ref-year="refYear" />
          <LevelOverview v-else :key="`o${selectedRunId}`" :run-id="selectedRunId" :ref-year="refYear" />
        </template>
        <StageChecklist v-else-if="tab === 'check'" :key="`c${selectedRunId}`" :run-id="selectedRunId" :ref-year="refYear" />
        <SalesTab v-else-if="tab === 'sales'" :key="`s${selectedRunId}`" :run-id="selectedRunId" />
        <RubricTab v-else-if="tab === 'rubric'" :key="`r${selectedRunId}`" :run-id="selectedRunId" />
        <ReviewTab v-else-if="tab === 'review'" :key="`v${selectedRunId}`" :run-id="selectedRunId" />
        <ChtJournal v-else-if="tab === 'cht-journal'" :key="`j${selectedRunId}`" :run-id="selectedRunId" :ref-year="refYear" />
        <ChtEvaluation v-else-if="tab === 'cht-review'" :key="`e${selectedRunId}`" :run-id="selectedRunId" />
        <RunManagePanel v-else-if="tab === 'manage' && run" :key="`m${run.id}`" :run-id="run.id" :staff-id="p.staff.id" :staff-name="p.staff.fullName" :can-delete="p.canDelete" />
      </template>
      <div v-if="tab === 'history'" class="card">
        <table class="rt">
          <thead>
            <tr><th>Level</th><th>Phiên bản</th><th>Bắt đầu</th><th>Kết thúc dự kiến</th><th>Trạng thái</th></tr>
          </thead>
          <tbody>
            <tr v-for="h in p.history" :key="h.runId">
              <td data-l="Level">
                <button class="linkbtn" type="button" @click="go({ run: h.runId, tab: 'check' })"><b>{{ runTitle(h) }}</b> · {{ h.levelName }}</button>
              </td>
              <td data-l="Phiên bản">v{{ h.versionCode }}</td>
              <td data-l="Bắt đầu">{{ fmtDate(h.startDate, refYear) }}</td>
              <td data-l="Kết thúc dự kiến">{{ fmtDate(h.plannedEnd, refYear) }}</td>
              <td data-l="Trạng thái"><span class="pill">{{ STATUS_LABEL[h.status] ?? h.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
