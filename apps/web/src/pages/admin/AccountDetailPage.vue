<script setup lang="ts">
import {
  ASSIGNMENT_LABEL,
  canHoldAssignment,
  ROLE_LABEL,
  runTitle,
  UpdateUserBody,
  USER_STATUS_LABEL,
  type AccountRole,
  type AssignmentView,
  type UserDetailResponse,
} from '@lotrinh/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ApiError } from '@/api/client';
import { userApi, useStaffProfile, useUser } from '@/api/queries';
import ChtRunForm from '@/components/cht/ChtRunForm.vue';
import StaffRunForm from '@/components/StaffRunForm.vue';
import { useToast } from '@/composables/toast';
import { fmtDateTime } from '@/format';
import ScopePicker from './ScopePicker.vue';

/** Chi tiết tài khoản (mục 5.3, 5.4): thông tin, vai trò, phạm vi, quyền bổ sung, trạng thái, lịch sử; chuyển giao khi khóa (R20) */
const route = useRoute();
const qc = useQueryClient();
const toast = useToast();
const id = computed(() => Number(route.params.id));
const { data: d, isLoading, error } = useUser(id);
const busy = ref(false);

const info = reactive({ fullName: '', employeeCode: '', phone: '', status: 'active' as 'active' | 'locked' | 'left' });
const scope = ref({ role: 'nv' as AccountRole, storeIds: [] as number[], areaIds: [] as number[], canBuddy: false, canApproveVersions: false });
const handover = reactive<Record<string, number>>({});
const rejectNote = ref('');

function load(v: UserDetailResponse) {
  const u = v.user;
  Object.assign(info, { fullName: u.fullName, employeeCode: u.employeeCode ?? '', phone: u.phone ?? '', status: ['locked', 'left'].includes(u.status) ? u.status : 'active' });
  // Tài khoản chờ duyệt: điền sẵn theo đề nghị lúc đăng ký
  const r = u.status === 'pending' ? u.requested : null;
  scope.value = {
    role: r?.role ?? u.role,
    storeIds: r ? (r.role === 'cht' && r.storeId ? [r.storeId] : []) : u.stores.map((s) => s.id),
    areaIds: r ? (r.role === 'qlkv' && r.areaId ? [r.areaId] : []) : u.areas.map((a) => a.id),
    canBuddy: u.canBuddy,
    canApproveVersions: u.canApproveVersions,
  };
  for (const k of Object.keys(handover)) delete handover[k];
}
watch(d, (v) => v && load(v), { immediate: true });

const key = (a: AssignmentView) => `${a.runId}:${a.role}`;
/** Phân công không còn hợp lệ với tài khoản sau khi sửa (cùng quy tắc với máy chủ) */
const affected = computed(() =>
  (d.value?.assignments ?? []).filter((a) => !canHoldAssignment(a.role, { role: scope.value.role, status: info.status, canBuddy: scope.value.canBuddy })),
);
const candidates = (a: AssignmentView) => (d.value?.candidates[a.role] ?? []).filter((c) => c.id !== id.value && !(a.role === 'buddy' && c.id === a.staffUserId));
const isReviewed = computed(() => !!d.value && !['pending', 'rejected'].includes(d.value.user.status));

// Lộ trình và checklist của tài khoản NV (mục 9.1): chưa có hồ sơ thì gán checklist ngay tại đây
const isActiveNv = computed(() => d.value?.user.role === 'nv' && d.value.user.status === 'active');
// Tài khoản CHT: gán checklist onboarding (mới tuyển, hoặc thăng tiến từ NVBH thì dùng lại hồ sơ đào tạo cũ)
const isActiveCht = computed(() => d.value?.user.role === 'cht' && d.value.user.status === 'active');
const staffId = computed(() => (isActiveNv.value || isActiveCht.value ? (d.value?.user.staffId ?? null) : null));
const { data: profile } = useStaffProfile(staffId);
const chtRun = computed(() => (isActiveCht.value && profile.value?.run && profile.value.run.track !== 'nvbh' ? profile.value.run : null));
const showChtForm = computed(() => isActiveCht.value && (!d.value?.user.staffId || (!!profile.value && !chtRun.value)));
const runText = computed(() => {
  const r = profile.value?.run;
  const l = profile.value?.level;
  if (!r || !l) return '';
  const day = r.dayIndex < 0 ? `bắt đầu sau ${-r.dayIndex} ngày` : `ngày ${r.dayIndex + 1}/${l.totalDays}`;
  const name = r.track === 'nvbh' ? `Level ${r.levelKey} · ${l.name} (${l.checklistName} v${r.versionCode})` : `${runTitle(r)} (v${r.versionCode})`;
  return `${name} · ${day} · ${r.progress.done}/${r.progress.total} mục (${Math.round(r.progress.pct * 100)}%)`;
});
const accountForForm = computed(() =>
  d.value ? { id: d.value.user.id, fullName: d.value.user.fullName, employeeCode: d.value.user.employeeCode, storeId: d.value.user.requested?.storeId ?? null } : undefined,
);

