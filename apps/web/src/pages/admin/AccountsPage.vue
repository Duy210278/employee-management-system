<script setup lang="ts">
import { ACCOUNT_ROLES, ROLE_LABEL, USER_STATUS_LABEL, USER_STATUSES, type UserListItem } from '@lotrinh/shared';
import { computed, ref } from 'vue';
import { useUsers } from '@/api/queries';
import SearchInput from '@/components/SearchInput.vue';
import { fmtDateTime } from '@/format';

const { data, isLoading, error } = useUsers();
const q = ref('');
const role = ref('');
const status = ref('');
const store = ref(0);

const filtered = computed(() =>
  (data.value?.items ?? []).filter((u) => {
    const text = `${u.fullName} ${u.employeeCode ?? ''} ${u.email ?? ''}`.toLowerCase();
    return (
      (!q.value || text.includes(q.value.trim().toLowerCase())) &&
      (!role.value || u.role === role.value) &&
      (!status.value || u.status === status.value) &&
      (!store.value || u.stores.some((s) => s.id === store.value))
    );
  }),
);
const scopeText = (u: UserListItem) => [...u.stores.map((s) => s.name), ...u.areas.map((a) => a.name)].join(', ') || '—';
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="data" class="page">
    <div class="alert info">
      <div>Danh tính, vai trò, phạm vi và trạng thái lấy từ hệ thống chính. BP Đào tạo quản lý quyền Buddy tại module Lộ trình.</div>
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
          <option v-for="s in USER_STATUSES" :key="s" :value="s">{{ USER_STATUS_LABEL[s] }}</option>
        </select>
      </div>
    </div>
    <div class="summary">Đang hiển thị <b>{{ filtered.length }}</b>/{{ data.items.length }} tài khoản</div>

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
                <div class="sm mut">{{ u.employeeCode ?? '—' }} · {{ u.email ?? '—' }}</div>
              </div>
            </td>
            <td data-l="Vai trò"><span class="rl" :class="u.role">{{ ROLE_LABEL[u.role] }}</span></td>
            <td data-l="Phạm vi" class="sm">{{ scopeText(u) }}</td>
            <td data-l="Quyền bổ sung"><span v-if="u.canBuddy" class="pill">Buddy</span><span v-else class="sm mut">—</span></td>
            <td data-l="Hồ sơ NV">
              <RouterLink v-if="u.staffId" :to="`/nhan-su/${u.staffId}`" class="sm">Mở hồ sơ</RouterLink>
              <span v-else class="sm mut">—</span>
            </td>
            <td data-l="Trạng thái"><span class="pill">{{ USER_STATUS_LABEL[u.status] }}</span></td>
            <td data-l="Lần vào cuối" class="sm mut">{{ fmtDateTime(u.lastSeenAt) || 'Chưa đăng nhập' }}</td>
            <td><RouterLink class="btn sm" :to="`/quan-tri/tai-khoan/${u.id}`">Xem</RouterLink></td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty"><h3>Không có tài khoản khớp bộ lọc</h3></div>
    </div>
  </div>
</template>
