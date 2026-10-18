<script setup lang="ts">
import { ROLE_SHORT, type TaskView } from '@lotrinh/shared';
import { computed, ref } from 'vue';
import { taskApi, useMe, useMutate, useTaskEvents } from '@/api/queries';
import { useToast } from '@/composables/toast';
import { fmtDate, fmtDateTime } from '@/format';
import RoleChip from './RoleChip.vue';
import StatePill from './StatePill.vue';

/** Dòng đầu việc dùng chung cho Hôm nay, Việc cần xử lý, Hồ sơ NV (mục 11.2) */
const props = withDefaults(defineProps<{ task: TaskView; refYear: number; showStaff?: boolean }>(), { showStaff: false });

const { data: me } = useMe();
const mutate = useMutate();
const toast = useToast();
const open = ref(false);
const note = ref('');
const busy = ref(false);
const { data: events } = useTaskEvents(
  computed(() => props.task.id),
  computed(() => open.value),
);

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
const waitingLabel = computed(() => a.value.waitingFor.map((r) => ROLE_SHORT[r]).join(' + '));
/** Mục cần làm lại / cần hỗ trợ / chờ phụ thuộc mà còn trễ hạn thì vẫn hiện số ngày trễ */
const extraOverdue = computed(() => ['rework', 'help', 'blocked'].includes(t.value.state.code) && t.value.state.overdueDays > 0);

const confirmLabel = computed(() => {
  const slot = a.value.confirmAs;
  if (!slot) return '';
  if (slot.role === 'nv') return slot.proxyRole ? 'Báo hoàn thành thay NV' : 'Tôi đã làm xong';
  if (slot.proxyRole) return `Xác nhận thay ${ROLE_SHORT[slot.role]}`;
  const mine = me.value?.user.role;
  return mine === slot.role ? 'Xác nhận đạt' : `Xác nhận đạt (${ROLE_SHORT[slot.role]})`;
});

async function run(fn: () => Promise<unknown>, success: string) {
  busy.value = true;
  const ok = await mutate(fn, success);
  busy.value = false;
  if (ok !== undefined) note.value = '';
}

function requireNote(message: string): boolean {
  if (note.value.trim()) return true;
  toast.show(message);
  return false;
}

const confirm = () => run(() => taskApi.confirm(t.value, note.value.trim()), a.value.confirmAs?.role === 'nv' ? 'Đã báo hoàn thành' : 'Đã xác nhận');
const undo = () => run(() => taskApi.undo(t.value), 'Đã hủy xác nhận của bạn');
const rework = () => requireNote('Nhập lý do vào ô ghi chú trước khi yêu cầu làm lại') && run(() => taskApi.rework(t.value, note.value.trim()), 'Đã trả về làm lại');
const help = () => requireNote('Ghi rõ bạn cần hỗ trợ gì vào ô ghi chú') && run(() => taskApi.status(t.value, 'help', note.value.trim()), 'Đã báo cần hỗ trợ');
const clearHelp = () => run(() => taskApi.status(t.value, 'todo', note.value.trim()), 'Đã cập nhật trạng thái');
const markNa = () => requireNote('Nhập lý do bỏ qua vào ô ghi chú') && run(() => taskApi.status(t.value, 'na', note.value.trim()), 'Đã đánh dấu Bỏ qua / N-A');
</script>

<template>
  <div class="item">
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
        <p :class="{ gpp: t.gpp }" :style="{ fontWeight: a.confirmAs ? 600 : 500 }">{{ t.content }}</p>
        <div class="meta">
          <RoleChip v-for="r in t.requiredRoles" :key="r" :role="r" :state="confirmedRoles.includes(r) ? 'done' : 'pending'" />
          <span class="pill">{{ t.category }}</span>
          <span v-if="t.gpp" class="pill bad">GPP bắt buộc</span>
          <StatePill :state="t.state" />
          <span v-if="extraOverdue" class="pill bad">Trễ {{ t.state.overdueDays }} ngày</span>
          <span v-if="waitingLabel" class="pill info">Chờ {{ waitingLabel }}</span>
          <span v-if="showStaff" class="pill info">{{ t.staffName }}</span>
          <span class="sm mut mono">{{ t.itemKey }}</span>
        </div>
      </div>
    </div>

    <div v-if="open" class="more">
      <div v-if="t.guidance">
        <b class="sm">Hướng dẫn thực hiện</b>
        <div class="sm mut" style="white-space: pre-line">{{ t.guidance }}</div>
      </div>
      <div class="sm mut">
        Mở {{ fmtDate(t.openDate, refYear) }} · Hạn {{ fmtDate(t.dueDate, refYear) }} · {{ t.stageLabel }}
        <template v-if="t.doneDate"> · Hoàn thành {{ fmtDate(t.doneDate, refYear) }}</template>
      </div>
      <div v-if="t.rework" class="alert bad">
        <div><b>{{ t.rework.byName }} yêu cầu làm lại ({{ fmtDateTime(t.rework.at) }}):</b> {{ t.rework.note }}</div>
      </div>
      <div v-if="t.naReason" class="alert"><div><b>Lý do bỏ qua:</b> {{ t.naReason }}</div></div>
      <div v-if="t.blockedBy.length" class="alert"><div>Chỉ xác nhận được sau khi xong: {{ t.blockedBy.join(', ') }}</div></div>
      <div v-if="t.confirmations.length" class="sm">
        <div v-for="c in t.confirmations" :key="c.role">
          <RoleChip :role="c.role" state="done" /> {{ c.userName }}
          <span v-if="c.proxyRole" class="mut">({{ ROLE_SHORT[c.proxyRole] }} xác nhận thay)</span>
          <span class="mut"> · {{ fmtDateTime(c.at) }}</span>
          <span v-if="c.note" class="mut"> · {{ c.note }}</span>
        </div>
      </div>
      <div v-if="events?.length" class="sm mut">
        <b class="sm" style="color: var(--ink)">Lịch sử</b>
        <div v-for="e in events" :key="e.id">
          {{ fmtDateTime(e.at) }} · <b>{{ e.userName }}</b><template v-if="e.role"> ({{ ROLE_SHORT[e.role] }})</template> · {{ e.actionLabel
          }}<template v-if="e.note">: {{ e.note }}</template>
        </div>
      </div>

      <template v-if="!finished || a.canUndo || a.canRework">
        <textarea v-model="note" :aria-label="'Ghi chú cho ' + t.itemKey" placeholder="Ghi chú (bắt buộc khi yêu cầu làm lại, báo cần hỗ trợ, bỏ qua)"></textarea>
        <div class="rowf">
          <button v-if="a.confirmAs" class="btn pri" type="button" :disabled="busy" @click="confirm">{{ confirmLabel }}</button>
          <button v-if="a.canUndo" class="btn" type="button" :disabled="busy" @click="undo">Hủy xác nhận của tôi</button>
          <button v-if="a.canHelp" class="btn" type="button" :disabled="busy" @click="help">Cần hỗ trợ</button>
          <button v-if="a.canClearHelp" class="btn" type="button" :disabled="busy" @click="clearHelp">Đã được hỗ trợ</button>
          <button v-if="a.canRework" class="btn bad" type="button" :disabled="busy" @click="rework">Yêu cầu làm lại</button>
          <button v-if="a.canNa" class="btn" type="button" :disabled="busy" @click="markNa">Bỏ qua / N-A</button>
        </div>
      </template>
    </div>
  </div>
</template>
