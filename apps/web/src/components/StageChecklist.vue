<script setup lang="ts">
import { diffDays, type StageSignStepView } from '@lotrinh/shared';
import { computed, reactive, ref, toRef, watch } from 'vue';
import { runApi, useMutate, useRunTasks } from '@/api/queries';
import { fmtDate, fmtDateTime } from '@/format';
import Icon from './Icon.vue';
import ItemRow from './ItemRow.vue';
import RoleChip from './RoleChip.vue';

/** Tab Checklist của hồ sơ NV: mỗi giai đoạn là một thẻ (mục 11.5, theo stageBlock của N3), cuối thẻ là chữ ký giai đoạn (mục 10.2) */
const props = defineProps<{ runId: number; refYear: number }>();
const { data, isLoading, error } = useRunTasks(toRef(() => props.runId));
const mutate = useMutate();
const busy = ref(false);

const currentIndex = computed(() => data.value?.run.currentStage?.index ?? -1);
const stages = computed(() =>
  (data.value?.stages ?? []).map((s) => {
    const tasks = (data.value?.tasks ?? []).filter((t) => t.stageKey === s.key);
    const finished = tasks.filter((t) => ['done', 'na', 'void'].includes(t.status)).length;
    const overdue = tasks.filter((t) => t.state.overdueDays > 0).length;
    const isCurrent = s.index === currentIndex.value;
    const canSign = !!s.sign?.steps.some((x) => x.canSign);
    // Mở sẵn giai đoạn hiện tại (hoặc giai đoạn đầu khi lượt chưa bắt đầu), giai đoạn đã qua còn việc dở và giai đoạn đang chờ bạn ký
    const open = isCurrent || canSign || (currentIndex.value === -1 && s.index === 0) || (s.index < currentIndex.value && finished < tasks.length);
    return { ...s, tasks, finished, overdue, isCurrent, open, canSign };
  }),
);

// Giai đoạn mở sẵn chỉ tính ở lần tải đầu; sau đó người dùng tự mở/đóng, ký xong thẻ không tự gập lại
const opened = reactive(new Set<string>());
let seeded = false;
watch(
  stages,
  (list) => {
    if (seeded || !list.length) return;
    seeded = true;
    for (const s of list) if (s.open) opened.add(s.key);
  },
  { immediate: true },
);
function onToggle(key: string, e: Event) {
  if ((e.target as HTMLDetailsElement).open) opened.add(key);
  else opened.delete(key);
}

async function sign(stageKey: string, step: StageSignStepView) {
  busy.value = true;
  await mutate(() => runApi.signStage(props.runId, stageKey, step.step), 'Đã ký cuối giai đoạn');
  busy.value = false;
}
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải checklist…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else class="stack">
    <div v-if="data?.run.pause" class="alert info">
      <div>Lộ trình đang <b>tạm dừng</b> {{ fmtDate(data.run.pause.from, refYear) }} → {{ fmtDate(data.run.pause.to, refYear) }}; các mốc chưa xong đã lùi tương ứng.</div>
    </div>
    <details v-for="(s, i) in stages" :key="s.key" class="card clip" :open="opened.has(s.key)" @toggle="onToggle(s.key, $event)">
      <summary class="stage-head" :class="{ cur: s.isCurrent, done: s.tasks.length > 0 && s.finished === s.tasks.length }">
        <span class="stage-no" aria-hidden="true">{{ s.tasks.length > 0 && s.finished === s.tasks.length ? '✓' : i + 1 }}</span>
        <div class="stage-main">
          <div class="rowf tight">
            <b>{{ s.label }}: {{ s.name }}</b>
            <span v-if="s.isCurrent" class="pill info">Đang diễn ra</span>
          </div>
          <div class="sm mut">
            {{ fmtDate(s.from, refYear) }}<template v-if="diffDays(s.to, s.from) > 1"> → {{ fmtDate(s.to, refYear) }}</template><template v-if="s.goal"> · {{ s.goal }}</template>
          </div>
        </div>
        <div class="stage-side">
          <span v-if="s.overdue" class="pill bad">{{ s.overdue }} trễ</span>
          <span v-if="s.sign?.complete" class="pill ok">Đã ký</span>
          <span v-else-if="s.sign?.overdue" class="pill bad">Trễ ký</span>
          <span v-else-if="s.canSign" class="pill warn">Chờ bạn ký</span>
          <span class="mini" :aria-label="`${s.finished}/${s.tasks.length} mục xong`">
            <span class="bar"><i :style="{ width: (s.tasks.length ? (s.finished / s.tasks.length) * 100 : 0) + '%' }"></i></span>
            {{ s.finished }}/{{ s.tasks.length }}
          </span>
          <Icon class="caret" name="chevron" />
        </div>
      </summary>
      <ItemRow v-for="t in s.tasks" :key="t.id" :task="t" :ref-year="refYear" />
      <div v-if="s.sign" class="signbar">
        <span class="sm"><b>Ký cuối giai đoạn</b></span>
        <span v-for="st in s.sign.steps" :key="st.step" class="step">
          <RoleChip :role="st.role" :state="st.state === 'signed' ? 'done' : 'pending'" />
          <template v-if="st.state === 'signed'">{{ st.signedByName }} <span class="mut">· {{ fmtDateTime(st.at) }}</span></template>
          <button v-else-if="st.canSign" class="btn sm pri" type="button" :disabled="busy" @click="sign(s.key, st)">{{ st.label }}</button>
          <span v-else-if="st.state === 'waiting'" class="mut">Chưa đến lượt</span>
        </span>
        <span v-if="!s.sign.complete" class="sm" :class="s.sign.overdue ? 'bad-text' : 'mut'">
          <template v-if="s.sign.blocked">{{ s.sign.blocked }} · </template>hạn ký {{ fmtDate(s.sign.dueOn, refYear) }}
        </span>
      </div>
    </details>
  </div>
</template>
