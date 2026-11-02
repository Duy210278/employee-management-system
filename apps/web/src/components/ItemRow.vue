<script setup lang="ts">
import { roleShortFor, SESSION_LABEL, type TaskView } from '@lotrinh/shared';
import { computed, ref } from 'vue';
import { taskApi, useMe, useMutate, useTaskEvents } from '@/api/queries';
import { useToast } from '@/composables/toast';
import { fmtDate, fmtDateTime } from '@/format';
import Icon from './Icon.vue';
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

const confirmLabel = computed(() => {
  const slot = a.value.confirmAs;
  if (!slot) return '';
  if (slot.role === 'nv') return slot.proxyRole ? `Báo hoàn thành thay ${short('nv')}` : 'Tôi đã làm xong';
  if (slot.proxyRole) return `Xác nhận thay ${short(slot.role)}`;
  const mine = me.value?.user.role;
  return mine === slot.role ? 'Xác nhận đạt' : `Xác nhận đạt (${short(slot.role)})`;
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
          <p class="t-title" :class="{ strong: a.confirmAs }">{{ t.content }}</p>
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

    <div v-if="open" class="more">
      <div class="more-grid">
        <section class="more-box">
          <h4>Hướng dẫn</h4>
          <div v-if="t.supporter || t.link">
            <template v-if="t.supporter"><b>Người hỗ trợ:</b> {{ t.supporter }}</template>
            <template v-if="t.link">
              <template v-if="t.supporter"> · </template>
              <a :href="t.link" target="_blank" rel="noopener">Tài liệu hướng dẫn ↗</a>
            </template>
          </div>
          <div v-if="t.guidance" class="mut pre">{{ t.guidance }}</div>
          <div class="sm mut">
            Mở {{ fmtDate(t.openDate, refYear) }} · Hạn {{ fmtDate(t.dueDate, refYear) }} · {{ t.stageLabel }}
            <template v-if="t.doneDate"> · Hoàn thành {{ fmtDate(t.doneDate, refYear) }}</template>
          </div>
        </section>
        <section class="more-box">
          <h4>Xác nhận và lịch sử</h4>
          <ul v-if="t.confirmations.length" class="tline">
            <li v-for="c in t.confirmations" :key="c.role" class="ok">
              <RoleChip :role="c.role" :track="t.track" state="done" /> <b>{{ c.userName }}</b>
              <span v-if="c.proxyRole" class="mut"> ({{ short(c.proxyRole) }} xác nhận thay)</span>
              <span class="mut"> · {{ fmtDateTime(c.at) }}</span>
              <span v-if="c.note" class="mut"> · {{ c.note }}</span>
            </li>
          </ul>
          <div v-else class="mut">Chưa có xác nhận nào.</div>
          <ul v-if="events?.length" class="tline sm">
            <li v-for="e in events" :key="e.id">
              <span class="mut">{{ fmtDateTime(e.at) }}</span> · <b>{{ e.userName }}</b><template v-if="e.role"> ({{ short(e.role) }})</template> · {{ e.actionLabel
              }}<template v-if="e.note">: {{ e.note }}</template>
            </li>
          </ul>
        </section>
      </div>
      <div v-if="t.rework" class="alert bad">
        <div><b>{{ t.rework.byName }} yêu cầu làm lại ({{ fmtDateTime(t.rework.at) }}):</b> {{ t.rework.note }}</div>
      </div>
      <div v-if="t.naReason" class="alert"><div><b>Lý do bỏ qua:</b> {{ t.naReason }}</div></div>
      <div v-if="t.blockedBy.length" class="alert"><div>Chỉ xác nhận được sau khi xong: {{ t.blockedBy.join(', ') }}</div></div>

      <template v-if="!finished || a.canUndo || a.canRework">
        <textarea v-model="note" rows="2" :aria-label="'Ghi chú cho ' + t.itemKey" placeholder="Ghi chú (bắt buộc điền thông tin cụ thể đã làm gì, thực hiện được gì; bắt buộc khi yêu cầu làm lại, báo cần hỗ trợ, bỏ qua)"></textarea>
        <div class="actbar">
          <button v-if="a.confirmAs" class="btn pri" type="button" :disabled="busy" @click="confirm">{{ confirmLabel }}</button>
          <button v-if="a.canUndo" class="btn" type="button" :disabled="busy" @click="undo">Hủy xác nhận của tôi</button>
          <button v-if="a.canClearHelp" class="btn" type="button" :disabled="busy" @click="clearHelp">Đã được hỗ trợ</button>
          <button v-if="a.canHelp" class="btn ghost" type="button" :disabled="busy" @click="help">Cần hỗ trợ</button>
          <button v-if="a.canNa" class="btn ghost" type="button" :disabled="busy" @click="markNa">Bỏ qua / N-A</button>
          <button v-if="a.canRework" class="btn bad push" type="button" :disabled="busy" @click="rework">Yêu cầu làm lại</button>
        </div>
      </template>
    </div>
  </div>
</template>
