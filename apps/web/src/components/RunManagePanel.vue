<script setup lang="ts">
import { addDays, ASSIGNMENT_LABEL, PauseBody, runTitle, type AssignmentRole, type PauseView } from '@lotrinh/shared';
import { computed, reactive, ref, toRef, watch } from 'vue';
import { runApi, staffApi, useMutate, useRunManage } from '@/api/queries';
import { useToast } from '@/composables/toast';
import { fmtDate, fmtDateTime } from '@/format';

/**
 * Các tình huống vận hành của lượt Level (mục 9.3): đổi Buddy/CHT/QLKV, tạm dừng (CHT đề xuất, QLKV/BP ĐT duyệt),
 * chuyển cửa hàng, ngừng theo dõi (nghỉ việc, có chuyển giao nếu NV đang làm Buddy).
 */
const props = defineProps<{ runId: number; staffId: number; staffName: string }>();
const { data: m, isLoading, error } = useRunManage(toRef(() => props.runId));
const mutate = useMutate();
const toast = useToast();
const busy = ref(false);

const people = reactive<Record<AssignmentRole, number>>({ buddy: 0, cht: 0, qlkv: 0, trainer: 0 });
const pause = reactive({ from: '', to: '', reason: '' });
const decideNote = ref('');
const transfer = reactive({ storeId: 0, chtId: 0, qlkvId: 0 });
const stop = reactive({ reason: '', handover: {} as Record<number, number> });

watch(
  m,
  (v) => {
    if (!v) return;
    people.buddy = v.people.buddyId ?? 0;
    people.cht = v.people.chtId ?? 0;
    people.qlkv = v.people.qlkvId ?? 0;
    people.trainer = v.people.trainerId ?? 0;
    if (!pause.from) {
      pause.from = addDays(v.today, 1);
      pause.to = addDays(v.today, 7);
    }
    if (!transfer.storeId) transfer.storeId = v.storeId;
  },
  { immediate: true },
);
watch(
  () => transfer.storeId,
  (id) => {
    const s = m.value?.options.stores.find((x) => x.id === id);
    transfer.chtId = s?.defaultChtId ?? 0;
    transfer.qlkvId = s?.defaultQlkvId ?? 0;
  },
);

// Lượt onboarding CHT: người phụ trách Đào tạo, QLKV, Buddy (CHT cũ / người QLKV chỉ định); lượt NVBH: Buddy, CHT, QLKV
const ROLES = computed<AssignmentRole[]>(() => (m.value?.track === 'nvbh' ? ['buddy', 'cht', 'qlkv'] : ['trainer', 'qlkv', 'buddy']));
const optionsFor = (role: AssignmentRole) => {
  const o = m.value?.options;
  return ({ buddy: o?.buddies, cht: o?.chts, qlkv: o?.qlkvs, trainer: o?.trainers }[role] ?? []);
};
const current = (role: AssignmentRole) => {
  const p = m.value?.people;
  return ({ buddy: p?.buddyId, cht: p?.chtId, qlkv: p?.qlkvId, trainer: p?.trainerId }[role] ?? 0) || 0;
};
/** NV không làm Buddy của chính mình */
const buddiesFor = (staffUserId: number | null) => (m.value?.options.buddies ?? []).filter((b) => b.id !== staffUserId);
const pending = computed(() => m.value?.pauses.find((p) => p.status === 'pending') ?? null);
const pauseDays = computed(() => (pause.from && pause.to && pause.to >= pause.from ? Math.round((Date.parse(pause.to) - Date.parse(pause.from)) / 86_400_000) + 1 : 0));
const STATUS: Record<PauseView['status'], [string, string]> = { pending: ['Chờ duyệt', 'warn'], approved: ['Đã duyệt', 'ok'], rejected: ['Từ chối', 'bad'] };

async function run<T>(fn: () => Promise<T>, done: string) {
  busy.value = true;
  const res = await mutate(fn, done);
  busy.value = false;
  return res;
}

const assign = (role: AssignmentRole) => run(() => runApi.assign(props.runId, role, people[role]), `Đã đổi ${ASSIGNMENT_LABEL[role]}`);

async function requestPause() {
  const parsed = PauseBody.safeParse(pause);
  if (!parsed.success) return toast.show(parsed.error.issues[0]?.message ?? 'Kiểm tra lại ngày tạm dừng');
  const approved = m.value?.permissions.decidePause;
  if (approved && !confirm(`Tạm dừng ${pauseDays.value} ngày? Mọi mốc chưa xong từ ${fmtDate(pause.from)} sẽ lùi ${pauseDays.value} ngày.`)) return;
  const res = await run(() => runApi.pause(props.runId, parsed.data), approved ? 'Đã tạm dừng, lịch đã lùi' : 'Đã gửi đề xuất tạm dừng, chờ QLKV duyệt');
  if (res) pause.reason = '';
}

