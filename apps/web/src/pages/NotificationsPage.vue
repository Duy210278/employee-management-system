<script setup lang="ts">
import type { NotificationView } from '@lotrinh/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { notificationApi, useNotifications } from '@/api/queries';
import SegControl from '@/components/SegControl.vue';
import { useToast } from '@/composables/toast';
import { fmtDate, fmtDateTime } from '@/format';

/** Thông báo trong ứng dụng (mục 10.6, 14.7): bản tin sáng, việc chờ bạn, yêu cầu làm lại, chữ ký, đăng ký mới… */
const router = useRouter();
const qc = useQueryClient();
const toast = useToast();
const { data, isLoading, error } = useNotifications(ref(true));
const onlyUnread = ref(false);
const items = computed(() => (data.value?.items ?? []).filter((n) => !onlyUnread.value || !n.read));
const filterOptions = computed(() => [
  { value: false, label: 'Tất cả' },
  { value: true, label: 'Chưa đọc', count: data.value?.unread ?? 0 },
]);

const TYPE_LABEL: Record<string, string> = {
  digest: 'Bản tin sáng',
  report_done: 'Chờ xác nhận',
  help: 'Cần hỗ trợ',
  rework: 'Làm lại',
  stage_sign: 'Ký giai đoạn',
  review_sign: 'Ký phiếu',
  escalation: 'Leo thang',
  run_start: 'Sắp bắt đầu',
  pause: 'Tạm dừng',
  pause_request: 'Đề xuất tạm dừng',
  assignment: 'Phân công',
  transfer: 'Chuyển cửa hàng',
  registration: 'Đăng ký mới',
  account: 'Tài khoản',
  version_pending: 'Phiên bản',
  version_returned: 'Phiên bản',
  version_active: 'Phiên bản',
};

async function markRead(body: { ids?: number[]; all?: boolean }) {
  try {
    qc.setQueryData(['notifications'], await notificationApi.read(body));
  } catch (err) {
    toast.show((err as Error).message);
  }
}
async function open(n: NotificationView) {
  if (!n.read) await markRead({ ids: [n.id] });
  if (n.link) await router.push(n.link);
}
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="data" class="page">
    <Teleport defer to="#page-actions">
      <button class="btn" type="button" :disabled="!data.unread" @click="markRead({ all: true })">Đánh dấu đã đọc hết</button>
    </Teleport>
    <div class="rowf sp">
      <SegControl v-model="onlyUnread" :options="filterOptions" label="Lọc thông báo" />
      <span class="summary"><b>{{ data.unread }}</b> chưa đọc / {{ data.items.length }} thông báo</span>
    </div>
    <div class="card clip">
      <button v-for="n in items" :key="n.id" type="button" class="note" :class="{ unread: !n.read }" @click="open(n)">
        <span class="dot" aria-hidden="true"></span>
        <span class="grow">
          <b>{{ n.title }}</b>
          <span v-if="n.body" class="sm mut block">{{ n.body }}</span>
        </span>
        <span class="when sm mut" :title="fmtDateTime(n.createdAt)">
          <span class="pill">{{ TYPE_LABEL[n.type] ?? n.type }}</span>
          <span class="nowrap">{{ fmtDate(n.businessDate) }}</span>
        </span>
      </button>
      <div v-if="!items.length" class="empty">
        <h3>{{ data.items.length ? 'Đã đọc hết thông báo' : 'Chưa có thông báo nào' }}</h3>
        <div>Bản tin sáng, việc chờ bạn xác nhận, chữ ký, yêu cầu làm lại sẽ hiện ở đây.</div>
      </div>
    </div>
  </div>
</template>
