<script setup lang="ts">
import { addDays, type VersionDetailResponse, type VersionState } from '@lotrinh/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router';
import { ApiError } from '@/api/client';
import { versionApi } from '@/api/queries';
import { useToast } from '@/composables/toast';
import { createDesigner, type DesignerTab } from '@/designer/editor';
import { fmtDate, fmtDateTime } from '@/format';
import ChecklistEditor from './ChecklistEditor.vue';
import ChtEditor from './ChtEditor.vue';
import FrameworkEditor from './FrameworkEditor.vue';
import ScheduleParamsEditor from './ScheduleParamsEditor.vue';

/** Soạn, gửi duyệt, duyệt một phiên bản Bộ lộ trình (mục 7.3, 8.2) */
const props = defineProps<{ detail: VersionDetailResponse }>();
const router = useRouter();
const qc = useQueryClient();
const toast = useToast();

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const content = ref(clone(props.detail.content));
const changeNote = ref(props.detail.version.changeNote ?? '');
const baseline = ref(JSON.stringify(props.detail.content));
const baselineNote = ref(props.detail.version.changeNote ?? '');
const busy = ref(false);
const showChanges = ref(false);
const showIssues = ref(true);
const effectiveFrom = ref(addDays(props.detail.today, 1));
const rejectNote = ref('');

const d = createDesigner(toRef(props, 'detail'), content);
const tab = d.tab;
const TABS: [DesignerTab, string][] = [
  ['framework', 'Khung năng lực'],
  ['checklist', 'Checklist theo giai đoạn'],
  ['cht', 'Checklist CHT'],
  ['settings', 'Thiết lập chung'],
];
const v = computed(() => props.detail.version);
const perm = computed(() => props.detail.permissions);
const dirty = computed(() => perm.value.edit && (JSON.stringify(content.value) !== baseline.value || changeNote.value !== baselineNote.value));

// Máy chủ trả bản mới (sau khi lưu, gửi duyệt, đổi bản đang xem) thì nạp lại bản sao để soạn
watch(
  () => [props.detail.version.id, props.detail.version.rowVersion, props.detail.version.state] as const,
  () => {
    content.value = clone(props.detail.content);
    baseline.value = JSON.stringify(props.detail.content);
    changeNote.value = props.detail.version.changeNote ?? '';
    baselineNote.value = changeNote.value;
  },
);

const STATE_LABEL: Record<VersionState, [string, string]> = {
  draft: ['Bản nháp', 'warn'],
  pending: ['Chờ duyệt', 'info'],
  current: ['Đang hiệu lực', 'ok'],
  scheduled: ['Sắp hiệu lực', 'info'],
  expired: ['Hết hiệu lực', ''],
};
const title = computed(() => (v.value.code ? `Bộ lộ trình v${v.value.code}` : 'Bản nháp Bộ lộ trình'));
const refYear = computed(() => Number(props.detail.today.slice(0, 4)));

async function run<T>(fn: () => Promise<T>, success: string): Promise<T | undefined> {
  busy.value = true;
  try {
    const res = await fn();
    toast.show(success);
    await qc.invalidateQueries({ queryKey: ['versions'] });
    return res;
  } catch (err) {
    toast.show(err instanceof Error ? err.message : 'Không thực hiện được');
    if (err instanceof ApiError && err.code === 'STALE') await qc.invalidateQueries({ queryKey: ['version', v.value.id] });
    return undefined;
  } finally {
    busy.value = false;
  }
}

async function save(): Promise<boolean> {
  const res = await run(() => versionApi.save(v.value.id, content.value, changeNote.value, v.value.rowVersion), 'Đã lưu bản nháp');
  if (res) qc.setQueryData(['version', v.value.id], res);
  return !!res;
}

async function submit() {
  if (d.counts.value.errors) {
    showIssues.value = true;
    toast.show(`Còn ${d.counts.value.errors} lỗi. Bấm vào từng lỗi để sửa trước khi gửi duyệt`);
    return;
  }
  if (!changeNote.value.trim()) {
    toast.show('Nhập ghi chú thay đổi trước khi gửi duyệt');
    document.getElementById('change-note')?.focus();
    return;
  }
  if (dirty.value && !(await save())) return;
  const res = await run(() => versionApi.submit(v.value.id, changeNote.value), 'Đã gửi duyệt');
  if (res) qc.setQueryData(['version', v.value.id], res);
}

