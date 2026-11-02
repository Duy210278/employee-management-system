<script setup lang="ts">
import { ACCOUNT_ROLES, CreateUserBody, ROLE_LABEL, USER_STATUS_LABEL, USER_STATUSES, type AccountRole, type UserListItem } from '@lotrinh/shared';
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMutate, userApi, useUsers } from '@/api/queries';
import SearchInput from '@/components/SearchInput.vue';
import { useToast } from '@/composables/toast';
import { fmtDateTime } from '@/format';
import ScopePicker from './ScopePicker.vue';

/** Tài khoản và vai trò (mục 5.2): hàng chờ duyệt ở đầu trang, bảng tài khoản có bộ lọc */
const router = useRouter();
const toast = useToast();
const mutate = useMutate();
const { data, isLoading, error } = useUsers();
const busy = ref(false);

const q = ref('');
const role = ref('');
const status = ref('');
const store = ref(0);
const items = computed(() => (data.value?.items ?? []).filter((u) => u.status !== 'pending'));
const pending = computed(() => (data.value?.items ?? []).filter((u) => u.status === 'pending'));
const filtered = computed(() =>
  items.value.filter((u) => {
    const text = `${u.fullName} ${u.employeeCode ?? ''} ${u.email}`.toLowerCase();
    return (
      (!q.value || text.includes(q.value.trim().toLowerCase())) &&
      (!role.value || u.role === role.value) &&
      (!status.value || u.status === status.value) &&
      (!store.value || u.stores.some((s) => s.id === store.value) || u.requested?.storeId === store.value)
    );
  }),
);
const scopeText = (u: UserListItem) => [...u.stores.map((s) => s.name), ...u.areas.map((a) => a.name)].join(', ') || '—';
const STATUS_FILTER = USER_STATUSES.filter((x) => x !== 'pending');
const STATUS_TONE: Record<string, string> = { active: 'ok', locked: 'warn', left: '', rejected: 'bad', pending: 'warn' };

// Duyệt nhanh theo đề nghị khi đăng ký; muốn chỉnh vai trò, phạm vi thì mở trang chi tiết
const rejecting = ref<number | null>(null);
const rejectNote = ref('');
function quickApprove(u: UserListItem) {
  const r = u.requested;
  const body = {
    role: r?.role ?? u.role,
    storeIds: r?.role === 'cht' && r.storeId ? [r.storeId] : [],
    areaIds: r?.role === 'qlkv' && r.areaId ? [r.areaId] : [],
    canBuddy: false,
  };
  void mutate(() => userApi.approve(u.id, body), `Đã duyệt ${u.fullName} (${ROLE_LABEL[body.role]})`);
}
async function reject(u: UserListItem) {
  if (!rejectNote.value.trim()) return toast.show('Nhập lý do từ chối');
  const res = await mutate(() => userApi.reject(u.id, rejectNote.value.trim()), `Đã từ chối đăng ký của ${u.fullName}`);
  if (res) {
    rejecting.value = null;
    rejectNote.value = '';
  }
}

