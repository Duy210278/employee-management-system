<script setup lang="ts">
import type { TaskView } from '@lotrinh/shared';
import { computed } from 'vue';
import { useToday } from '@/api/queries';
import ItemRow from '@/components/ItemRow.vue';
import LevelOverview from '@/components/LevelOverview.vue';
import PathBar from '@/components/PathBar.vue';
import { diffDays, fmtDate, givenName, yearOf } from '@/format';

/** Màn "Hôm nay" của NV (mục 11.1) */
const { data, isLoading, error } = useToday();

const today = computed(() => data.value?.today ?? '');
const refYear = computed(() => (today.value ? yearOf(today.value) : new Date().getFullYear()));
const run = computed(() => data.value?.run ?? null);
const pct = computed(() => Math.round((run.value?.progress.pct ?? 0) * 100));

const open = computed(() =>
  (data.value?.tasks ?? [])
    .filter((t) => !['done', 'na', 'void'].includes(t.status))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id),
);
const until = (t: TaskView) => diffDays(t.dueDate, today.value);
const sections = computed(() => [
  { title: 'Quá hạn', items: open.value.filter((t) => until(t) < 0) },
  { title: 'Hôm nay và 3 ngày tới', items: open.value.filter((t) => until(t) >= 0 && until(t) <= 3) },
  { title: 'Trong tuần tới', items: open.value.filter((t) => until(t) > 3 && until(t) <= 10) },
  { title: 'Sắp tới', items: open.value.filter((t) => until(t) > 10).slice(0, 6) },
]);
const checker = computed(() => (run.value?.levelKey === 1 ? 'Buddy' : 'CHT'));
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>

  <div v-else-if="!data?.staff || !run || !data.level" class="card empty">
    <h3>Hồ sơ của bạn chưa được tạo</h3>
    <div>Nhờ Cửa hàng trưởng hoặc BP Đào tạo tạo hồ sơ nhân viên và gắn với tài khoản của bạn. Sau đó lộ trình và nhắc việc sẽ hiện ở đây.</div>
  </div>

  <div v-else-if="run.dayIndex < 0" class="stack">
    <div class="card pad stack">
      <div class="h1">Chào {{ givenName(data.staff.fullName) }}</div>
      <p style="margin: 0">
        Lộ trình Level {{ run.levelKey }} bắt đầu ngày <b>{{ fmtDate(run.startDate, refYear) }}</b> (còn {{ -run.dayIndex }} ngày).
      </p>
      <PathBar :path="data.path" :for-staff="true" :ref-year="refYear" />
    </div>
    <div class="alert info"><div>Bạn có thể đọc trước Tổng quan Level {{ run.levelKey }} và xác nhận ngay bây giờ.</div></div>
    <LevelOverview :run-id="run.id" :ref-year="refYear" />
  </div>

  <div v-else-if="!run.acknowledged" class="stack">
    <div v-if="data.reviewToSign" class="alert info">
      <div>
        Phiếu đánh giá Level {{ data.reviewToSign.levelKey }} đã có kết quả, chờ bạn ký nhận.
        <RouterLink :to="{ path: '/lo-trinh', query: { tab: 'review', run: data.reviewToSign.runId } }">Mở phiếu</RouterLink>
      </div>
    </div>
    <div class="alert">
      <div>
        <b>Trước khi bắt đầu, hãy đọc tổng quan Level {{ run.levelKey }}.</b> Xem mục tiêu, người đồng hành và chỉ tiêu, rồi bấm xác nhận ở cuối trang để mở nhiệm
        vụ.
      </div>
    </div>
    <LevelOverview :run-id="run.id" :ref-year="refYear" />
  </div>

  <div v-else class="stack">
    <div class="card pad stack">
      <div class="rowf sp">
        <div>
          <div class="h1">Chào {{ givenName(data.staff.fullName) }}, hôm nay {{ fmtDate(today, refYear) }}</div>
          <div class="mut">
            Level {{ run.levelKey }} · ngày {{ run.dayIndex + 1 }}/{{ data.level.totalDays }}
            <template v-if="run.currentStage"> · {{ run.currentStage.label }}: {{ run.currentStage.name }}</template>
          </div>
        </div>
        <div style="min-width: 120px; text-align: right">
          <b style="font-size: 26px">{{ pct }}%</b>
          <div class="sm mut">{{ run.progress.done }}/{{ run.progress.total }} mục</div>
        </div>
      </div>
      <div class="bar" role="progressbar" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: pct + '%' }"></i></div>
      <PathBar :path="data.path" :for-staff="true" :ref-year="refYear" />
    </div>

    <div v-if="data.reviewToSign" class="alert info">
      <div>
        Phiếu đánh giá Level {{ data.reviewToSign.levelKey }} đã có kết quả, chờ bạn ký nhận.
        <RouterLink :to="{ path: '/lo-trinh', query: { tab: 'review', run: data.reviewToSign.runId } }">Mở phiếu</RouterLink>
      </div>
    </div>
    <div v-if="run.counts.rework" class="alert bad">
      <div><b>{{ run.counts.rework }} mục bị yêu cầu làm lại.</b> Mở mục để xem lý do.</div>
    </div>
    <div v-if="run.counts.overdue" class="alert bad">
      <div><b>{{ run.counts.overdue }} việc đã quá hạn.</b> Liên hệ Buddy/CHT để sắp xếp ca thực hiện sớm.</div>
    </div>
    <div v-if="run.counts.waiting" class="alert info">
      <div>{{ run.counts.waiting }} mục bạn đã báo xong, đang chờ {{ checker }} xác nhận.</div>
    </div>

    <template v-for="s in sections" :key="s.title">
      <template v-if="s.items.length">
        <div class="sec">{{ s.title }} · {{ s.items.length }}</div>
        <div class="card clip">
          <ItemRow v-for="t in s.items" :key="t.id" :task="t" :ref-year="refYear" />
        </div>
      </template>
    </template>

    <div v-if="!open.length" class="card empty">
      <h3>Bạn đã xong mọi mục của Level {{ run.levelKey }}</h3>
      <div>Chờ phiếu đánh giá và quyết định chuyển Level.</div>
    </div>
    <div class="sm mut">
      Bấm vào một mục để xem hướng dẫn và báo hoàn thành. Người xác nhận sẽ thấy mục đó trong "Việc cần xử lý" của họ. Phiên bản lộ trình: v{{ run.versionCode }}.
    </div>
  </div>
</template>
