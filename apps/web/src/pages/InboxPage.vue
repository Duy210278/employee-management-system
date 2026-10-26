<script setup lang="ts">
import { ROLE_SHORT, runTitle, type SignatureTodo, type TaskRole } from '@lotrinh/shared';
import { computed, ref } from 'vue';
import { useInbox } from '@/api/queries';
import Avatar from '@/components/Avatar.vue';
import Icon from '@/components/Icon.vue';
import ItemRow from '@/components/ItemRow.vue';
import { fmtDate, yearOf } from '@/format';

/** "Việc cần xử lý" của Buddy, CHT, QLKV, BP ĐT (mục 11.3); với NV làm Buddy là tab "Việc kèm cặp" */
const { data, isLoading, error } = useInbox(ref(true));
const refYear = computed(() => (data.value ? yearOf(data.value.today) : new Date().getFullYear()));
const empty = computed(() => !!data.value && !data.value.groups.length && !data.value.upcoming.length);
const KIND_LABEL: Record<SignatureTodo['kind'], string> = { review: 'Phiếu đánh giá', stage: 'Ký giai đoạn', pause: 'Tạm dừng' };
const waiting = (roles: TaskRole[]) => roles.map((r) => ROLE_SHORT[r]).join(' + ');
const ACTION_LABEL: Record<SignatureTodo['kind'], string> = { review: 'Mở phiếu', stage: 'Mở checklist', pause: 'Xem đề xuất' };
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="data" class="page">
    <div class="grid g4">
      <div class="card stat"><b>{{ data.stats.waiting }}</b><span>NV đã báo xong hoặc cần hỗ trợ, chờ bạn</span></div>
      <div class="card stat" :class="{ bad: data.stats.overdue }"><b>{{ data.stats.overdue }}</b><span>Việc của bạn đã quá hạn</span></div>
      <div class="card stat"><b>{{ data.stats.dueSoon }}</b><span>Đến hạn trong 7 ngày tới</span></div>
      <div class="card stat"><b>{{ data.stats.staffCount }}</b><span>Nhân sự phụ trách</span></div>
    </div>

    <template v-if="data.signatures.length">
      <div class="sec">Chữ ký chờ bạn · {{ data.signatures.length }}</div>
      <div class="card clip">
        <div v-for="(s, i) in data.signatures" :key="`${s.kind}-${s.runId}-${i}`" class="attn-row" :class="s.overdue ? 'bad' : 'info'">
          <span class="ic" aria-hidden="true">✎</span>
          <div class="grow">
            <div class="rowf tight">
              <b>{{ s.staffName }}</b> <span class="pill info">Level {{ s.levelKey }}</span> <span class="sm mut">{{ s.storeName }}</span>
            </div>
            <div class="sm">
              <span class="b">{{ KIND_LABEL[s.kind] }}:</span> {{ s.label }}<template v-if="s.totalSteps > 1"> · bước {{ s.step + 1 }}/{{ s.totalSteps }}</template>
              <span v-if="s.overdue" class="pill bad">Quá hạn</span>
              <span v-else-if="s.dueOn && s.kind === 'stage'" class="mut"> · hạn {{ fmtDate(s.dueOn, refYear) }}</span>
            </div>
            <div v-if="s.detail" class="sm mut">{{ s.detail }}</div>
          </div>
          <RouterLink class="btn sm pri" :to="{ path: `/nhan-su/${s.staffId}`, query: { tab: s.tab, run: s.runId } }">{{ ACTION_LABEL[s.kind] }}</RouterLink>
        </div>
      </div>
    </template>

    <template v-if="data.areaAlerts.length">
      <div class="sec">Cảnh báo trong khu vực · {{ data.areaAlerts.length }} việc quá hạn lâu</div>
      <div class="card clip">
        <div v-for="a in data.areaAlerts" :key="a.taskId" class="attn-row bad">
          <span class="ic" aria-hidden="true">!</span>
          <div class="grow">
            <div class="rowf tight"><b>{{ a.staffName }}</b> <span class="sm mut">{{ a.storeName }}</span> <span class="pill bad">Trễ {{ a.overdueDays }} ngày</span></div>
            <div class="sm"><span class="mono mut">{{ a.itemKey }}</span> {{ a.content }}</div>
            <div class="sm mut">Chờ {{ waiting(a.waitingFor) }}</div>
          </div>
          <RouterLink class="btn sm" :to="{ path: `/nhan-su/${a.staffId}`, query: { tab: 'check', run: a.runId } }">Mở hồ sơ</RouterLink>
        </div>
      </div>
    </template>

    <div v-if="empty && !data.signatures.length && !data.areaAlerts.length" class="card empty">
      <h3>Không có việc cần xử lý</h3>
      <div>Khi nhân viên báo hoàn thành hoặc có mục đến hạn, việc sẽ hiện ở đây.</div>
    </div>

    <template v-if="data.groups.length">
      <div class="sec">Việc theo nhân viên · {{ data.groups.length }}</div>
      <div v-for="g in data.groups" :key="g.run.id" class="card clip">
        <div class="grp-head">
          <div class="who">
            <Avatar :name="g.staff.fullName" />
            <div>
              <div class="rowf tight">
                <RouterLink class="b" :to="`/nhan-su/${g.staff.id}`">{{ g.staff.fullName }}</RouterLink>
                <span class="pill info">{{ runTitle(g.run) }} · ngày {{ g.run.dayIndex + 1 }}/{{ g.level.totalDays }}</span>
              </div>
              <div class="sm mut">{{ g.staff.storeName }} · {{ g.items.length }} việc cần xem</div>
            </div>
          </div>
          <span class="mini" :aria-label="`Tiến độ ${Math.round(g.run.progress.pct * 100)}%`">
            <span class="bar"><i :style="{ width: Math.round(g.run.progress.pct * 100) + '%' }"></i></span>
            {{ g.run.progress.done }}/{{ g.run.progress.total }} · {{ Math.round(g.run.progress.pct * 100) }}%
          </span>
          <RouterLink class="btn sm" :to="`/nhan-su/${g.staff.id}`">Mở hồ sơ</RouterLink>
        </div>
        <ItemRow v-for="t in g.items" :key="t.id" :task="t" :ref-year="refYear" />
      </div>
    </template>

    <template v-if="data.upcoming.length">
      <div class="sec">Lượt sắp bắt đầu</div>
      <details v-for="g in data.upcoming" :key="g.run.id" class="card clip">
        <summary class="stage-head">
          <Avatar :name="g.staff.fullName" size="sm" />
          <div class="stage-main">
            <b>{{ g.staff.fullName }}</b> · {{ runTitle(g.run) }}
            <div class="sm mut">Bắt đầu {{ fmtDate(g.run.startDate, refYear) }} (còn {{ -g.run.dayIndex }} ngày) · {{ g.items.length }} việc giai đoạn đầu</div>
          </div>
          <Icon class="caret" name="chevron" />
        </summary>
        <ItemRow v-for="t in g.items" :key="t.id" :task="t" :ref-year="refYear" />
      </details>
    </template>
  </div>
</template>
