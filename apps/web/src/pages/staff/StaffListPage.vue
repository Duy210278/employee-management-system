<script setup lang="ts">
import { countAlerts, runTitle, type StaffListItem } from '@lotrinh/shared';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { staffApi, useStaffList } from '@/api/queries';
import SearchInput from '@/components/SearchInput.vue';
import SegControl from '@/components/SegControl.vue';

/** Nhân sự (mục 11.4): danh sách trong phạm vi, nhiều cảnh báo đỏ xếp trước */
const router = useRouter();
const { data, isLoading, error } = useStaffList();
const q = ref('');
const store = ref('');
const level = ref('');

const items = computed(() => data.value?.items ?? []);
/** Lượt đang theo dõi: Level 1–4 của NVBH hoặc onboarding CHT */
const levelOf = (i: StaffListItem) => (!i.run ? '' : i.run.track === 'nvbh' ? String(i.run.levelKey) : 'cht');
const stores = computed(() => [...new Set(items.value.map((i) => i.staff.storeName))].sort());
const filtered = computed(() =>
  items.value.filter((i) => {
    const text = `${i.staff.fullName} ${i.staff.employeeCode ?? ''}`.toLowerCase();
    return (!q.value || text.includes(q.value.trim().toLowerCase())) && (!store.value || i.staff.storeName === store.value) && (!level.value || levelOf(i) === level.value);
  }),
);

/** Số quy tắc cảnh báo bị chạm (mục 11.6), không phải số mục trễ */
const reds = (i: StaffListItem) => countAlerts(i.alerts).red;
const yellows = (i: StaffListItem) => countAlerts(i.alerts).yellow;
const lateRed = (i: StaffListItem) => i.alerts.some((a) => a.key === 'overdue_escalate');
const alertText = (i: StaffListItem) => i.alerts.map((a) => a.message).join('\n');
const stats = computed(() => {
  const all = items.value;
  const byLevel = ['1', '2', '3', '4'].map((l) => all.filter((i) => levelOf(i) === l).length);
  const cht = all.filter((i) => levelOf(i) === 'cht').length;
  const avg = all.length ? Math.round((all.reduce((a, i) => a + (i.run?.progress.pct ?? 0), 0) / all.length) * 100) : 0;
  return {
    total: all.length,
    byLevel,
    cht,
    avg,
    overdue: all.reduce((a, i) => a + (i.run?.counts.overdue ?? 0), 0),
    red: all.filter((i) => reds(i) > 0).length,
  };
});
const levelOptions = computed(() => [
  { value: '', label: 'Tất cả' },
  ...[1, 2, 3, 4].map((l) => ({ value: String(l), label: `L${l}`, count: stats.value.byLevel[l - 1] })),
  { value: 'cht', label: 'CHT', count: stats.value.cht },
]);
const filteredRed = computed(() => filtered.value.filter((i) => reds(i) > 0).length);
const pct = (i: StaffListItem) => Math.round((i.run?.progress.pct ?? 0) * 100);

/** Bấm cả dòng để mở hồ sơ; bấm đúng liên kết, nút thì để liên kết tự xử lý */
function openRow(i: StaffListItem, e: MouseEvent) {
  if ((e.target as HTMLElement).closest('a, button')) return;
  void router.push(`/nhan-su/${i.staff.id}`);
}
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="data" class="page">
    <Teleport defer to="#page-actions">
      <a v-if="data.canExport" class="btn" :href="staffApi.exportUrl" download>Xuất CSV</a>
      <RouterLink v-if="data.canCreate" class="btn pri" to="/nhan-su/them">+ Thêm nhân viên</RouterLink>
    </Teleport>

    <div class="grid g4">
      <div class="card stat">
        <b>{{ stats.total }}</b>
        <span>Nhân sự đang theo dõi</span>
      </div>
      <div class="card stat"><b>{{ stats.avg }}%</b><span>Hoàn thành checklist trung bình</span></div>
      <div class="card stat" :class="{ warn: stats.overdue }"><b>{{ stats.overdue }}</b><span>Mục đang trễ hạn</span></div>
      <div class="card stat" :class="{ bad: stats.red }"><b>{{ stats.red }}</b><span>Nhân sự có cảnh báo đỏ</span></div>
    </div>

    <div class="card toolbar">
      <SearchInput v-model="q" placeholder="Tìm tên, mã NV" label="Tìm nhân sự" />
      <select v-model="store" aria-label="Cửa hàng">
        <option value="">Mọi cửa hàng</option>
        <option v-for="s in stores" :key="s" :value="s">{{ s }}</option>
      </select>
      <div class="grp">
        <span class="lbl">Level:</span>
        <SegControl v-model="level" :options="levelOptions" label="Lọc theo Level" />
      </div>
    </div>

    <div class="summary">
      Đang hiển thị <b>{{ filtered.length }}</b>/{{ items.length }} nhân sự<template v-if="filteredRed"> · <b class="bad-text">{{ filteredRed }}</b> người có cảnh báo đỏ</template>
    </div>

    <div class="card">
      <table v-if="filtered.length" class="rt click">
        <thead>
          <tr>
            <th>Nhân viên</th>
            <th>Cửa hàng</th>
            <th>Level</th>
            <th>Tiến độ Level</th>
            <th>Tình trạng</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in filtered" :key="i.staff.id" @click="openRow(i, $event)">
            <td data-l="Nhân viên">
              <div>
                <RouterLink class="b" :to="`/nhan-su/${i.staff.id}`">{{ i.staff.fullName }}</RouterLink>
                <div class="sm mut">{{ i.staff.employeeCode }}<template v-if="!i.staff.hasAccount"> · chưa có tài khoản</template></div>
              </div>
            </td>
            <td data-l="Cửa hàng">{{ i.staff.storeName }}</td>
            <td data-l="Level">
              <div>
                <span v-if="i.run" class="pill info" :title="runTitle(i.run)">{{ i.run.track === 'nvbh' ? `L${i.run.levelKey}` : 'CHT' }}</span>
                <div v-if="i.run && i.level" class="sm mut">
                  {{ i.run.dayIndex < 0 ? `bắt đầu sau ${-i.run.dayIndex} ngày` : `ngày ${i.run.dayIndex + 1}/${i.level.totalDays}` }} · v{{ i.run.versionCode }}
                </div>
              </div>
            </td>
            <td data-l="Tiến độ" style="min-width: 150px">
              <div class="grow">
                <div class="bar"><i :style="{ width: pct(i) + '%' }"></i></div>
                <div class="sm mut">{{ i.run?.progress.done }}/{{ i.run?.progress.total }} mục · {{ pct(i) }}%</div>
              </div>
            </td>
            <td data-l="Tình trạng">
              <div class="rowf tight" :title="alertText(i)">
                <span v-if="i.run?.pause" class="pill info">Tạm dừng</span>
                <span v-if="i.run?.counts.overdue" class="pill" :class="lateRed(i) ? 'bad' : 'warn'">Trễ {{ i.run.counts.overdue }} mục</span>
                <span v-if="reds(i)" class="pill bad">{{ reds(i) }} đỏ</span>
                <span v-if="yellows(i)" class="pill warn">{{ yellows(i) }} vàng</span>
                <span v-if="!reds(i) && !yellows(i) && !i.run?.counts.overdue" class="pill ok">Ổn</span>
              </div>
            </td>
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
    <div class="sm mut">Di chuột vào cột Tình trạng để xem nội dung cảnh báo. Danh sách đầy đủ và quy tắc ở trang <RouterLink to="/canh-bao">Cảnh báo</RouterLink>.</div>
  </div>
</template>
