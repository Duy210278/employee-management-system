<script setup lang="ts">
import { ROLE_LABEL, type AccountRole } from '@lotrinh/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiError } from '@/api/client';
import { sessionApi, useDemoAccounts } from '@/api/queries';
import { useToast } from '@/composables/toast';

/** Đăng nhập (mục 5.1); bản demo có thêm đăng nhập nhanh theo tài khoản mẫu (mục 14.7) */
const router = useRouter();
const qc = useQueryClient();
const toast = useToast();
const email = ref('');
const password = ref('');
const busy = ref(false);
const { data: accounts, isError: noDemo } = useDemoAccounts(ref(true));
const quickId = ref(0);

const groups = computed(() => {
  const order: AccountRole[] = ['bp', 'qlkv', 'cht', 'nv'];
  return order
    .map((role) => ({ role, label: ROLE_LABEL[role], items: (accounts.value ?? []).filter((a) => a.role === role) }))
    .filter((g) => g.items.length);
});
const picked = computed(() => accounts.value?.find((a) => a.id === quickId.value) ?? null);

async function enter(fn: () => Promise<unknown>) {
  busy.value = true;
  try {
    await fn();
    qc.clear();
    await router.push('/');
  } catch (err) {
    // Tài khoản chờ duyệt: chuyển sang màn "Đang chờ duyệt" (mục 5.1)
    if (err instanceof ApiError && err.code === 'ACCOUNT_PENDING') await router.push({ name: 'pending', query: { email: email.value || undefined } });
    else toast.show((err as Error).message);
  } finally {
    busy.value = false;
  }
}

const submit = () => enter(() => sessionApi.login(email.value, password.value));
function quick() {
  if (!picked.value) return toast.show('Chọn một tài khoản mẫu');
  void enter(() => sessionApi.loginAs(picked.value!.id));
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-head">
        <div class="brand-mark" aria-hidden="true">U</div>
        <h1 class="auth-title">Chào mừng đến với<br />Lộ trình Upharma</h1>
      </div>
      <form class="stack" @submit.prevent="submit">
        <label class="f">Email công ty<input v-model="email" type="email" autocomplete="username" required /></label>
        <label class="f">Mật khẩu<input v-model="password" type="password" autocomplete="current-password" required /></label>
        <button class="btn pri lg round wide" type="submit" :disabled="busy">Đăng nhập</button>
        <div class="auth-foot">Chưa có tài khoản? <RouterLink to="/dang-ky">Đăng ký</RouterLink></div>
      </form>

      <!-- Đăng nhập nhanh chỉ có ở bản demo (DEMO_MODE) -->
      <template v-if="accounts?.length && !noDemo">
        <div class="or" role="separator"><span>hoặc đăng nhập nhanh (bản demo)</span></div>
        <form class="stack tight" @submit.prevent="quick">
          <div class="rowf keep">
            <select v-model.number="quickId" class="grow" aria-label="Chọn tài khoản mẫu">
              <option :value="0" disabled>Chọn tài khoản mẫu…</option>
              <optgroup v-for="g in groups" :key="g.role" :label="g.label">
                <option v-for="a in g.items" :key="a.id" :value="a.id" :disabled="a.status !== 'active'">
                  {{ a.fullName }}{{ a.status !== 'active' ? ' (chờ duyệt)' : '' }}
                </option>
              </optgroup>
            </select>
            <button class="btn lg" type="submit" :disabled="busy || !picked">Vào</button>
          </div>
          <div class="sm mut">
            <template v-if="picked">{{ picked.note }}</template>
            <template v-else>Mọi tài khoản mẫu dùng mật khẩu <b class="mono">Demo@123</b>. Sau khi vào có thể đổi tài khoản ở menu tên người dùng góc phải.</template>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>
