<script setup lang="ts">
import { ROLE_LABEL, type JobName, type JobResult } from '@lotrinh/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { demoApi, sessionApi, useDemoAccounts, useMe, useMutate } from '@/api/queries';
import { useToast } from '@/composables/toast';
import { fmtDate } from '@/format';

/** Công cụ demo (mục 14.7): chạy job ngay, khôi phục dữ liệu mẫu */
const { data: me } = useMe();
const qc = useQueryClient();
const toast = useToast();
const mutate = useMutate();
const { data: accounts } = useDemoAccounts(computed(() => !!me.value?.demoMode));
const armed = ref(false);
const busy = ref(false);

const JOBS: [JobName, string][] = [
  ['host-sync', 'Đồng bộ nhân sự từ hệ thống chính'],
  ['daily-digest', 'Bản tin sáng'],
  ['escalation', 'Báo QLKV việc quá hạn lâu'],
  ['run-start-reminder', 'Nhắc lượt sắp bắt đầu'],
  ['version-activate', 'Kích hoạt phiên bản'],
  ['alerts-refresh', 'Tính lại cảnh báo'],
];
const jobResults = ref<JobResult[]>([]);
async function runJob(name: JobName) {
  const res = await mutate(() => demoApi.runJob(name), 'Đã chạy job');
  if (res) jobResults.value = [res, ...jobResults.value.filter((r) => r.name !== name)];
}

async function reset() {
  if (!armed.value) {
    armed.value = true;
    toast.show('Bấm lần nữa để xác nhận: mọi thay đổi trong demo sẽ bị xóa');
    setTimeout(() => (armed.value = false), 5000);
    return;
  }
  busy.value = true;
  armed.value = false;
  try {
    const res = await sessionApi.resetDemo();
    qc.clear();
    toast.show(`Đã khôi phục dữ liệu mẫu, mốc ngày ${fmtDate(res.today)}`);
  } catch (err) {
    toast.show((err as Error).message);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="stack">
    <template v-if="me">
      <div v-if="!me.demoMode" class="card empty">Công cụ demo chỉ có ở bản demo (DEMO_MODE).</div>
      <template v-else>
        <div class="card pad stack">
          <div class="h2">Khôi phục dữ liệu mẫu</div>
          <div class="sm mut">
            Xóa toàn bộ dữ liệu, nạp lại bộ lộ trình v2.1 và các tài khoản mẫu. Ngày bắt đầu Level được tính lùi từ hôm nay ({{ fmtDate(me.clock.today) }}) nên luôn có đủ
            tình huống: đang chạy, sắp đến hạn, quá hạn, sắp bắt đầu.
          </div>
          <div>
            <button class="btn bad" type="button" :disabled="busy" @click="reset">
              {{ armed ? 'Bấm lần nữa để khôi phục' : 'Khôi phục dữ liệu mẫu' }}
            </button>
          </div>
        </div>

        <div class="card pad stack">
          <div class="h2">Chạy job ngay</div>
          <div class="sm mut">
            Job chạy tự động khi khởi động và khi sang ngày mới. Chạy lại không tạo thông báo trùng (mỗi người một bản tin mỗi ngày).
          </div>
          <div class="rowf">
            <button v-for="[name, label] in JOBS" :key="name" class="btn sm" type="button" @click="runJob(name)">{{ label }}</button>
          </div>
          <ul v-if="jobResults.length" class="ul sm">
            <li v-for="r in jobResults" :key="r.name"><b>{{ r.label }}</b> ({{ fmtDate(r.date) }}): {{ r.message }}<template v-if="r.created"> · {{ r.created }} thông báo mới</template></li>
          </ul>
        </div>

        <div class="card">
          <div class="stg"><b>Tài khoản mẫu</b><span class="sm mut">Mật khẩu chung: <span class="mono">Demo@123</span></span></div>
          <table class="rt">
            <thead>
              <tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Tình huống mẫu</th></tr>
            </thead>
            <tbody>
              <tr v-for="a in accounts" :key="a.id">
                <td data-l="Họ tên"><b>{{ a.fullName }}</b> <span v-if="a.status !== 'active'" class="pill warn">Chờ duyệt</span></td>
                <td data-l="Email" class="sm">{{ a.email }}</td>
                <td data-l="Vai trò">{{ ROLE_LABEL[a.role] }}</td>
                <td data-l="Tình huống" class="sm mut">{{ a.note }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </div>
</template>