// Tạo tài khoản trực tiếp (BP ĐT): tài khoản hoạt động ngay
const creating = ref(false);
const form = reactive({ fullName: '', employeeCode: '', email: '', phone: '', password: 'Upharma@123' });
const scope = ref({ role: 'nv' as AccountRole, storeIds: [] as number[], areaIds: [] as number[], canBuddy: false });
async function create() {
  const parsed = CreateUserBody.safeParse({ ...form, employeeCode: form.employeeCode || null, ...scope.value });
  if (!parsed.success) return toast.show(parsed.error.issues[0]?.message ?? 'Kiểm tra lại thông tin');
  busy.value = true;
  const res = await mutate(() => userApi.create(parsed.data), `Đã tạo tài khoản ${form.fullName}`);
  busy.value = false;
  if (res) await router.push(`/quan-tri/tai-khoan/${res.id}`);
}
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="data" class="page">
    <!-- Hàng chờ duyệt (mục 5.2) -->
    <div v-if="pending.length" class="card clip hl-warn">
      <div class="stg"><b>{{ pending.length }} tài khoản đang chờ duyệt</b><span class="sm mut">Duyệt theo đề nghị, hoặc mở chi tiết để chỉnh vai trò, phạm vi</span></div>
      <div v-for="u in pending" :key="u.id" class="item stack tight">
        <div class="rowf sp">
          <div>
            <b>{{ u.fullName }}</b> <span class="sm mut">{{ u.employeeCode }} · {{ u.email }}<template v-if="u.phone"> · {{ u.phone }}</template></span>
            <div class="sm">
              Đề nghị: <b>{{ ROLE_LABEL[u.requested?.role ?? u.role] }}</b>
              <template v-if="u.requested?.storeName"> · {{ u.requested.storeName }}</template>
              <template v-else-if="u.requested?.areaName"> · {{ u.requested.areaName }}</template>
              <span class="mut"> · đăng ký {{ fmtDateTime(u.createdAt) }}</span>
            </div>
          </div>
          <div class="rowf">
            <RouterLink class="btn sm" :to="`/quan-tri/tai-khoan/${u.id}`">Chi tiết</RouterLink>
            <button class="btn sm bad" type="button" @click="rejecting = rejecting === u.id ? null : u.id">Từ chối</button>
            <button class="btn sm pri" type="button" @click="quickApprove(u)">Duyệt</button>
          </div>
        </div>
        <div v-if="rejecting === u.id" class="rowf">
          <input v-model="rejectNote" class="grow" placeholder="Lý do từ chối (bắt buộc)" aria-label="Lý do từ chối" @keyup.enter="reject(u)" />
          <button class="btn sm bad" type="button" @click="reject(u)">Xác nhận từ chối</button>
        </div>
      </div>
    </div>

    <div class="card toolbar">
      <SearchInput v-model="q" placeholder="Tìm tên, mã NV, email" label="Tìm tài khoản" />
      <div class="grp">
        <select v-model="role" aria-label="Vai trò">
          <option value="">Mọi vai trò</option>
          <option v-for="r in ACCOUNT_ROLES" :key="r" :value="r">{{ ROLE_LABEL[r] }}</option>
        </select>
        <select v-model.number="store" aria-label="Cửa hàng">
          <option :value="0">Mọi cửa hàng</option>
          <option v-for="s in data.options.stores" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <select v-model="status" aria-label="Trạng thái">
          <option value="">Mọi trạng thái</option>
          <option v-for="s in STATUS_FILTER" :key="s" :value="s">{{ USER_STATUS_LABEL[s] }}</option>
        </select>
      </div>
      <div class="grp end">
        <RouterLink class="btn" to="/quan-tri/nhap-csv">Nhập từ CSV</RouterLink>
        <button class="btn pri" type="button" @click="creating = !creating">+ Tạo tài khoản</button>
      </div>
    </div>
    <div class="summary">Đang hiển thị <b>{{ filtered.length }}</b>/{{ data.items.length }} tài khoản</div>

    <form v-if="creating" class="card pad stack hl" @submit.prevent="create">
      <div class="h2">Tạo tài khoản</div>
      <div class="form">
        <label class="f">Họ và tên<input v-model="form.fullName" required /></label>
        <label class="f">Mã nhân viên<input v-model="form.employeeCode" /></label>
        <label class="f">Email<input v-model="form.email" type="email" required /></label>
        <label class="f">Điện thoại<input v-model="form.phone" /></label>
        <label class="f">Mật khẩu ban đầu<input v-model="form.password" required minlength="8" /></label>
      </div>
      <ScopePicker v-model="scope" :options="data.options" />
      <div class="rowf">
        <button class="btn pri" type="submit" :disabled="busy">Tạo tài khoản</button>
        <button class="btn" type="button" @click="creating = false">Hủy</button>
      </div>
    </form>

    <div class="card">
      <table v-if="filtered.length" class="rt">
        <thead>
          <tr><th>Họ tên</th><th>Vai trò</th><th>Phạm vi</th><th>Quyền bổ sung</th><th>Hồ sơ NV</th><th>Trạng thái</th><th>Lần vào cuối</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="u in filtered" :key="u.id">
            <td data-l="Họ tên">
              <div>
                <RouterLink class="b" :to="`/quan-tri/tai-khoan/${u.id}`">{{ u.fullName }}</RouterLink>
                <div class="sm mut">{{ u.employeeCode ?? '—' }} · {{ u.email }}</div>
              </div>
            </td>
            <td data-l="Vai trò"><span class="rl" :class="u.role">{{ ROLE_LABEL[u.role] }}</span></td>
            <td data-l="Phạm vi" class="sm">{{ scopeText(u) }}</td>
            <td data-l="Quyền bổ sung">
              <div class="rowf tight">
                <span v-if="u.canBuddy" class="pill">Buddy</span>
              </div>
            </td>
            <td data-l="Hồ sơ NV">
              <RouterLink v-if="u.staffId" :to="`/nhan-su/${u.staffId}`" class="sm">Mở hồ sơ</RouterLink>
              <RouterLink v-else-if="u.role === 'nv' && u.status === 'active'" :to="`/quan-tri/tai-khoan/${u.id}`" class="btn sm pri">Gán checklist</RouterLink>
              <RouterLink v-else-if="u.role === 'cht' && u.status === 'active'" :to="`/quan-tri/tai-khoan/${u.id}`" class="btn sm pri">Gán checklist CHT</RouterLink>
            </td>
            <td data-l="Trạng thái"><span class="pill" :class="STATUS_TONE[u.status]">{{ USER_STATUS_LABEL[u.status] }}</span></td>
            <td data-l="Lần vào cuối" class="sm mut">{{ fmtDateTime(u.lastSeenAt) || 'Chưa đăng nhập' }}</td>
            <td><RouterLink class="btn sm" :to="`/quan-tri/tai-khoan/${u.id}`">Sửa</RouterLink></td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty"><h3>Không có tài khoản khớp bộ lọc</h3></div>
    </div>
  </div>
</template>
