<script setup lang="ts">
import { roleShortFor, SESSION_LABEL, TASK_STATUS_LABEL, type TaskStatus, type TaskView } from '@lotrinh/shared';
import { computed, ref, watch } from 'vue';
import { canBulk, useBulk } from '@/composables/bulkConfirm';
import { fmtDate } from '@/format';
import Icon from './Icon.vue';
import ItemDetail from './ItemDetail.vue';
import RoleChip from './RoleChip.vue';

/**
 * Một đầu việc trong bảng checklist theo giai đoạn: dòng tóm tắt, bấm để mở dòng chi tiết bên dưới.
 * `sel`: bảng có cột chọn để duyệt nhanh (ô chọn chỉ hiện ở mục người xem xác nhận được).
 */
const props = withDefaults(defineProps<{ task: TaskView; refYear: number; sel?: boolean }>(), { sel: false });
const open = ref(false);

const t = computed(() => props.task);
const bulk = useBulk();
watch(t, (v) => bulk?.sync(v));
const confirmedRoles = computed(() => t.value.confirmations.map((c) => c.role));
const short = (r: TaskView['requiredRoles'][number]) => roleShortFor(r, t.value.track);

/** Màu nhãn theo trạng thái lưu (phụ lục 22.1) */
const TONE: Record<TaskStatus, string> = { todo: '', doing: 'info', done: 'ok', help: 'bad', na: '', void: '' };

/** Dòng phụ dưới nhãn trạng thái: việc đang chờ gì hoặc cần làm lại */
const statusNote = computed(() => {
  const s = t.value.state;
  if (['upcoming', 'blocked', 'rework', 'pos_wait'].includes(s.code)) return { text: s.label, bad: s.code === 'rework' };
  if (t.value.status === 'doing' && t.value.actions.missing.length)
    return { text: `Chờ ${t.value.actions.missing.map(short).join(' + ')} xác nhận`, bad: false };
  return null;
});

/** Dòng phụ dưới ngày hạn: trễ, hạn hôm nay, sắp đến hạn hoặc ngày hoàn thành */
const dueNote = computed(() => {
  const s = t.value.state;
  if (t.value.status === 'done' && t.value.doneDate) return { text: `Xong ${fmtDate(t.value.doneDate, props.refYear)}`, cls: 'ok-text' };
  if (s.overdueDays > 0) return { text: `Trễ ${s.overdueDays} ngày`, cls: 'bad-text' };
  if (s.code === 'due_today' || s.code === 'due_soon') return { text: s.label, cls: 'warn-text' };
  return null;
});

const metaText = computed(() => [t.value.category, t.value.session ? SESSION_LABEL[t.value.session] : ''].filter(Boolean).join(' · '));
</script>

<template>
  <tr :class="{ on: open, gpp: t.gpp }" @click="open = !open">
    <td v-if="sel" class="ck-sel" @click.stop>
      <label v-if="bulk && canBulk(t)" class="sel">
        <input type="checkbox" :checked="bulk.has(t.id)" :aria-label="`Chọn ${t.itemKey} để duyệt nhanh`" @change="bulk.toggle(t)" />
      </label>
    </td>
    <td data-l="Mã" class="mono sm mut nowrap">{{ t.itemKey }}</td>
    <td class="ck-name">
      <div class="pre">{{ t.content }}</div>
      <div v-if="metaText || t.gpp" class="sm mut">
        {{ metaText }}<template v-if="metaText && t.gpp"> · </template><span v-if="t.gpp" class="gpp-tag">GPP bắt buộc</span>
      </div>
    </td>
    <td data-l="Hạn" class="nowrap">
      <div>{{ fmtDate(t.dueDate, refYear) }}</div>
      <div v-if="dueNote" class="sm" :class="dueNote.cls">{{ dueNote.text }}</div>
    </td>
    <td data-l="Xác nhận">
      <span class="chips">
        <RoleChip v-for="r in t.requiredRoles" :key="r" :role="r" :track="t.track" :state="confirmedRoles.includes(r) ? 'done' : 'pending'" />
      </span>
    </td>
    <td data-l="Trạng thái">
      <div><span class="pill" :class="TONE[t.status]">{{ TASK_STATUS_LABEL[t.status] }}</span></div>
      <div v-if="statusNote" class="sm" :class="statusNote.bad ? 'bad-text' : 'mut'">{{ statusNote.text }}</div>
    </td>
    <td class="ck-tog">
      <button class="btn ghost sm" type="button" :aria-expanded="open" :aria-label="(open ? 'Thu gọn ' : 'Xem chi tiết ') + t.itemKey" @click.stop="open = !open">
        <Icon class="caret" name="chevron" />
      </button>
    </td>
  </tr>
  <tr v-if="open" class="ck-more">
    <td :colspan="sel ? 7 : 6"><ItemDetail :task="t" :ref-year="refYear" /></td>
  </tr>
</template>