async function act(fn: () => Promise<VersionDetailResponse>, success: string) {
  const res = await run(fn, success);
  if (res) qc.setQueryData(['version', v.value.id], res);
}
const withdraw = () => act(() => versionApi.withdraw(v.value.id), 'Đã rút về nháp');
const approve = () => {
  if (!confirm(`Duyệt và ban hành, hiệu lực từ ${fmtDate(effectiveFrom.value)}?`)) return;
  void act(() => versionApi.approve(v.value.id, effectiveFrom.value), 'Đã duyệt và ban hành');
};
// Đổi ngày hiệu lực của bản đã duyệt nhưng chưa tới ngày ("Sắp hiệu lực")
const newEffective = ref(props.detail.version.effectiveFrom ?? '');
watch(
  () => props.detail.version.effectiveFrom,
  (date) => (newEffective.value = date ?? ''),
);
const range = computed(() => props.detail.effectiveRange);
const reschedule = () => {
  const from = v.value.effectiveFrom;
  if (!newEffective.value || newEffective.value === from) return;
  if (!confirm(`Đổi ngày hiệu lực v${v.value.code} từ ${fmtDate(from)} sang ${fmtDate(newEffective.value)}?`)) return;
  void act(() => versionApi.reschedule(v.value.id, newEffective.value), `Đã đổi ngày hiệu lực sang ${fmtDate(newEffective.value)}`);
};
const reject = () => {
  if (!rejectNote.value.trim()) {
    toast.show('Nhập lý do trả về để BP Đào tạo biết cần sửa gì');
    return;
  }
  void act(() => versionApi.reject(v.value.id, rejectNote.value.trim()), 'Đã trả về nháp');
};
async function remove() {
  if (!confirm('Xóa bản nháp này? Mọi chỉnh sửa trong bản nháp sẽ mất.')) return;
  const res = await run(() => versionApi.remove(v.value.id), 'Đã xóa bản nháp');
  if (res) {
    baseline.value = JSON.stringify(content.value);
    await router.push('/thiet-ke');
  }
}
async function createDraft() {
  const res = await run(() => versionApi.createDraft(v.value.id), `Đã tạo bản nháp từ v${v.value.code}`);
  if (res) await router.push(`/thiet-ke/${res.id}`);
}
function discard() {
  if (!confirm('Bỏ mọi thay đổi chưa lưu?')) return;
  content.value = clone(props.detail.content);
  changeNote.value = baselineNote.value;
}

// Không để mất thay đổi chưa lưu
const guard = () => !dirty.value || confirm('Bản nháp có thay đổi chưa lưu. Rời trang và bỏ thay đổi?');
onBeforeRouteLeave(guard);
onBeforeRouteUpdate(guard);
const beforeUnload = (e: BeforeUnloadEvent) => {
  if (dirty.value) e.preventDefault();
};
const onKey = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && perm.value.edit) {
    e.preventDefault();
    if (dirty.value && !busy.value) void save();
  }
};
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload);
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload);
  window.removeEventListener('keydown', onKey);
});
</script>

