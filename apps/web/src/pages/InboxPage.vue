<script setup lang="ts">
import { ROLE_SHORT, runTitle, type InboxGroup, type InboxPriority, type SignatureTodo, type TaskRole, type TaskView } from '@lotrinh/shared';
import { computed, reactive, ref } from 'vue';
import { useInbox } from '@/api/queries';
import Avatar from '@/components/Avatar.vue';
import BulkBar from '@/components/BulkBar.vue';
import Icon from '@/components/Icon.vue';
import ItemRow from '@/components/ItemRow.vue';
import SearchInput from '@/components/SearchInput.vue';
import { canBulk, provideBulk } from '@/composables/bulkConfirm';
import { fmtDate, fold, yearOf } from '@/format';

/** "Việc cần xử lý" của Buddy, CHT, QLKV, BP ĐT (mục 11.3); với NV làm Buddy là tab "Việc kèm cặp" */
const { data, isLoading, error } = useInbox(ref(true));
const refYear = computed(() => (data.value ? yearOf(data.value.today) : new Date().getFullYear()));
const empty = computed(() => !!data.value && !data.value.groups.length && !data.value.upcoming.length);
const KIND_LABEL: Record<SignatureTodo['kind'], string> = { review: 'Phiếu đánh giá', stage: 'Ký giai đoạn', pause: 'Tạm dừng' };
const waiting = (roles: TaskRole[]) => roles.map((r) => ROLE_SHORT[r]).join(' + ');
const ACTION_LABEL: Record<SignatureTodo['kind'], string> = { review: 'Mở phiếu', stage: 'Mở checklist', pause: 'Xem đề xuất' };

// Tìm theo nhân viên (tên, mã NV) hoặc cửa hàng, không phân biệt dấu; lọc mọi danh sách trên trang
const q = ref('');
const store = ref('');
const needle = computed(() => fold(q.value.trim()));
const filtering = computed(() => !!needle.value || !!store.value);
const matches = (staffName: string, storeName: string, code?: string | null) =>
  (!store.value || storeName === store.value) && (!needle.value || fold(`${staffName} ${code ?? ''} ${storeName}`).includes(needle.value));
const byStaff = (g: InboxGroup) => matches(g.staff.fullName, g.staff.storeName, g.staff.employeeCode);
const groups = computed(() => (data.value?.groups ?? []).filter(byStaff));
const upcoming = computed(() => (data.value?.upcoming ?? []).filter(byStaff));
const signatures = computed(() => (data.value?.signatures ?? []).filter((s) => matches(s.staffName, s.storeName)));
const areaAlerts = computed(() => (data.value?.areaAlerts ?? []).filter((a) => matches(a.staffName, a.storeName)));
const stores = computed(() => {
  const d = data.value;
  if (!d) return [];
  const names = [...d.groups, ...d.upcoming].map((g) => g.staff.storeName).concat(d.signatures.map((s) => s.storeName), d.areaAlerts.map((a) => a.storeName));
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'vi'));
});
const noMatch = computed(() => filtering.value && !groups.value.length && !upcoming.value.length && !signatures.value.length && !areaAlerts.value.length);

// Nhóm Khu vực > Cửa hàng > Nhân viên, giữ thứ tự ưu tiên của API (nhóm có việc gấp nhất lên đầu)
const countOf = (g: InboxGroup, p: InboxPriority) => g.items.filter((t) => t.priority === p).length;
const tally = (gs: InboxGroup[]) => ({
  items: gs.reduce((n, g) => n + g.items.length, 0),
  waiting: gs.reduce((n, g) => n + countOf(g, 0), 0),
  overdue: gs.reduce((n, g) => n + countOf(g, 1), 0),
});
const byArea = computed(() => {
  const areas = new Map<string, Map<string, InboxGroup[]>>();
  for (const g of groups.value) {
    const stores = areas.get(g.staff.areaName) ?? areas.set(g.staff.areaName, new Map()).get(g.staff.areaName)!;
    (stores.get(g.staff.storeName) ?? stores.set(g.staff.storeName, []).get(g.staff.storeName)!).push(g);
  }
  return [...areas].map(([area, stores]) => {
    const list = [...stores].map(([name, gs]) => ({ key: `${area}|${name}`, name, groups: gs, ...tally(gs) }));
    const all = list.flatMap((s) => s.groups);
    return { name: area, stores: list, staff: all.length, ...tally(all) };
  });
});
const storeCount = computed(() => byArea.value.reduce((n, a) => n + a.stores.length, 0));