async function act(fn: () => Promise<UserDetailResponse>, done: string) {
  busy.value = true;
  try {
    const res = await fn();
    qc.setQueryData(['users', id.value], res);
    await qc.invalidateQueries({ queryKey: ['users'], exact: true });
    toast.show(done);
  } catch (err) {
    toast.show((err as Error).message);
    if (err instanceof ApiError && err.code === 'STALE') await qc.invalidateQueries({ queryKey: ['users', id.value] });
  } finally {
    busy.value = false;
  }
}

function save() {
  const missing = affected.value.filter((a) => !handover[key(a)]);
  if (missing.length) return toast.show(`Chọn người thay cho ${missing.length} phân công ở khung "Chuyển giao"`);
  const parsed = UpdateUserBody.safeParse({
    ...info,
    employeeCode: info.employeeCode || null,
    ...scope.value,
    rowVersion: d.value!.user.rowVersion,
    handover: affected.value.map((a) => ({ runId: a.runId, role: a.role, userId: handover[key(a)] })),
  });
  if (!parsed.success) return toast.show(parsed.error.issues[0]?.message ?? 'Kiểm tra lại thông tin');
  void act(() => userApi.update(id.value, parsed.data), 'Đã lưu tài khoản');
}
const approve = () => act(() => userApi.approve(id.value, scope.value), `Đã duyệt, vai trò ${ROLE_LABEL[scope.value.role]}`);
function reject() {
  if (!rejectNote.value.trim()) return toast.show('Nhập lý do từ chối');
  void act(() => userApi.reject(id.value, rejectNote.value.trim()), 'Đã từ chối đăng ký');
}
</script>