<template>
  <div class="stack">
    <div class="card pad stack">
      <div class="rowf sp">
        <div>
          <div class="rowf" style="gap: 8px">
            <div class="h1">{{ title }}</div>
            <span class="pill" :class="STATE_LABEL[v.state][1]">{{ STATE_LABEL[v.state][0] }}</span>
          </div>
          <div class="sm mut">
            <template v-if="v.parentCode">Tạo từ v{{ v.parentCode }}</template>
            <template v-if="v.createdByName"> · {{ v.createdByName }} {{ fmtDateTime(v.createdAt) }}</template>
            <template v-if="v.effectiveFrom"> · Hiệu lực {{ fmtDate(v.effectiveFrom, refYear) }}<template v-if="v.effectiveTo"> → {{ fmtDate(v.effectiveTo, refYear) }}</template></template>
            <template v-if="v.approvedByName"> · Duyệt bởi {{ v.approvedByName }}</template>
            <template v-if="v.criteriaLine && v.activeRuns"> · {{ v.activeRuns }} lượt Level đang chạy theo dòng {{ v.criteriaLine }}</template>
          </div>
        </div>
        <div class="rowf">
          <a class="btn sm" :href="versionApi.exportUrl(v.id)" download>Xuất JSON</a>
          <button v-if="perm.createDraft" class="btn sm" type="button" :disabled="busy" @click="createDraft">Tạo bản nháp từ bản này</button>
          <button v-if="perm.remove" class="btn sm bad" type="button" :disabled="busy" @click="remove">Xóa nháp</button>
          <button v-if="perm.edit" class="btn sm" type="button" :disabled="busy || !dirty" @click="save">Lưu nháp</button>
          <button v-if="perm.submit" class="btn sm pri" type="button" :disabled="busy" @click="submit">Gửi duyệt</button>
          <button v-if="perm.withdraw" class="btn sm" type="button" :disabled="busy" @click="withdraw">Rút về nháp</button>
        </div>
      </div>

      <div v-if="v.state === 'draft' && v.reviewNote" class="alert bad"><div><b>Người duyệt trả về:</b> {{ v.reviewNote }}</div></div>

      <label v-if="perm.edit" class="f">
        Ghi chú thay đổi (bắt buộc khi gửi duyệt)
        <textarea id="change-note" v-model="changeNote" rows="2" placeholder="Ví dụ: bổ sung CHT cùng xác nhận mục Nhận việc"></textarea>
      </label>
      <div v-else-if="v.changeNote" class="sm"><b>Ghi chú thay đổi:</b> {{ v.changeNote }}</div>

      <!-- Dải tác động (mục 7.3) -->
      <template v-if="v.state === 'draft' || v.state === 'pending'">
        <div v-if="!d.summary.value" class="alert info"><div>Bản khởi tạo, không có bản gốc để so sánh.</div></div>
        <div v-else-if="!d.summary.value.kind" class="alert"><div>Chưa có thay đổi nào so với v{{ v.parentCode }}.</div></div>
        <div v-else class="alert" :class="d.summary.value.kind === 'criteria' ? '' : 'info'">
          <div class="stack" style="gap: 6px; width: 100%">
            <div v-if="d.summary.value.kind === 'criteria'">
              <b>Có {{ d.summary.value.criteria }} thay đổi tiêu chí</b><template v-if="d.summary.value.text"> và {{ d.summary.value.text }} sửa diễn đạt</template>: chỉ áp
              dụng cho lượt Level bắt đầu từ ngày hiệu lực; NV đang dở Level giữ nguyên phiên bản cũ.
            </div>
            <div v-else>
              <b>Chỉ sửa diễn đạt ({{ d.summary.value.text }} thay đổi):</b> áp dụng ngay cho mọi NV đang chạy theo dòng tiêu chí
              {{ detail.parentLine }} khi có hiệu lực.
            </div>
            <div class="rowf sm">
              <span>Số phiên bản đề xuất: <b>v{{ d.proposedCode.value }}</b></span>
              <button class="btn sm" type="button" @click="showChanges = !showChanges">{{ showChanges ? 'Ẩn' : 'Xem' }} danh sách thay đổi</button>
            </div>
            <ul v-if="showChanges" class="ul sm">
              <li v-for="(c, i) in d.summary.value.changes" :key="i">
                <span class="pill" :class="c.kind === 'criteria' ? 'warn' : 'info'">{{ c.kind === 'criteria' ? 'Tiêu chí' : 'Diễn đạt' }}</span> {{ c.label }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Kiểm tra trước khi gửi duyệt (mục 6.2, 7.7) -->
        <div class="card" style="border-color: var(--line)">
          <button class="stg vb" type="button" :aria-expanded="showIssues" @click="showIssues = !showIssues">
            <b>Kiểm tra trước khi gửi duyệt</b>
            <span class="rowf">
              <span class="pill" :class="d.counts.value.errors ? 'bad' : 'ok'">{{ d.counts.value.errors }} lỗi</span>
              <span class="pill" :class="d.counts.value.warnings ? 'warn' : ''">{{ d.counts.value.warnings }} lưu ý</span>
            </span>
          </button>
          <ul v-if="showIssues && d.issues.value.length" class="vlist">
            <li v-for="(i, n) in d.issues.value" :key="n">
              <button type="button" :class="i.level" @click="d.focus(i.at)">
                <span class="mono sm">{{ i.code }}</span> {{ i.message }}
              </button>
            </li>
          </ul>
          <div v-else-if="showIssues" class="sm mut" style="padding: 10px 14px">Không có lỗi hay lưu ý nào.</div>
        </div>
      </template>

      <!-- Người duyệt phiên bản -->
      <div v-if="perm.approve" class="grid g2">
        <div class="card pad stack" style="border-color: var(--accent)">
          <div class="h2">Duyệt và ban hành</div>
          <label class="f" style="max-width: 220px">
            Ngày hiệu lực
            <input v-model="effectiveFrom" type="date" :min="detail.today" />
          </label>
          <div class="sm mut">
            Số phiên bản sẽ là <b>v{{ d.proposedCode.value }}</b>. Bản đang hiệu lực kết thúc ngày {{ fmtDate(addDays(effectiveFrom, -1)) }}.
          </div>
          <div><button class="btn pri" type="button" :disabled="busy || d.counts.value.errors > 0" @click="approve">Duyệt và ban hành</button></div>
        </div>
        <div class="card pad stack">
          <div class="h2">Trả về nháp</div>
          <textarea v-model="rejectNote" rows="3" placeholder="Lý do trả về (bắt buộc)" aria-label="Lý do trả về"></textarea>
          <div><button class="btn bad" type="button" :disabled="busy" @click="reject">Trả về nháp</button></div>
        </div>
      </div>

      <!-- Bản đã duyệt mà chưa tới ngày: còn đổi được ngày hiệu lực -->
      <div v-if="v.state === 'scheduled'" class="card pad stack" style="border-color: var(--info)">
        <div class="h2">Ngày hiệu lực</div>
        <template v-if="perm.reschedule && range">
          <div class="rowf" style="align-items: end">
            <label class="f" style="max-width: 220px">
              Ngày hiệu lực mới
              <input v-model="newEffective" type="date" :min="range.min" :max="range.max ?? undefined" />
            </label>
            <button class="btn" type="button" :disabled="busy || !newEffective || newEffective === v.effectiveFrom" @click="reschedule">Đổi ngày hiệu lực</button>
          </div>
          <div class="sm mut">
            Đang đặt hiệu lực từ <b>{{ fmtDate(v.effectiveFrom) }}</b>; chọn được từ {{ fmtDate(range.min) }}<template v-if="range.max"> đến {{ fmtDate(range.max) }}</template>.
            Bản đang hiệu lực sẽ kết thúc ngày {{ fmtDate(addDays(newEffective || v.effectiveFrom!, -1)) }}. Không đổi được nếu đã có lượt Level bắt đầu trong
            khoảng giữa ngày cũ và ngày mới, vì phiên bản gắn với lượt đó sẽ sai.
          </div>
        </template>
        <div v-else class="sm mut">
          Hiệu lực từ <b>{{ fmtDate(v.effectiveFrom) }}</b>. Trước ngày này, người duyệt phiên bản còn đổi được ngày hiệu lực.
        </div>
      </div>
    </div>

    <div class="sub" role="tablist">
      <button v-for="[k, label] in TABS" :key="k" type="button" role="tab" :aria-current="tab === k" :aria-selected="tab === k" @click="tab = k">{{ label }}</button>
    </div>
    <div v-if="!perm.edit && (v.state === 'draft' || v.state === 'pending')" class="sm mut">
      {{ v.state === 'pending' ? 'Bản đang chờ duyệt: chỉ xem. BP Đào tạo rút về nháp nếu cần sửa.' : 'Chỉ BP Đào tạo sửa được bản nháp.' }}
    </div>
    <div v-else-if="!perm.edit" class="sm mut">Bản đã ban hành không sửa được (R03). Muốn thay đổi, bấm "Tạo bản nháp từ bản này".</div>

    <FrameworkEditor v-if="tab === 'framework'" />
    <ChecklistEditor v-else-if="tab === 'checklist'" />
    <ChtEditor v-else-if="tab === 'cht'" />
    <ScheduleParamsEditor v-else />

    <div v-if="dirty" class="savebar">
      <span>Có thay đổi chưa lưu</span>
      <button class="btn sm" type="button" @click="discard">Hoàn tác</button>
      <button class="btn sm pri" type="button" :disabled="busy" @click="save">Lưu nháp (Ctrl+S)</button>
    </div>
  </div>
</template>
