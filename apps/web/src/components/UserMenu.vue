<script setup lang="ts">
import { ROLE_LABEL, type MeResponse } from '@lotrinh/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { sessionApi, useDemoAccounts } from '@/api/queries';
import { useTheme, type ThemePref } from '@/composables/theme';
import { useToast } from '@/composables/toast';
import Avatar from './Avatar.vue';
import Icon from './Icon.vue';
import SegControl from './SegControl.vue';

/** Khối người dùng góc phải thanh trên: tên, vai trò; bấm mở menu đổi tài khoản (bản demo) và đăng xuất */
const props = defineProps<{ me: MeResponse }>();
const router = useRouter();
const route = useRoute();
const qc = useQueryClient();
const toast = useToast();
const open = ref(false);
const root = ref<HTMLElement | null>(null);
const button = ref<HTMLButtonElement | null>(null);

const { data: accounts } = useDemoAccounts(computed(() => props.me.demoMode));
const activeAccounts = computed(() => (accounts.value ?? []).filter((a) => a.status === 'active'));
const roleLabel = computed(() => ROLE_LABEL[props.me.user.role]);
const theme = useTheme();
const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
  { value: 'system', label: 'Theo máy' },
];

function close(focusButton = false) {
  open.value = false;
  if (focusButton) button.value?.focus();
}
function onPointer(e: PointerEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) close();
}
function onKey(e: KeyboardEvent) {
  if (open.value && e.key === 'Escape') close(true);
}
onMounted(() => {
  document.addEventListener('pointerdown', onPointer);
  document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointer);
  document.removeEventListener('keydown', onKey);
});
watch(
  () => route.fullPath,
  () => close(),
);

async function switchAccount(event: Event) {
  const userId = Number((event.target as HTMLSelectElement).value);
  if (!userId || userId === props.me.user.id) return;
  try {
    await sessionApi.loginAs(userId);
    qc.clear();
    close();
    await router.push('/');
    toast.show(`Đã chuyển sang ${activeAccounts.value.find((a) => a.id === userId)?.fullName ?? 'tài khoản khác'}`);
  } catch (err) {
    toast.show((err as Error).message);
  }
}

async function logout() {
  await sessionApi.logout().catch(() => undefined);
  qc.clear();
  await router.push('/dang-nhap');
}
</script>

<template>
  <div ref="root" class="um">
    <button ref="button" class="um-btn" type="button" aria-haspopup="true" :aria-expanded="open" :aria-label="`${me.user.fullName}, ${roleLabel}`" @click="open = !open">
      <span class="um-text">
        <b>{{ me.user.fullName }}</b>
        <span>{{ roleLabel }}</span>
      </span>
      <Avatar :name="me.user.fullName" />
    </button>
    <div v-if="open" class="um-pop">
      <div class="um-head">
        <Avatar :name="me.user.fullName" size="lg" />
        <div>
          <b>{{ me.user.fullName }}</b>
          <div class="sm mut">{{ roleLabel }}</div>
          <div class="sm mut">{{ me.user.email }}</div>
        </div>
      </div>
      <div v-if="me.demoMode && activeAccounts.length" class="um-sec">
        <label class="sm mut b" for="acctSw">Đổi tài khoản (bản demo)</label>
        <select id="acctSw" :value="me.user.id" @change="switchAccount">
          <option v-for="a in activeAccounts" :key="a.id" :value="a.id">{{ a.fullName }} · {{ ROLE_LABEL[a.role] }}</option>
        </select>
      </div>
      <div class="um-sec">
        <span class="sm mut b">Giao diện</span>
        <SegControl :model-value="theme.pref.value" :options="THEME_OPTIONS" label="Chế độ giao diện" small @update:model-value="theme.set" />
      </div>
      <div class="um-sec">
        <button class="um-item" type="button" @click="logout"><Icon name="logout" /> Đăng xuất</button>
      </div>
    </div>
  </div>
</template>
