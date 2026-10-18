<script setup lang="ts">
import { CreateStaffBody } from '@lotrinh/shared';
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { staffApi, useMutate, useStaffFormOptions } from '@/api/queries';
import { useToast } from '@/composables/toast';

/** Thêm nhân viên và bắt đầu lượt Level (mục 9.1, 9.2) */
const router = useRouter();
const toast = useToast();
const mutate = useMutate();
const { data: opt, isLoading, error } = useStaffFormOptions();
const busy = ref(false);

const form = reactive({
  fullName: '',
  employeeCode: '',
  storeId: 0,
  hireDate: '',
  levelKey: 1,
  startDate: '',
  userId: 0,
  buddyId: 0,
  chtId: 0,
  qlkvId: 0,
});

// Mặc định: cửa hàng đầu tiên trong phạm vi, ngày nhận việc là hôm nay (theo đồng hồ nghiệp vụ)
watch(
  opt,
  (o) => {
    if (!o) return;
    if (!form.hireDate) form.hireDate = o.today;
    if (!form.storeId && o.stores.length) form.storeId = o.stores[0].id;
  },
  { immediate: true },
);
// Chọn cửa hàng thì gợi ý CHT, QLKV phụ trách cửa hàng đó (vẫn cho sửa)
watch(
  () => form.storeId,
  (id) => {
    const s = opt.value?.stores.find((x) => x.id === id);
    if (!s) return;
    form.chtId = s.defaultChtId ?? 0;
    form.qlkvId = s.defaultQlkvId ?? 0;
  },
);
// Chọn tài khoản NV thì điền sẵn họ tên nếu còn trống
watch(
  () => form.userId,
  (id) => {
    const a = opt.value?.accounts.find((x) => x.id === id);
    if (a && !form.fullName) form.fullName = a.fullName;
  },
);

const needBuddy = computed(() => form.levelKey <= 2);
const buddies = computed(() => (opt.value?.buddies ?? []).filter((b) => b.id !== form.userId));

async function submit() {
  const body = {
    fullName: form.fullName,
    employeeCode: form.employeeCode || undefined,
    storeId: form.storeId,
    hireDate: form.hireDate,
    levelKey: form.levelKey,
    startDate: form.levelKey === 1 ? undefined : form.startDate || undefined,
    userId: form.userId || null,
    buddyId: form.buddyId || null,
    chtId: form.chtId || undefined,
    qlkvId: form.qlkvId || undefined,
  };
  const parsed = CreateStaffBody.safeParse(body);
  if (!parsed.success) {
    toast.show(parsed.error.issues[0]?.message ?? 'Kiểm tra lại thông tin');
    return;
  }
  busy.value = true;
  const created = await mutate(() => staffApi.create(parsed.data), `Đã tạo hồ sơ ${form.fullName} và bắt đầu lộ trình Level ${form.levelKey}`);
  busy.value = false;
  if (created) await router.push(`/nhan-su/${created.staffId}`);
}
</script>

<template>
  <div class="stack">
    <div><RouterLink class="btn sm" to="/nhan-su">← Danh sách nhân sự</RouterLink></div>
    <div v-if="isLoading" class="card empty">Đang tải…</div>
    <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
    <form v-else-if="opt" class="card pad stack" style="max-width: 820px" @submit.prevent="submit">
      <div class="h1">Thêm nhân viên</div>
      <div class="form">
        <label class="f">Họ tên<input v-model="form.fullName" required autocomplete="off" /></label>
        <label class="f">Mã nhân viên<input v-model="form.employeeCode" autocomplete="off" placeholder="Bỏ trống thì lấy theo tài khoản" /></label>
        <label class="f">
          Nhà thuốc / cửa hàng
          <select v-model.number="form.storeId" required>
            <option v-for="s in opt.stores" :key="s.id" :value="s.id">{{ s.name }} · {{ s.areaName }}</option>
          </select>
        </label>
        <label class="f">Ngày nhận việc<input v-model="form.hireDate" type="date" required /></label>
        <label class="f">
          Level hiện tại
          <select v-model.number="form.levelKey">
            <option v-for="l in opt.levels" :key="l.key" :value="l.key">Level {{ l.key }} · {{ l.name }} ({{ l.durationLabel }})</option>
          </select>
        </label>
        <label class="f">
          Ngày bắt đầu Level hiện tại
          <input v-if="form.levelKey === 1" :value="form.hireDate" type="date" disabled title="Level 1 bắt đầu từ ngày nhận việc" />
          <input v-else v-model="form.startDate" type="date" required />
        </label>
        <label class="f">
          Tài khoản của nhân viên
          <select v-model.number="form.userId">
            <option :value="0">— chưa có tài khoản —</option>
            <option v-for="a in opt.accounts" :key="a.id" :value="a.id">{{ a.fullName }} · {{ a.note }}</option>
          </select>
        </label>
        <label class="f">
          Buddy{{ needBuddy ? ' (bắt buộc với Level 1–2)' : '' }}
          <select v-model.number="form.buddyId">
            <option :value="0">— chưa gắn —</option>
            <option v-for="b in buddies" :key="b.id" :value="b.id">{{ b.fullName }} · {{ b.note }}</option>
          </select>
        </label>
        <label class="f">
          Cửa hàng trưởng
          <select v-model.number="form.chtId" required>
            <option :value="0" disabled>— chọn —</option>
            <option v-for="c in opt.chts" :key="c.id" :value="c.id">{{ c.fullName }}</option>
          </select>
        </label>
        <label class="f">
          QLKV
          <select v-model.number="form.qlkvId" required>
            <option :value="0" disabled>— chọn —</option>
            <option v-for="c in opt.qlkvs" :key="c.id" :value="c.id">{{ c.fullName }}</option>
          </select>
        </label>
      </div>
      <div class="sm mut">
        Level 1 bắt đầu từ ngày nhận việc; hệ thống sinh toàn bộ đầu việc và tính hạn theo ngày đó. Ngày ở tương lai thì lộ trình hiện "Sắp bắt đầu".
        Danh sách tài khoản chỉ gồm tài khoản NV đã được duyệt và chưa gắn hồ sơ.
      </div>
      <div class="rowf">
        <button class="btn pri" type="submit" :disabled="busy">Lưu hồ sơ và bắt đầu lộ trình</button>
        <RouterLink class="btn" to="/nhan-su">Hủy</RouterLink>
      </div>
    </form>
  </div>
</template>
