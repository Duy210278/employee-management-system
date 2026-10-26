<script setup lang="ts">
import { ALERT_RULES, runTitle, type AlertRow } from '@lotrinh/shared';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAlerts, useMe } from '@/api/queries';
import SearchInput from '@/components/SearchInput.vue';
import SegControl from '@/components/SegControl.vue';

/** Cảnh báo (mục 11.6): mọi cảnh báo trong phạm vi, đỏ trước vàng sau */
const router = useRouter();
const { data: me } = useMe();
const { data, isLoading, error } = useAlerts(computed(() => !!me.value && me.value.user.role !== 'nv'));
const severity = ref<'' | 'red' | 'yellow'>('');
const store = ref('');
const q = ref('');
const stores = computed(() => [...new Set((data.value?.items ?? []).map((i) => i.storeName))].sort());
const items = computed(() =>
  (data.value?.items ?? []).filter(
    (i) =>
      (!severity.value || i.severity === severity.value) &&
      (!store.value || i.storeName === store.value) &&
      (!q.value || `${i.staffName} ${i.employeeCode ?? ''} ${i.message}`.toLowerCase().includes(q.value.trim().toLowerCase())),
  ),
);
const severityOptions = computed(() => [
  { value: '' as const, label: 'Tất cả' },
  { value: 'red' as const, label: 'Đỏ', count: data.value?.counts.red ?? 0 },
  { value: 'yellow' as const, label: 'Vàng', count: data.value?.counts.yellow ?? 0 },
]);

function openRow(a: AlertRow, e: MouseEvent) {
  if ((e.target as HTMLElement).closest('a, button')) return;
  void router.push(`/nhan-su/${a.staffId}`);
}
</script>

<template>
  <div v-if="me?.user.role === 'nv'" class="card empty"><h3>Trang Cảnh báo dành cho CHT, QLKV và BP Đào tạo</h3></div>
  <div v-else-if="isLoading" class="card empty">Đang tính cảnh báo…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="data" class="page">
    <div class="grid g3">
      <div class="card stat" :class="{ bad: data.counts.red }"><b>{{ data.counts.red }}</b><span>Cảnh báo đỏ</span></div>
      <div class="card stat" :class="{ warn: data.counts.yellow }"><b>{{ data.counts.yellow }}</b><span>Cảnh báo vàng</span></div>
      <div class="card stat"><b>{{ data.counts.staff }}</b><span>Nhân sự có cảnh báo</span></div>
    </div>

    <div class="card toolbar">
      <SearchInput v-model="q" placeholder="Tìm tên, mã NV, nội dung" label="Tìm cảnh báo" />
      <select v-model="store" aria-label="Cửa hàng">
        <option value="">Mọi cửa hàng</option>
        <option v-for="s in stores" :key="s" :value="s">{{ s }}</option>
      </select>
      <div class="grp">
        <span class="lbl">Mức:</span>
        <SegControl v-model="severity" :options="severityOptions" label="Lọc theo mức cảnh báo" />
      </div>
    </div>

    <div class="summary">Đang hiển thị <b>{{ items.length }}</b>/{{ data.items.length }} cảnh báo</div>

    <div class="card">
      <table v-if="items.length" class="rt click">
        <thead>
          <tr><th>Mức</th><th>Nhân viên</th><th>Level</th><th>Cửa hàng</th><th>Nội dung</th></tr>
        </thead>
        <tbody>
          <tr v-for="(a, i) in items" :key="`${a.staffId}-${a.key}-${i}`" @click="openRow(a, $event)">
            <td data-l="Mức"><span class="pill" :class="a.severity === 'red' ? 'bad' : 'warn'">{{ a.severity === 'red' ? 'Đỏ' : 'Vàng' }}</span></td>
            <td data-l="Nhân viên">
              <div>
                <RouterLink class="b" :to="`/nhan-su/${a.staffId}`">{{ a.staffName }}</RouterLink>
                <div v-if="a.employeeCode" class="sm mut">{{ a.employeeCode }}</div>
              </div>
            </td>
            <td data-l="Level"><span class="pill info" :title="runTitle(a)">{{ a.track === 'nvbh' ? `L${a.levelKey}` : 'CHT' }}</span></td>
            <td data-l="Cửa hàng">{{ a.storeName }}</td>
            <td data-l="Nội dung">{{ a.message }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">
        <h3>{{ data.items.length ? 'Không có cảnh báo khớp bộ lọc' : 'Không có cảnh báo nào' }}</h3>
        <div v-if="!data.items.length">Mọi nhân sự trong phạm vi của bạn đang đúng tiến độ.</div>
      </div>
    </div>

    <details class="card pad">
      <summary><b>Quy tắc cảnh báo</b> <span class="sm mut">(mục 11.6)</span></summary>
      <ul class="ul sm" style="margin-top: 10px">
        <li v-for="r in ALERT_RULES" :key="r.key"><span class="pill" :class="r.severity === 'red' ? 'bad' : 'warn'">{{ r.severity === 'red' ? 'Đỏ' : 'Vàng' }}</span> {{ r.label }}</li>
      </ul>
      <div class="sm mut" style="margin-top: 8px">Cảnh báo tính trực tiếp từ dữ liệu mỗi lần mở trang, nên luôn khớp với ngày giả lập.</div>
    </details>
  </div>
</template>
