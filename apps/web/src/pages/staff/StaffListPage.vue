<script setup lang="ts">
import type { StaffListItem } from '@lotrinh/shared';
import { computed, ref } from 'vue';
import { useStaffList } from '@/api/queries';

/** Nhân sự (mục 11.4): danh sách trong phạm vi, nhiều cảnh báo đỏ xếp trước */
const { data, isLoading, error } = useStaffList();
const q = ref('');
const store = ref('');
const level = ref('');

const items = computed(() => data.value?.items ?? []);
const stores = computed(() => [...new Set(items.value.map((i) => i.staff.storeName))].sort());
const filtered = computed(() =>
  items.value.filter((i) => {
    const text = `${i.staff.fullName} ${i.staff.employeeCode ?? ''}`.toLowerCase();
    return (!q.value || text.includes(q.value.trim().toLowerCase())) && (!store.value || i.staff.storeName === store.value) && (!level.value || String(i.run?.levelKey) === level.value);
  }),
);

/** Số quy tắc cảnh báo bị chạm (mục 11.6), không phải số mục trễ */
const reds = (i: StaffListItem) => (i.flags.overdue7 > 0 ? 1 : 0) + (i.flags.noBuddy ? 1 : 0);
const yellows = (i: StaffListItem) => ((i.run?.counts.overdue ?? 0) > i.flags.overdue7 ? 1 : 0) + (i.flags.noCht ? 1 : 0);
const stats = computed(() => {
  const all = items.value;
  const byLevel = [1, 2, 3, 4].map((l) => all.filter((i) => i.run?.levelKey === l).length);
  const avg = all.length ? Math.round((all.reduce((a, i) => a + (i.run?.progress.pct ?? 0), 0) / all.length) * 100) : 0;
  return {
    total: all.length,
    byLevel,
    avg,
    overdue: all.reduce((a, i) => a + (i.run?.counts.overdue ?? 0), 0),
    red: all.filter((i) => reds(i) > 0).length,
  };
});
const pct = (i: StaffListItem) => Math.round((i.run?.progress.pct ?? 0) * 100);
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="data" class="stack">
    <div class="grid g4">
      <div class="card stat">
        <b>{{ stats.total }}</b>
        <span>Nhân sự (L1 {{ stats.byLevel[0] }} · L2 {{ stats.byLevel[1] }} · L3 {{ stats.byLevel[2] }} · L4 {{ stats.byLevel[3] }})</span>
      </div>
      <div class="card stat"><b>{{ stats.avg }}%</b><span>Hoàn thành checklist trung bình</span></div>
      <div class="card stat"><b>{{ stats.overdue }}</b><span>Mục đang trễ hạn</span></div>
      <div class="card stat">
        <b :style="{ color: stats.red ? 'var(--bad)' : 'inherit' }">{{ stats.red }}</b><span>Nhân sự có cảnh báo đỏ</span>
      </div>
    </div>

    <div class="rowf sp">
      <div class="rowf">
        <input v-model="q" placeholder="Tìm tên, mã NV" aria-label="Tìm nhân sự" />
        <select v-model="store" aria-label="Cửa hàng">
          <option value="">Mọi cửa hàng</option>
          <option v-for="s in stores" :key="s" :value="s">{{ s }}</option>
        </select>
        <select v-model="level" aria-label="Level">
          <option value="">Mọi Level</option>
          <option v-for="l in 4" :key="l" :value="String(l)">Level {{ l }}</option>
        </select>
      </div>
      <RouterLink v-if="data.canCreate" class="btn pri" to="/nhan-su/them">+ Thêm nhân viên</RouterLink>
    </div>

    <div class="card">
      <table v-if="filtered.length" class="rt">
        <thead>
          <tr>
            <th>Nhân viên</th>
            <th>Cửa hàng</th>
            <th>Level</th>
            <th>Tiến độ Level</th>
            <th>Trễ hạn</th>
            <th>Cảnh báo</th>
            <th>Phiên bản</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in filtered" :key="i.staff.id">
            <td data-l="Nhân viên">
              <div>
                <b>{{ i.staff.fullName }}</b>
                <div class="sm mut">{{ i.staff.employeeCode }}<template v-if="!i.staff.hasAccount"> · chưa có tài khoản</template></div>
              </div>
            </td>
            <td data-l="Cửa hàng">{{ i.staff.storeName }}</td>
            <td data-l="Level">
              <span v-if="i.run" class="pill info">L{{ i.run.levelKey }}</span>
              <span v-if="i.run && i.level" class="sm mut">
                {{ i.run.dayIndex < 0 ? `bắt đầu sau ${-i.run.dayIndex} ngày` : `ngày ${i.run.dayIndex + 1}/${i.level.totalDays}` }}
              </span>
            </td>
            <td data-l="Tiến độ" style="min-width: 130px">
              <div style="width: 100%">
                <div class="bar"><i :style="{ width: pct(i) + '%' }"></i></div>
                <div class="sm mut">{{ i.run?.progress.done }}/{{ i.run?.progress.total }} · {{ pct(i) }}%</div>
              </div>
            </td>
            <td data-l="Trễ hạn">
              <span v-if="i.run?.counts.overdue" class="pill" :class="i.flags.overdue7 ? 'bad' : 'warn'">{{ i.run.counts.overdue }}</span>
              <span v-else>0</span>
            </td>
            <td data-l="Cảnh báo">
              <div class="rowf" style="gap: 4px">
                <span v-if="reds(i)" class="pill bad">{{ reds(i) }} đỏ</span>
                <span v-if="yellows(i)" class="pill warn">{{ yellows(i) }} vàng</span>
                <span v-if="!reds(i) && !yellows(i)" class="pill ok">Ổn</span>
              </div>
            </td>
            <td data-l="Phiên bản" class="sm">v{{ i.run?.versionCode }}</td>
            <td><RouterLink class="btn sm" :to="`/nhan-su/${i.staff.id}`">Mở</RouterLink></td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">
        <h3>{{ items.length ? 'Không có nhân sự khớp bộ lọc' : 'Chưa có nhân sự nào' }}</h3>
        <div v-if="!items.length">
          {{ data.canCreate ? 'Bấm "Thêm nhân viên" để tạo hồ sơ và bắt đầu lộ trình Level 1.' : 'Chưa có hồ sơ nào trong phạm vi của bạn.' }}
        </div>
      </div>
    </div>
    <div class="sm mut">Cảnh báo đỏ: có mục trễ hơn 7 ngày, NV Level 1–2 chưa có Buddy. Vàng: có mục trễ, chưa gắn CHT. Trang Cảnh báo đầy đủ có ở giai đoạn 2.</div>
  </div>
</template>
