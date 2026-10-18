<script setup lang="ts">
import { ROLE_LABEL, type AccountRole } from '@lotrinh/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
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

const groups = computed(() => {
  const order: AccountRole[] = ['bp', 'qlkv', 'cht', 'nv'];
  return order
    .map((role) => ({ role, label: ROLE_LABEL[role], items: (accounts.value ?? []).filter((a) => a.role === role) }))
    .filter((g) => g.items.length);
});

async function enter(fn: () => Promise<unknown>) {
  busy.value = true;
  try {
    await fn();
    qc.clear();
    await router.push('/');
  } catch (err) {
    toast.show((err as Error).message);
  } finally {
    busy.value = false;
  }
}

const submit = () => enter(() => sessionApi.login(email.value, password.value));
const quick = (id: number) => enter(() => sessionApi.loginAs(id));
</script>

<template>
  <div class="auth stack">
    <div class="brand"><i>U</i>Lộ trình Upharma</div>
    <div class="grid g2" style="align-items: start">
      <form class="card pad stack" @submit.prevent="submit">
        <div class="h1">Đăng nhập</div>
        <label class="f">Email công ty<input v-model="email" type="email" autocomplete="username" required /></label>
        <label class="f">Mật khẩu<input v-model="password" type="password" autocomplete="current-password" required /></label>
        <div><button class="btn pri" type="submit" :disabled="busy">Đăng nhập</button></div>
        <div v-if="accounts?.length" class="sm mut">Bản demo: mọi tài khoản mẫu dùng mật khẩu <b class="mono">Demo@123</b>.</div>
      </form>

      <div v-if="accounts?.length && !noDemo" class="card pad stack">
        <div class="h2">Đăng nhập nhanh (bản demo)</div>
        <div class="sm mut">Bấm một tài khoản mẫu để vào ngay. Sau khi vào có thể đổi tài khoản ở thanh trên cùng.</div>
        <div v-for="g in groups" :key="g.role" class="stack" style="gap: 6px">
          <div class="sec">{{ g.label }}</div>
          <button
            v-for="a in g.items"
            :key="a.id"
            class="btn acct"
            type="button"
            :disabled="busy || a.status !== 'active'"
            @click="quick(a.id)"
          >
            <span>{{ a.fullName }} <span v-if="a.status !== 'active'" class="pill warn">Chờ duyệt</span></span>
            <span class="sm mut" style="font-weight: 400">{{ a.note }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