// Nhóm nhân viên thu gọn sẵn, bấm tiêu đề để xem việc; nhóm khu vực, cửa hàng mở sẵn
const openRuns = reactive(new Set<number>());
const closedAreas = reactive(new Set<string>());
const closedStores = reactive(new Set<string>());
const flip = <T,>(set: Set<T>, key: T) => (set.has(key) ? set.delete(key) : set.add(key));
const allOpen = computed(() => groups.value.length > 0 && groups.value.every((g) => openRuns.has(g.run.id)));
function toggleAll() {
  const open = !allOpen.value;
  for (const g of groups.value) open ? openRuns.add(g.run.id) : openRuns.delete(g.run.id);
  if (open) {
    closedAreas.clear();
    closedStores.clear();
  }
}

// Duyệt nhanh: chọn từng mục, hoặc chọn hết các mục chờ bạn xác nhận của một nhân viên
const bulk = provideBulk();
const readyOf = (items: TaskView[]) => items.filter(canBulk);
const allPicked = (items: TaskView[]) => readyOf(items).every((t) => bulk.has(t.id));
const readyCount = computed(() => groups.value.reduce((n, g) => n + readyOf(g.items).length, 0));
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="data" class="page">
    <div class="grid g4">
      <div class="card stat"><b>{{ data.stats.waiting }}</b><span>NV đã báo xong hoặc cần hỗ trợ, chờ bạn</span></div>
      <div class="card stat" :class="{ bad: data.stats.overdue }"><b>{{ data.stats.overdue }}</b><span>Việc của bạn đã quá hạn</span></div>
      <div class="card stat"><b>{{ data.stats.dueSoon }}</b><span>Đến hạn trong 7 ngày tới</span></div>
      <div class="card stat"><b>{{ data.stats.staffCount }}</b><span>Nhân sự phụ trách</span></div>
    </div>

    <template v-if="!(empty && !data.signatures.length && !data.areaAlerts.length)">
      <div class="card toolbar">
        <SearchInput v-model="q" placeholder="Tìm tên, mã NV, cửa hàng" label="Tìm việc theo nhân viên hoặc cửa hàng" />
        <select v-if="stores.length > 1" v-model="store" aria-label="Cửa hàng">
          <option value="">Mọi cửa hàng</option>
          <option v-for="s in stores" :key="s" :value="s">{{ s }}</option>
        </select>
        <button v-if="groups.length" class="btn sm end" type="button" @click="toggleAll">{{ allOpen ? 'Thu gọn tất cả' : 'Mở tất cả' }}</button>
      </div>
      <div v-if="filtering" class="summary">Đang hiển thị <b>{{ groups.length }}</b>/{{ data.groups.length }} nhân viên có việc cần xem</div>
    </template>

    <div v-if="noMatch" class="card empty">
      <h3>Không tìm thấy</h3>
      <div>Không có việc nào của nhân viên hoặc cửa hàng khớp với từ khóa.</div>
    </div>

    <template v-if="signatures.length">
      <div class="sec">Chữ ký chờ bạn · {{ signatures.length }}</div>
      <div class="card clip">
        <div v-for="(s, i) in signatures" :key="`${s.kind}-${s.runId}-${i}`" class="attn-row" :class="s.overdue ? 'bad' : 'info'">
          <span class="ic" aria-hidden="true">✎</span>
          <div class="grow">
            <div class="rowf tight">
              <b>{{ s.staffName }}</b> <span class="pill info">Level {{ s.levelKey }}</span> <span class="sm mut">{{ s.storeName }}</span>
            </div>
            <div class="sm">
              <span class="b">{{ KIND_LABEL[s.kind] }}:</span> {{ s.label }}<template v-if="s.totalSteps > 1"> · bước {{ s.step + 1 }}/{{ s.totalSteps }}</template>
              <span v-if="s.overdue" class="pill bad">Quá hạn</span>
              <span v-else-if="s.dueOn && s.kind === 'stage'" class="mut"> · hạn {{ fmtDate(s.dueOn, refYear) }}</span>
            </div>
            <div v-if="s.detail" class="sm mut">{{ s.detail }}</div>
          </div>
          <RouterLink class="btn sm pri" :to="{ path: `/nhan-su/${s.staffId}`, query: { tab: s.tab, run: s.runId } }">{{ ACTION_LABEL[s.kind] }}</RouterLink>
        </div>
      </div>
    </template>

    <template v-if="areaAlerts.length">
      <div class="sec">Cảnh báo trong khu vực · {{ areaAlerts.length }} việc quá hạn lâu</div>
      <div class="card clip">
        <div v-for="a in areaAlerts" :key="a.taskId" class="attn-row bad">
          <span class="ic" aria-hidden="true">!</span>
          <div class="grow">
            <div class="rowf tight"><b>{{ a.staffName }}</b> <span class="sm mut">{{ a.storeName }}</span> <span class="pill bad">Trễ {{ a.overdueDays }} ngày</span></div>
            <div class="sm"><span class="mono mut">{{ a.itemKey }}</span> {{ a.content }}</div>
            <div class="sm mut">Chờ {{ waiting(a.waitingFor) }}</div>
          </div>
          <RouterLink class="btn sm" :to="{ path: `/nhan-su/${a.staffId}`, query: { tab: 'check', run: a.runId } }">Mở hồ sơ</RouterLink>
        </div>
      </div>
    </template>

    <div v-if="empty && !data.signatures.length && !data.areaAlerts.length" class="card empty">
      <h3>Không có việc cần xử lý</h3>
      <div>Khi nhân viên báo hoàn thành hoặc có mục đến hạn, việc sẽ hiện ở đây.</div>
    </div>

    <template v-if="groups.length">
      <div class="sec">Việc theo khu vực · {{ byArea.length }} khu vực, {{ storeCount }} cửa hàng, {{ groups.length }} nhân viên</div>
      <div class="sm mut">
        Bấm vào tên nhân viên để xem việc.<template v-if="readyCount > 1"> Đánh dấu ô vuông ở các mục để xác nhận đạt nhiều mục một lần.</template>
      </div>
      <section v-for="a in byArea" :key="a.name" class="store-grp area-grp" :class="{ open: !closedAreas.has(a.name) }">
        <button type="button" class="head store-head area-head" :aria-expanded="!closedAreas.has(a.name)" @click="flip(closedAreas, a.name)">
          <Icon class="caret" name="chevron" />
          <b>Khu vực {{ a.name }}</b>
          <span class="sm mut">{{ a.stores.length }} cửa hàng · {{ a.staff }} nhân viên · {{ a.items }} việc</span>
          <span v-if="a.waiting || a.overdue" class="cnts sm">
            <span v-if="a.waiting" class="cnt info">{{ a.waiting }} chờ bạn</span>
            <span v-if="a.overdue" class="cnt bad">{{ a.overdue }} quá hạn</span>
          </span>
        </button>
        <div v-if="!closedAreas.has(a.name)" class="store-body">
          <section v-for="s in a.stores" :key="s.key" class="store-grp" :class="{ open: !closedStores.has(s.key) }">
            <button type="button" class="head store-head" :aria-expanded="!closedStores.has(s.key)" @click="flip(closedStores, s.key)">
              <Icon class="caret" name="chevron" />
              <b>{{ s.name }}</b>
              <span class="sm mut">{{ s.groups.length }} nhân viên · {{ s.items }} việc</span>
              <span v-if="s.waiting || s.overdue" class="cnts sm">
                <span v-if="s.waiting" class="cnt info">{{ s.waiting }} chờ bạn</span>
                <span v-if="s.overdue" class="cnt bad">{{ s.overdue }} quá hạn</span>
              </span>
            </button>
            <div v-if="!closedStores.has(s.key)" class="store-body">
              <div v-for="g in s.groups" :key="g.run.id" class="card clip inbox-grp" :class="{ open: openRuns.has(g.run.id) }">
                <div class="grp-head head">
                  <button type="button" class="who grp-toggle" :aria-expanded="openRuns.has(g.run.id)" @click="flip(openRuns, g.run.id)">
                    <Icon class="caret" name="chevron" />
                    <Avatar :name="g.staff.fullName" />
                    <div>
                      <div class="rowf tight">
                        <b>{{ g.staff.fullName }}</b>
                        <span class="pill info">{{ runTitle(g.run) }} · ngày {{ g.run.dayIndex + 1 }}/{{ g.level.totalDays }}</span>
                      </div>
                      <div class="rowf sm grp-sub">
                        <span class="mut"><template v-if="g.staff.employeeCode">{{ g.staff.employeeCode }} · </template>{{ g.items.length }} việc cần xem</span>
                        <span v-if="countOf(g, 0) || countOf(g, 1)" class="cnts">
                          <span v-if="countOf(g, 0)" class="cnt info">{{ countOf(g, 0) }} chờ bạn</span>
                          <span v-if="countOf(g, 1)" class="cnt bad">{{ countOf(g, 1) }} quá hạn</span>
                        </span>
                      </div>
                    </div>
                  </button>
                  <span class="mini" :aria-label="`Tiến độ ${Math.round(g.run.progress.pct * 100)}%`">
                    <span class="bar"><i :style="{ width: Math.round(g.run.progress.pct * 100) + '%' }"></i></span>
                    {{ g.run.progress.done }}/{{ g.run.progress.total }} · {{ Math.round(g.run.progress.pct * 100) }}%
                  </span>
                  <button v-if="readyOf(g.items).length > 1" class="btn sm" type="button" @click="bulk.setMany(readyOf(g.items), !allPicked(g.items))">
                    {{ allPicked(g.items) ? 'Bỏ chọn' : `Chọn ${readyOf(g.items).length} mục chờ bạn` }}
                  </button>
                  <RouterLink class="btn sm" :to="`/nhan-su/${g.staff.id}`">Mở hồ sơ</RouterLink>
                </div>
                <template v-if="openRuns.has(g.run.id)">
                  <ItemRow v-for="t in g.items" :key="t.id" :task="t" :ref-year="refYear" />
                </template>
              </div>
            </div>
          </section>
        </div>
      </section>
    </template>
    <BulkBar />

    <template v-if="upcoming.length">
      <div class="sec">Lượt sắp bắt đầu</div>
      <details v-for="g in upcoming" :key="g.run.id" class="card clip">
        <summary class="stage-head">
          <Avatar :name="g.staff.fullName" size="sm" />
          <div class="stage-main">
            <b>{{ g.staff.fullName }}</b> · {{ runTitle(g.run) }}
            <div class="sm mut">Bắt đầu {{ fmtDate(g.run.startDate, refYear) }} (còn {{ -g.run.dayIndex }} ngày) · {{ g.items.length }} việc giai đoạn đầu</div>
          </div>
          <Icon class="caret" name="chevron" />
        </summary>
        <ItemRow v-for="t in g.items" :key="t.id" :task="t" :ref-year="refYear" />
      </details>
    </template>
  </div>
</template>
