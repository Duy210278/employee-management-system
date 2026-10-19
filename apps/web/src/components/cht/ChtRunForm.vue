<script setup lang="ts">
import { CreateChtRunBody, TRAINING_MODE_LABEL, type ChtTrackKey } from '@lotrinh/shared';
import { computed, reactive, ref, toRef, watch } from 'vue';
import { chtApi, useChtFormOptions, useMe, useMutate } from '@/api/queries';
import { useToast } from '@/composables/toast';
import { fmtDate, yearOf } from '@/format';

/**
 * Gán checklist onboarding cho tài khoản Cửa hàng trưởng (Quản trị → tài khoản CHT).
 * CHT thăng tiến từ NVBH dùng lại hồ sơ đào tạo cũ: lượt NVBH đang mở được đóng với trạng thái "Thăng chức CHT".
 */
const props = defineProps<{ userId: number }>();
const emit = defineEmits<{ created: [result: { staffId: number; runId: number }] }>();
const toast = useToast();
const mutate = useMutate();
const { data: me } = useMe();
const { data: opt, isLoading, error } = useChtFormOptions(toRef(() => props.userId));
const busy = ref(false);

const form = reactive({
  track: '' as ChtTrackKey | '',
  storeId: 0,
  startDate: '',
  trainingMode: 'offline' as 'online' | 'offline',
  trainerId: 0,
  qlkvId: 0,
  buddyId: 0,
  seniorityMonths: '' as number | '',
});

// Mặc định: loại checklist theo lịch sử (đã có lượt NVBH thì là thăng tiến), cửa hàng của tài khoản, Ngày D là hôm nay, Đào tạo là người đang gán
watch(
  opt,
  (o) => {
    if (!o) return;
    if (!form.track) form.track = o.suggestedTrack;
    if (!form.startDate) form.startDate = o.today;
    if (!form.storeId && o.stores.length) form.storeId = o.stores.find((s) => o.user.storeIds.includes(s.id))?.id ?? o.stores[0].id;
    if (!form.trainerId) form.trainerId = o.trainers.find((t) => t.id === me.value?.user.id)?.id ?? o.trainers[0]?.id ?? 0;
  },
  { immediate: true },
);
// Chọn cửa hàng thì gợi ý QLKV phụ trách khu vực của cửa hàng (vẫn cho sửa)
watch(
  () => form.storeId,
  (id) => {
    const s = opt.value?.stores.find((x) => x.id === id);
    if (s?.defaultQlkvId) form.qlkvId = s.defaultQlkvId;
  },
  { immediate: true },
);

const refYear = computed(() => (opt.value ? yearOf(opt.value.today) : new Date().getFullYear()));
const picked = computed(() => opt.value?.tracks.find((t) => t.key === form.track));
const buddies = computed(() => (opt.value?.buddies ?? []).filter((b) => b.id !== props.userId));
const nvbhRun = computed(() => {
  const r = opt.value?.staff?.currentRun;
  return r && r.track === 'nvbh' && (r.status === 'active' || r.status === 'extended') ? r : null;
});

async function submit() {
  const body = {
    userId: props.userId,
    track: form.track || undefined,
    storeId: form.storeId,
    startDate: form.startDate,
    trainingMode: form.trainingMode,
    trainerId: form.trainerId,
    qlkvId: form.qlkvId,
    buddyId: form.buddyId || null,
    seniorityMonths: form.track === 'cht_thang_tien' && !opt.value?.staff && form.seniorityMonths !== '' ? Number(form.seniorityMonths) : null,
  };
  const parsed = CreateChtRunBody.safeParse(body);
  if (!parsed.success) {
    toast.show(parsed.error.issues[0]?.message ?? 'Kiểm tra lại thông tin');
    return;
  }
  if (nvbhRun.value && !window.confirm(`Lượt Level ${nvbhRun.value.levelKey} đang mở sẽ đóng với trạng thái "Thăng chức CHT". Tiếp tục?`)) return;
  busy.value = true;
  const created = await mutate(() => chtApi.create(parsed.data), `Đã gán ${picked.value?.name ?? 'checklist CHT'} cho ${opt.value?.user.fullName ?? ''}`);
  busy.value = false;
  if (created) emit('created', created);
}
</script>

