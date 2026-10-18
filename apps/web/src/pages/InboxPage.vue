<script setup lang="ts">
import { computed, ref } from 'vue';
import { useInbox } from '@/api/queries';
import ItemRow from '@/components/ItemRow.vue';
import { fmtDate, yearOf } from '@/format';

/** "Việc cần xử lý" của Buddy, CHT, QLKV, BP ĐT (mục 11.3); với NV làm Buddy là tab "Việc kèm cặp" */
const { data, isLoading, error } = useInbox(ref(true));
const refYear = computed(() => (data.value ? yearOf(data.value.today) : new Date().getFullYear()));
const empty = computed(() => !!data.value && !data.value.groups.length && !data.value.upcoming.length);
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="data" class="stack">
    <div class="grid g4">
      <div class="card stat"><b>{{ data.stats.waiting }}</b><span>NV đã báo xong hoặc cần hỗ trợ, chờ bạn</span></div>
      <div class="card stat">
        <b :style="{ color: data.stats.overdue ? 'var(--bad)' : 'inherit' }">{{ data.stats.overdue }}</b><span>Việc của bạn đã quá hạn</span>
      </div>
      <div class="card stat"><b>{{ data.stats.dueSoon }}</b><span>Đến hạn trong 7 ngày tới</span></div>
      <div class="card stat"><b>{{ data.stats.staffCount }}</b><span>Nhân sự phụ trách</span></div>
    </div>

    <template v-if="data.signatures.length">
      <div class="sec">Chữ ký chờ bạn · {{ data.signatures.length }}</div>
      <div class="card clip">
        <div v-for="s in data.signatures" :key="s.runId" class="item rowf sp">
          <div>
            <b>{{ s.staffName }}</b> <span class="pill info">Level {{ s.levelKey }}</span> <span class="sm mut">{{ s.storeName }}</span>
            <div class="sm">Phiếu đánh giá · {{ s.label }} · bước {{ s.step + 1 }}/{{ s.totalSteps }}</div>
          </div>
          <RouterLink class="btn sm pri" :to="{ path: `/nhan-su/${s.staffId}`, query: { tab: 'review', run: s.runId } }">Mở phiếu</RouterLink>
        </div>
      </div>
    </template>

    <div v-if="empty && !data.signatures.length" class="card empty">
      <h3>Không có việc cần xử lý</h3>
      <div>Khi nhân viên báo hoàn thành hoặc có mục đến hạn, việc sẽ hiện ở đây.</div>
    </div>

    <div v-for="g in data.groups" :key="g.run.id" class="stack" style="gap: 8px">
      <div class="rowf sp">
        <div class="rowf" style="gap: 8px">
          <b>{{ g.staff.fullName }}</b>
          <span class="pill info">Level {{ g.run.levelKey }} · ngày {{ g.run.dayIndex + 1 }}/{{ g.level.totalDays }}</span>
          <span class="sm mut">{{ g.staff.storeName }}</span>
        </div>
        <div class="rowf" style="gap: 8px">
          <span class="sm mut">{{ g.run.progress.done }}/{{ g.run.progress.total }} mục · {{ Math.round(g.run.progress.pct * 100) }}%</span>
          <RouterLink class="btn sm" :to="`/nhan-su/${g.staff.id}`">Mở hồ sơ</RouterLink>
        </div>
      </div>
      <div class="card clip">
        <ItemRow v-for="t in g.items" :key="t.id" :task="t" :ref-year="refYear" />
      </div>
    </div>

    <template v-if="data.upcoming.length">
      <div class="sec">Lượt Level sắp bắt đầu</div>
      <details v-for="g in data.upcoming" :key="g.run.id" class="card pad">
        <summary>
          {{ g.staff.fullName }} · Level {{ g.run.levelKey }} bắt đầu {{ fmtDate(g.run.startDate, refYear) }} (còn {{ -g.run.dayIndex }} ngày) ·
          {{ g.items.length }} việc giai đoạn đầu
        </summary>
        <div class="card clip" style="margin-top: 10px">
          <ItemRow v-for="t in g.items" :key="t.id" :task="t" :ref-year="refYear" />
        </div>
      </details>
    </template>
  </div>
</template>
