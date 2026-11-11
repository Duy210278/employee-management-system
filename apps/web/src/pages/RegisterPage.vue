<script setup lang="ts">
import { RegisterBody } from '@lotrinh/shared';
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { userApi, useRegisterOptions } from '@/api/queries';
import { useToast } from '@/composables/toast';

const BASE_URL = import.meta.env.BASE_URL;

/** Đăng ký tài khoản (mục 5.1): vai trò, nhà thuốc, khu vực chỉ là đề nghị, BP Đào tạo chốt khi duyệt */
const router = useRouter();
const toast = useToast();
const { data: opt, error } = useRegisterOptions();
const busy = ref(false);
const form = reactive({ fullName: '', employeeCode: '', email: '', phone: '', password: '', password2: '', requestedRole: 'nv' as 'nv' | 'cht' | 'qlkv', storeId: 0, areaId: 0 });
const byArea = computed(() => {
  const groups = new Map<string, { id: number; name: string }[]>();
  for (const s of opt.value?.stores ?? []) groups.set(s.areaName, [...(groups.get(s.areaName) ?? []), s]);
  return [...groups];
});

async function submit() {
  if (form.password !== form.password2) {
    toast.show('Hai lần nhập mật khẩu chưa khớp');
    return;
  }
  const parsed = RegisterBody.safeParse({ ...form, storeId: form.storeId || null, areaId: form.areaId || null });
  if (!parsed.success) {
    toast.show(parsed.error.issues[0]?.message ?? 'Kiểm tra lại thông tin');
    return;
  }
  busy.value = true;
  try {
    await userApi.register(parsed.data);
    await router.push({ name: 'pending', query: { email: parsed.data.email, name: parsed.data.fullName } });
  } catch (err) {
    toast.show((err as Error).message);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <form class="auth-card wide" @submit.prevent="submit">
      <div class="auth-head">
        <img class="auth-logo" :src="`${BASE_URL}upharma.png`" alt="UPharma" width="96" height="96" />
        <h1 class="auth-title">Đăng ký tài khoản</h1>
        <p class="auth-sub">Sau khi gửi, tài khoản ở trạng thái <b>Chờ duyệt</b>. BP Đào tạo kiểm tra và chốt vai trò, phạm vi trước khi bạn dùng được hệ thống.</p>
      </div>
      <div v-if="error" class="alert bad"><div>{{ error.message }}</div></div>
      <div class="form">
        <label class="f">Họ và tên<input v-model="form.fullName" autocomplete="name" required /></label>
        <label class="f">Mã nhân viên<input v-model="form.employeeCode" required placeholder="vd. NV301" /></label>
        <label class="f">Email công ty<input v-model="form.email" type="email" autocomplete="email" required /></label>
        <label class="f">Số điện thoại<input v-model="form.phone" type="tel" autocomplete="tel" /></label>
        <label class="f">Mật khẩu (tối thiểu 8 ký tự)<input v-model="form.password" type="password" autocomplete="new-password" required minlength="8" /></label>
        <label class="f">Nhập lại mật khẩu<input v-model="form.password2" type="password" autocomplete="new-password" required /></label>
        <label class="f">
          Vai trò đề nghị
          <select v-model="form.requestedRole">
            <option value="nv">Nhân viên bán hàng</option>
            <option value="cht">Cửa hàng trưởng</option>
            <option value="qlkv">Quản lý khu vực</option>
          </select>
        </label>
        <label v-if="form.requestedRole !== 'qlkv'" class="f">
          Nhà thuốc đang làm việc
          <select v-model.number="form.storeId" required>
            <option :value="0" disabled>Chọn nhà thuốc</option>
            <optgroup v-for="[area, list] in byArea" :key="area" :label="area">
              <option v-for="s in list" :key="s.id" :value="s.id">{{ s.name }}</option>
            </optgroup>
          </select>
        </label>
        <label v-else class="f">
          Khu vực phụ trách
          <select v-model.number="form.areaId" required>
            <option :value="0" disabled>Chọn khu vực</option>
            <option v-for="a in opt?.areas" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>
      </div>
      <button class="btn cta lg round wide" type="submit" :disabled="busy">Gửi đăng ký</button>
      <div class="auth-foot">Đã có tài khoản? <RouterLink to="/dang-nhap">Đăng nhập</RouterLink></div>
    </form>
  </div>
</template>