<template>
  <div v-if="isLoading" class="empty">Đang tải…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <form v-else-if="opt" class="stack" @submit.prevent="submit">
    <div v-if="!opt.tracks.length" class="alert">
      <div>Bộ lộ trình đang hiệu lực chưa có checklist CHT. Vào <b>Thiết kế lộ trình → Checklist CHT</b> để thêm từ mẫu và ban hành.</div>
    </div>
    <div v-else-if="opt.openChtRun" class="alert info"><div>Tài khoản đang có checklist CHT chưa hoàn thành.</div></div>
    <template v-else>
      <div class="form">
        <label class="f">
          Loại checklist
          <select v-model="form.track" required>
            <option v-for="t in opt.tracks" :key="t.key" :value="t.key">{{ t.name }} ({{ t.days }} ngày · {{ t.items }} việc)</option>
          </select>
        </label>
        <label class="f">
          Nhà thuốc / cửa hàng phụ trách
          <select v-model.number="form.storeId" required>
            <option v-for="s in opt.stores" :key="s.id" :value="s.id">{{ s.name }} · {{ s.areaName }}</option>
          </select>
        </label>
        <label class="f">Ngày D (ngày đầu tại cửa hàng)<input v-model="form.startDate" type="date" required /></label>
        <label class="f">
          Hình thức training tuần đầu
          <select v-model="form.trainingMode">
            <option v-for="(label, k) in TRAINING_MODE_LABEL" :key="k" :value="k">{{ label }}</option>
          </select>
        </label>
        <label class="f">
          Người phụ trách Đào tạo
          <select v-model.number="form.trainerId" required>
            <option :value="0" disabled>— chọn —</option>
            <option v-for="t in opt.trainers" :key="t.id" :value="t.id">{{ t.fullName }}</option>
          </select>
        </label>
        <label class="f">
          QLKV
          <select v-model.number="form.qlkvId" required>
            <option :value="0" disabled>— chọn —</option>
            <option v-for="q in opt.qlkvs" :key="q.id" :value="q.id">{{ q.fullName }}</option>
          </select>
        </label>
        <label class="f">
          Buddy (CHT cũ / người QLKV chỉ định, không bắt buộc)
          <select v-model.number="form.buddyId">
            <option :value="0">— không có —</option>
            <option v-for="b in buddies" :key="b.id" :value="b.id">{{ b.fullName }} · {{ b.note }}</option>
          </select>
        </label>
        <label v-if="form.track === 'cht_thang_tien' && !opt.staff" class="f">
          Thâm niên NVBH (tháng)
          <input v-model.number="form.seniorityMonths" type="number" min="0" max="600" placeholder="Chưa có hồ sơ NVBH trong hệ thống" />
        </label>
      </div>
      <div v-if="opt.staff" class="alert info">
        <div>
          Đã có hồ sơ đào tạo tại <b>{{ opt.staff.storeName }}</b> từ {{ fmtDate(opt.staff.hireDate, refYear) }} (thâm niên {{ opt.staff.seniorityMonths }} tháng).
          <template v-if="nvbhRun"> Lượt Level {{ nvbhRun.levelKey }} đang mở sẽ đóng với trạng thái <b>Thăng chức CHT</b>; lịch sử Level vẫn giữ trong hồ sơ.</template>
        </div>
      </div>
      <div class="sm mut">
        Hệ thống sinh checklist tuần đầu ({{ picked?.days ?? 5 }} ngày, Ngày D → D+{{ (picked?.days ?? 5) - 1 }}) từ Bộ lộ trình đang hiệu lực. Việc của Đào tạo giao cho
        người phụ trách đã chọn; việc của QLKV giao cho QLKV.
      </div>
      <div class="rowf">
        <button class="btn pri" type="submit" :disabled="busy">Gán checklist CHT</button>
        <slot name="actions" />
      </div>
    </template>
  </form>
</template>