async function decide(p: PauseView, approve: boolean) {
  if (!approve && !decideNote.value.trim()) return toast.show('Nhập lý do từ chối để CHT biết');
  if (approve && !confirm(`Duyệt tạm dừng ${p.days} ngày? Mọi mốc chưa xong từ ${fmtDate(p.from)} sẽ lùi ${p.days} ngày.`)) return;
  const res = await run(() => runApi.decidePause(props.runId, p.id, approve, decideNote.value.trim()), approve ? 'Đã duyệt tạm dừng' : 'Đã từ chối đề xuất');
  if (res) decideNote.value = '';
}

const doTransfer = () =>
  run(
    () => staffApi.transfer(props.staffId, { storeId: transfer.storeId, chtId: transfer.chtId || null, qlkvId: transfer.qlkvId || null }),
    'Đã chuyển cửa hàng',
  );

async function doStop() {
  if (!stop.reason.trim()) return toast.show('Nhập lý do ngừng theo dõi');
  const missing = (m.value?.buddyOf ?? []).filter((a) => !stop.handover[a.runId]);
  if (missing.length) return toast.show(`Chọn người thay làm Buddy cho ${missing.map((a) => a.staffName).join(', ')}`);
  if (!confirm(`Ngừng theo dõi ${props.staffName}? Lượt Level chuyển "Dừng", dữ liệu vẫn được giữ.`)) return;
  const handover = (m.value?.buddyOf ?? []).map((a) => ({ runId: a.runId, role: a.role, userId: stop.handover[a.runId] }));
  await run(() => staffApi.stop(props.staffId, { reason: stop.reason.trim(), handover }), `Đã ngừng theo dõi ${props.staffName}`);
}
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="m" class="stack">
    <div v-if="!m.active" class="alert"><div>Nhân viên đã ngừng theo dõi. Lượt Level ở trạng thái Dừng, dữ liệu được giữ nguyên.</div></div>

    <div class="grid g2" style="align-items: start">
      <!-- Phân công -->
      <div class="card pad stack">
        <div class="h2">Người phụ trách · {{ runTitle(m) }}</div>
        <div class="sm mut">Đổi người chỉ đổi người nhận các việc chưa xác nhận; lịch không đổi, xác nhận cũ giữ tên người đã xác nhận.</div>
        <div v-for="role in ROLES" :key="role" class="rowf">
          <label class="f grow">
            {{ ASSIGNMENT_LABEL[role] }}
            <select v-model.number="people[role]" :disabled="!m.permissions.assign">
              <option :value="0" disabled>Chưa gắn</option>
              <option v-for="o in optionsFor(role)" :key="o.id" :value="o.id">{{ o.fullName }} · {{ o.note }}</option>
            </select>
          </label>
          <button
            v-if="m.permissions.assign"
            class="btn sm"
            type="button"
            style="align-self: end"
            :disabled="busy || !people[role] || people[role] === current(role)"
            @click="assign(role)"
          >
            Đổi
          </button>
        </div>
      </div>

      <!-- Chuyển cửa hàng -->
      <div class="card pad stack">
        <div class="h2">Chuyển cửa hàng</div>
        <template v-if="m.permissions.transfer && m.options.stores.length">
          <label class="f">
            Cửa hàng mới
            <select v-model.number="transfer.storeId">
              <option v-for="s in m.options.stores" :key="s.id" :value="s.id">{{ s.name }} · {{ s.areaName }}</option>
            </select>
          </label>
          <div class="form">
            <label class="f">
              CHT theo cửa hàng mới
              <select v-model.number="transfer.chtId">
                <option :value="0">Giữ CHT hiện tại</option>
                <option v-for="o in m.options.chts" :key="o.id" :value="o.id">{{ o.fullName }}</option>
              </select>
            </label>
            <label class="f">
              QLKV
              <select v-model.number="transfer.qlkvId">
                <option :value="0">Giữ QLKV hiện tại</option>
                <option v-for="o in m.options.qlkvs" :key="o.id" :value="o.id">{{ o.fullName }}</option>
              </select>
            </label>
          </div>
          <div><button class="btn" type="button" :disabled="busy || transfer.storeId === m.storeId" @click="doTransfer">Chuyển cửa hàng</button></div>
          <div class="sm mut">Lịch Level giữ nguyên; CHT, QLKV mới nhận các việc chưa xác nhận.</div>
        </template>
        <div v-else class="sm mut">Bạn không chuyển cửa hàng cho nhân viên này được.</div>
      </div>
    </div>

    <!-- Tạm dừng -->
    <div class="card pad stack">
      <div class="h2">Tạm dừng lượt Level</div>
      <div class="sm mut">
        Nghỉ dài ngày, thai sản…: mọi mốc chưa xong từ ngày bắt đầu tạm dừng lùi đúng số ngày nghỉ. CHT đề xuất, QLKV hoặc BP Đào tạo duyệt.
      </div>
      <table v-if="m.pauses.length" class="rt">
        <thead>
          <tr><th>Khoảng ngày</th><th>Lý do</th><th>Đề xuất</th><th>Trạng thái</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in m.pauses" :key="p.id">
            <td data-l="Khoảng ngày"><b>{{ fmtDate(p.from) }} → {{ fmtDate(p.to) }}</b> <span class="sm mut">({{ p.days }} ngày)</span></td>
            <td data-l="Lý do">{{ p.reason }}</td>
            <td data-l="Đề xuất" class="sm">{{ p.requestedByName }} · {{ fmtDateTime(p.requestedAt) }}</td>
            <td data-l="Trạng thái">
              <span class="pill" :class="STATUS[p.status][1]">{{ STATUS[p.status][0] }}</span>
              <div v-if="p.decidedByName" class="sm mut">{{ p.decidedByName }}<template v-if="p.decisionNote">: {{ p.decisionNote }}</template></div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="pending && m.permissions.decidePause" class="card pad stack" style="border-color: var(--accent)">
        <b>Duyệt đề xuất {{ fmtDate(pending.from) }} → {{ fmtDate(pending.to) }} ({{ pending.days }} ngày)</b>
        <textarea v-model="decideNote" rows="2" placeholder="Ghi chú (bắt buộc khi từ chối)" aria-label="Ghi chú duyệt"></textarea>
        <div class="rowf">
          <button class="btn pri" type="button" :disabled="busy" @click="decide(pending, true)">Duyệt tạm dừng</button>
          <button class="btn bad" type="button" :disabled="busy" @click="decide(pending, false)">Từ chối</button>
        </div>
      </div>
      <div v-else-if="pending" class="alert info"><div>Đề xuất đang chờ QLKV hoặc BP Đào tạo duyệt.</div></div>

      <div v-if="m.permissions.requestPause && !pending" class="form">
        <label class="f">Từ ngày<input v-model="pause.from" type="date" :min="m.startDate" /></label>
        <label class="f">Đến ngày<input v-model="pause.to" type="date" :min="pause.from" /></label>
        <label class="f" style="grid-column: span 2">Lý do<input v-model="pause.reason" placeholder="vd. Nghỉ thai sản" /></label>
        <div style="align-self: end">
          <button class="btn" type="button" :disabled="busy" @click="requestPause">
            {{ m.permissions.decidePause ? 'Tạm dừng' : 'Gửi đề xuất tạm dừng' }}<template v-if="pauseDays"> ({{ pauseDays }} ngày)</template>
          </button>
        </div>
      </div>
    </div>

    <!-- Ngừng theo dõi -->
    <div v-if="m.permissions.stop" class="card pad stack" style="border-color: var(--bad)">
      <div class="h2">Ngừng theo dõi (nghỉ việc)</div>
      <div class="sm mut">Lượt Level chuyển trạng thái Dừng, dữ liệu giữ nguyên. Tài khoản đăng nhập (nếu có) do BP Đào tạo khóa ở trang Quản trị.</div>
      <template v-if="m.buddyOf.length">
        <div class="alert"><div>{{ staffName }} đang là Buddy của {{ m.buddyOf.length }} nhân viên. Chọn người thay trước khi ngừng theo dõi.</div></div>
        <div v-for="a in m.buddyOf" :key="a.runId" class="rowf">
          <span class="grow"><b>{{ a.staffName }}</b> <span class="sm mut">Level {{ a.levelKey }} · {{ a.storeName }}</span></span>
          <select v-model.number="stop.handover[a.runId]" :aria-label="`Buddy mới cho ${a.staffName}`">
            <option :value="undefined" disabled>Chọn Buddy mới</option>
            <option v-for="o in buddiesFor(a.staffUserId)" :key="o.id" :value="o.id">{{ o.fullName }} · {{ o.note }}</option>
          </select>
        </div>
      </template>
      <label class="f">Lý do<input v-model="stop.reason" placeholder="vd. Nghỉ việc từ 01/11" /></label>
      <div><button class="btn bad" type="button" :disabled="busy" @click="doStop">Ngừng theo dõi</button></div>
    </div>
  </div>
</template>
