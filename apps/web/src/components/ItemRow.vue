<script setup lang="ts">
import { roleShortFor, SESSION_LABEL, type TaskView } from '@lotrinh/shared';
import { computed, ref } from 'vue';
import { fmtDate } from '@/format';
import Icon from './Icon.vue';
import ItemDetail from './ItemDetail.vue';
import RoleChip from './RoleChip.vue';
import StatePill from './StatePill.vue';

/** Dòng đầu việc dùng chung cho Hôm nay, Việc cần xử lý (mục 11.2) */
const props = withDefaults(defineProps<{ task: TaskView; refYear: number; showStaff?: boolean }>(), { showStaff: false });

const open = ref(false);

const t = computed(() => props.task);
const a = computed(() => t.value.actions);
const confirmedRoles = computed(() => t.value.confirmations.map((c) => c.role));
const finished = computed(() => ['done', 'na', 'void'].includes(t.value.status));
const chk = computed(() => {
  if (t.value.status === 'done') return { cls: 'done', mark: '✓' };
  if (t.value.status === 'help') return { cls: 'part', mark: '!' };
  if (t.value.status === 'doing') return { cls: 'part', mark: '…' };
  if (t.value.state.overdueDays > 0) return { cls: 'late', mark: '' };
  return { cls: '', mark: '' };
});
const short = (r: TaskView['requiredRoles'][number]) => roleShortFor(r, t.value.track);
const waitingLabel = computed(() => a.value.waitingFor.map(short).join(' + '));
/** Mục cần làm lại / cần hỗ trợ / chờ phụ thuộc mà còn trễ hạn thì vẫn hiện số ngày trễ */
const extraOverdue = computed(() => ['rework', 'help', 'blocked'].includes(t.value.state.code) && t.value.state.overdueDays > 0);
/** Dòng chữ phụ: nhóm, ca, hạn (nhãn trạng thái "Hạn dd/mm" đã nói hạn thì không nhắc lại) */
const metaText = computed(() =>
  [
    t.value.category,
    t.value.session ? SESSION_LABEL[t.value.session] : '',
    !finished.value && t.value.state.code !== 'scheduled' ? `Hạn ${fmtDate(t.value.dueDate, props.refYear)}` : '',
    props.showStaff ? t.value.staffName : '',
  ]
    .filter(Boolean)
    .join(' · '),
);
</script>

<template>
  <div class="item" :class="{ open, gpp: t.gpp }">
    <div
      class="head"
      role="button"
      tabindex="0"
      :aria-expanded="open"
      @click="open = !open"
      @keydown.enter.prevent="open = !open"
      @keydown.space.prevent="open = !open"
    >
      <span class="chk" :class="chk.cls" aria-hidden="true">{{ chk.mark }}</span>
      <div class="t">
        <div class="t-top">
          <p class="t-title">{{ t.content }}</p>
          <span class="t-state">
            <StatePill :state="t.state" />
            <span v-if="extraOverdue" class="pill bad">Trễ {{ t.state.overdueDays }} ngày</span>
          </span>
        </div>
        <div class="meta">
          <span class="chips">
            <RoleChip v-for="r in t.requiredRoles" :key="r" :role="r" :track="t.track" :state="confirmedRoles.includes(r) ? 'done' : 'pending'" />
          </span>
          <span v-if="waitingLabel" class="pill info">Chờ {{ waitingLabel }}</span>
          <span class="mono">{{ t.itemKey }}</span>
          <span>{{ metaText }}</span>
          <span v-if="t.gpp" class="gpp-tag">GPP bắt buộc</span>
        </div>
      </div>
      <Icon class="caret" name="chevron" />
    </div>

    <ItemDetail v-if="open" :task="t" :ref-year="refYear" />
  </div>
</template>
