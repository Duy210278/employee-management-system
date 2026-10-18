<script setup lang="ts">
import { computed, toRef } from 'vue';
import { useRunTasks } from '@/api/queries';
import { fmtDate } from '@/format';
import ItemRow from './ItemRow.vue';

/** Tab Checklist của hồ sơ NV: mỗi giai đoạn là một thẻ (mục 11.5, theo stageBlock của N3) */
const props = defineProps<{ runId: number; refYear: number }>();
const { data, isLoading, error } = useRunTasks(toRef(() => props.runId));

const currentIndex = computed(() => data.value?.run.currentStage?.index ?? -1);
const stages = computed(() =>
  (data.value?.stages ?? []).map((s) => {
    const tasks = (data.value?.tasks ?? []).filter((t) => t.stageKey === s.key);
    const finished = tasks.filter((t) => ['done', 'na', 'void'].includes(t.status)).length;
    const overdue = tasks.filter((t) => t.state.overdueDays > 0).length;
    const isCurrent = s.index === currentIndex.value;
    // Mở sẵn giai đoạn hiện tại (hoặc giai đoạn đầu khi lượt chưa bắt đầu) và giai đoạn đã qua còn việc dở
    const open = isCurrent || (currentIndex.value === -1 && s.index === 0) || (s.index < currentIndex.value && finished < tasks.length);
    return { ...s, tasks, finished, overdue, isCurrent, open };
  }),
);
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải checklist…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else class="stack">
    <details v-for="s in stages" :key="s.key" class="card clip" :open="s.open">
      <summary class="stg" :style="s.isCurrent ? 'background: var(--soft)' : ''">
        <div style="min-width: 0; flex: 1">
          <b>{{ s.label }}: {{ s.name }}</b>
          <span v-if="s.isCurrent" class="pill info" style="margin-left: 6px">Đang diễn ra</span>
          <div class="sm mut">{{ fmtDate(s.from, refYear) }} → {{ fmtDate(s.to, refYear) }}<template v-if="s.goal"> · {{ s.goal }}</template></div>
        </div>
        <div class="rowf">
          <span v-if="s.overdue" class="pill bad">{{ s.overdue }} trễ</span>
          <span class="pill" :class="{ ok: s.finished === s.tasks.length }">{{ s.finished }}/{{ s.tasks.length }}</span>
        </div>
      </summary>
      <ItemRow v-for="t in s.tasks" :key="t.id" :task="t" :ref-year="refYear" />
    </details>
  </div>
</template>
