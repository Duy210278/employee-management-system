<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useAuditLogs } from '@/api/queries';
import { fmtDateTime } from '@/format';

/** Nhật ký hệ thống (mục 5.7): lọc theo người, loại thao tác, khoảng ngày; chỉ xem, không sửa, không xóa */
const filter = reactive({ userId: 0, action: '', from: '', to: '' });
const page = ref(1);
const params = computed(() => ({ ...filter, page: page.value }));
const { data, isLoading, error } = useAuditLogs(params);
watch(filter, () => (page.value = 1));
const pages = computed(() => (data.value ? Math.max(1, Math.ceil(data.value.total / data.value.pageSize)) : 1));
const open = ref<number | null>(null);
/** Nội dung gửi kèm thao tác, rút gọn cho bảng */
const brief = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return '';
  const text = Object.entries(payload as Record<string, unknown>)
    .filter(([k]) => !['rowVersion', 'content'].includes(k))
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
};
</script>

<template>
  <div class="stack">
    <div class="card toolbar">
      <select v-model.number="filter.userId" aria-label="Người thao tác">
        <option :value="0">Mọi người</option>
        <option v-for="u in data?.users" :key="u.id" :value="u.id">{{ u.fullName }}</option>
      </select>
      <select v-model="filter.action" aria-label="Loại thao tác">
        <option value="">Mọi thao tác</option>
        <option v-for="a in data?.actions" :key="a.value" :value="a.value">{{ a.label }}</option>
      </select>
      <label class="p">Từ<input v-model="filter.from" type="date" /></label>
      <label class="p">Đến<input v-model="filter.to" type="date" /></label>
    </div>

    <div v-if="isLoading" class="card empty">Đang tải…</div>
    <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
    <div v-else-if="data" class="card">
      <div class="stg"><b>{{ data.total }} bản ghi</b><span class="sm mut">Thời điểm thật của máy chủ (không theo ngày giả lập)</span></div>
      <table v-if="data.items.length" class="rt">
        <thead>
          <tr><th>Lúc</th><th>Người</th><th>Thao tác</th><th>Đối tượng</th><th>Chi tiết</th></tr>
        </thead>
        <tbody>
          <tr v-for="l in data.items" :key="l.id">
            <td data-l="Lúc" class="sm nowrap">{{ fmtDateTime(l.at) }}</td>
            <td data-l="Người">{{ l.userName ?? 'Hệ thống' }}</td>
            <td data-l="Thao tác"><b>{{ l.label }}</b></td>
            <td data-l="Đối tượng" class="sm mono">{{ l.entity }}<template v-if="l.entityId"> #{{ l.entityId }}</template></td>
            <td data-l="Chi tiết" class="sm mut">
              <button v-if="l.payload" class="linkbtn" type="button" @click="open = open === l.id ? null : l.id">{{ open === l.id ? 'Ẩn' : brief(l.payload) || 'Xem' }}</button>
              <pre v-if="open === l.id" class="mono sm payload">{{ JSON.stringify(l.payload, null, 2) }}</pre>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty"><h3>Không có bản ghi khớp bộ lọc</h3></div>
      <div v-if="pages > 1" class="rowf pad center">
        <button class="btn sm" type="button" :disabled="page <= 1" @click="page--">← Trước</button>
        <span class="sm">Trang {{ page }}/{{ pages }}</span>
        <button class="btn sm" type="button" :disabled="page >= pages" @click="page++">Sau →</button>
      </div>
    </div>
  </div>
</template>