<template>
  <div class="stack">
    <div><RouterLink class="btn sm" to="/quan-tri/tai-khoan">← Danh sách tài khoản</RouterLink></div>
    <div v-if="isLoading" class="card empty">Đang tải…</div>
    <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
    <template v-else-if="d">
      <div class="card pad stack">
        <div class="rowf sp">
          <div>
            <div class="h1">{{ d.user.fullName }}</div>
            <div class="sm mut">
              {{ d.user.email }} · tạo {{ fmtDateTime(d.user.createdAt) }} · lần vào cuối {{ fmtDateTime(d.user.lastSeenAt) || 'chưa đăng nhập' }}
              <template v-if="d.user.staffId"> · <RouterLink :to="`/nhan-su/${d.user.staffId}`">hồ sơ NV {{ d.user.staffName }}</RouterLink></template>
            </div>
          </div>
          <span class="pill" :class="{ ok: d.user.status === 'active', warn: d.user.status === 'pending' || d.user.status === 'locked', bad: d.user.status === 'rejected' }">
            {{ USER_STATUS_LABEL[d.user.status] }}
          </span>
        </div>
        <div v-if="d.user.status === 'rejected'" class="alert bad"><div><b>Lý do từ chối:</b> {{ d.user.reviewNote }}</div></div>
      </div>

      <!-- Duyệt đăng ký (mục 5.1) -->
      <div v-if="d.user.status === 'pending'" class="grid g2" style="align-items: start">
        <div class="card pad stack" style="border-color: var(--accent)">
          <div class="h2">Duyệt đăng ký</div>
          <div class="sm">
            Đề nghị: <b>{{ ROLE_LABEL[d.user.requested?.role ?? d.user.role] }}</b>
            <template v-if="d.user.requested?.storeName"> · {{ d.user.requested.storeName }}</template>
            <template v-if="d.user.requested?.areaName"> · {{ d.user.requested.areaName }}</template>
            · mã NV {{ d.user.employeeCode }}<template v-if="d.user.phone"> · {{ d.user.phone }}</template>
          </div>
          <ScopePicker v-model="scope" :options="d.options" />
          <div><button class="btn pri" type="button" :disabled="busy" @click="approve">Duyệt tài khoản</button></div>
        </div>
        <div class="card pad stack">
          <div class="h2">Từ chối</div>
          <div class="sm mut">Không xóa bản ghi; tài khoản chuyển "Bị từ chối" kèm lý do, người đăng ký thấy lý do khi đăng nhập.</div>
          <textarea v-model="rejectNote" rows="3" placeholder="Lý do từ chối (bắt buộc)" aria-label="Lý do từ chối"></textarea>
          <div><button class="btn bad" type="button" :disabled="busy" @click="reject">Từ chối đăng ký</button></div>
        </div>
      </div>

      <!-- Lộ trình và checklist (tài khoản NV đang hoạt động) -->
      <div v-if="isActiveNv" class="card pad stack" :style="d.user.staffId ? '' : 'border-color: var(--accent)'">
        <div class="h2">Lộ trình và checklist</div>
        <template v-if="d.user.staffId">
          <div class="rowf sp">
            <div>
              <template v-if="profile?.staff.active === false">Hồ sơ đã ngừng theo dõi.</template>
              <template v-else-if="runText">Đang theo <b>{{ runText }}</b></template>
              <template v-else>Đang tải lộ trình…</template>
            </div>
            <div class="rowf">
              <RouterLink class="btn sm" :to="{ path: `/nhan-su/${d.user.staffId}`, query: { tab: 'check' } }">Mở checklist</RouterLink>
              <RouterLink class="btn sm" :to="{ path: `/nhan-su/${d.user.staffId}`, query: { tab: 'manage' } }">Phân công & tạm dừng</RouterLink>
            </div>
          </div>
          <div class="sm mut">Lên Level tiếp theo qua phiếu đánh giá ở tab "Chuyển Level"; đổi Buddy, CHT, QLKV hoặc tạm dừng ở tab "Phân công & tạm dừng".</div>
        </template>
        <template v-else>
          <div class="sm mut">Tài khoản chưa có hồ sơ nhân viên nên chưa có checklist. Chọn Level, nhà thuốc và người phụ trách để gán checklist.</div>
          <StaffRunForm v-if="accountForForm" :key="d.user.id" :account="accountForForm" submit-label="Gán checklist" />
        </template>
      </div>

      <!-- Checklist onboarding (tài khoản CHT đang hoạt động) -->
      <div v-if="isActiveCht" class="card pad stack" :style="showChtForm ? 'border-color: var(--accent)' : ''">
        <div class="h2">Checklist onboarding CHT</div>
        <template v-if="chtRun">
          <div class="rowf sp">
            <div>
              <template v-if="chtRun.status === 'passed'">Đã hoàn thành <b>{{ runTitle(chtRun) }}</b> (QLKV đã xác nhận tổng kết tuần đầu).</template>
              <template v-else>Đang theo <b>{{ runText }}</b></template>
            </div>
            <div class="rowf">
              <RouterLink class="btn sm" :to="{ path: `/nhan-su/${d.user.staffId}`, query: { tab: 'check' } }">Mở checklist</RouterLink>
              <RouterLink class="btn sm" :to="{ path: `/nhan-su/${d.user.staffId}`, query: { tab: 'cht-journal' } }">Nhật ký theo dõi</RouterLink>
              <RouterLink class="btn sm" :to="{ path: `/nhan-su/${d.user.staffId}`, query: { tab: 'manage' } }">Phân công</RouterLink>
            </div>
          </div>
        </template>
        <template v-else-if="showChtForm">
          <div class="sm mut">
            Chọn loại checklist (CHT mới tuyển hoặc thăng tiến từ NVBH), cửa hàng, Ngày D và người phụ trách Đào tạo. Đào tạo ghi nhật ký check-in hằng ngày và
            đánh giá tuần đầu; QLKV xác nhận tổng kết.
          </div>
          <ChtRunForm :key="d.user.id" :user-id="d.user.id" />
        </template>
        <div v-else class="sm mut">Đang tải…</div>
      </div>

      <!-- Sửa tài khoản (mục 5.3) -->
      <form v-if="isReviewed" class="card pad stack" @submit.prevent="save">
        <div class="h2">Thông tin và quyền</div>
        <div class="form">
          <label class="f">Họ và tên<input v-model="info.fullName" required /></label>
          <label class="f">Mã nhân viên<input v-model="info.employeeCode" /></label>
          <label class="f">Điện thoại<input v-model="info.phone" /></label>
          <label class="f">
            Trạng thái
            <select v-model="info.status">
              <option value="active">Hoạt động</option>
              <option value="locked">Tạm khóa</option>
              <option value="left">Đã nghỉ</option>
            </select>
          </label>
        </div>
        <ScopePicker v-model="scope" :options="d.options" />
        <div v-if="d.isLastBp" class="alert info">
          <div>Đây là tài khoản BP Đào tạo hoạt động cuối cùng: không hạ quyền hoặc khóa được cho tới khi có BP Đào tạo khác (R19).</div>
        </div>

        <!-- Chuyển giao (mục 5.4 điều 3, R20) -->
        <div v-if="affected.length" class="card pad stack" style="border-color: var(--warn)">
          <b>Chuyển giao {{ affected.length }} phân công</b>
          <div class="sm mut">
            Sau khi lưu, {{ d.user.fullName }} không còn giữ được các phân công dưới đây. Chọn người thay; người mới nhận các việc chưa xác nhận, xác nhận cũ giữ
            nguyên tên.
          </div>
          <div v-for="a in affected" :key="key(a)" class="rowf">
            <span class="grow">
              <b>{{ a.staffName }}</b> <span class="sm mut">Level {{ a.levelKey }} · {{ a.storeName }}</span> <span class="pill">{{ ASSIGNMENT_LABEL[a.role] }}</span>
            </span>
            <select v-model.number="handover[key(a)]" :aria-label="`Người thay ${ASSIGNMENT_LABEL[a.role]} cho ${a.staffName}`">
              <option :value="undefined" disabled>Chọn người thay</option>
              <option v-for="c in candidates(a)" :key="c.id" :value="c.id">{{ c.fullName }} · {{ c.note }}</option>
            </select>
          </div>
        </div>

        <div class="rowf">
          <button class="btn pri" type="submit" :disabled="busy">Lưu thay đổi</button>
          <button class="btn" type="button" :disabled="busy" @click="load(d)">Hoàn tác</button>
        </div>
      </form>

      <div class="grid g2" style="align-items: start">
        <div class="card">
          <div class="stg"><b>Đang phụ trách</b><span class="sm mut">{{ d.assignments.length }} phân công trên lượt Level đang mở</span></div>
          <table v-if="d.assignments.length" class="rt">
            <tbody>
              <tr v-for="a in d.assignments" :key="key(a)">
                <td data-l="Nhân viên"><RouterLink :to="`/nhan-su/${a.staffId}`">{{ a.staffName }}</RouterLink></td>
                <td data-l="Vai trò"><span class="pill">{{ ASSIGNMENT_LABEL[a.role] }}</span></td>
                <td data-l="Level" class="sm mut">Level {{ a.levelKey }} · {{ a.storeName }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty sm">Không phụ trách lượt nào.</div>
        </div>
        <div class="card">
          <div class="stg"><b>Lịch sử thay đổi</b></div>
          <table v-if="d.history.length" class="rt">
            <tbody>
              <tr v-for="h in d.history" :key="h.id">
                <td data-l="Lúc" class="sm mut nowrap">{{ fmtDateTime(h.at) }}</td>
                <td data-l="Thay đổi">
                  <b>{{ h.fieldLabel }}</b>
                  <div class="sm">
                    <template v-if="h.oldValue">{{ h.oldValue }} → </template>{{ h.newValue ?? '—' }}
                  </div>
                </td>
                <td data-l="Người đổi" class="sm">{{ h.byName ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty sm">Chưa có thay đổi.</div>
        </div>
      </div>
    </template>
  </div>
</template>
