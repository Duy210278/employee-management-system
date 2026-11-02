<script setup lang="ts">
import { addDays, ROLE_LABEL, type JobName, type JobResult } from '@lotrinh/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { demoApi, sessionApi, useDemoAccounts, useMe, useMutate } from '@/api/queries';
import { useToast } from '@/composables/toast';
import { diffDays, fmtDate } from '@/format';

/** Công cụ demo (mục 14.7): ngày giả lập, chạy job ngay, khôi phục dữ liệu mẫu */
const { data: me } = useMe();
const qc = useQueryClient();
const toast = useToast();
const mutate = useMutate();
const { data: accounts } = useDemoAccounts(computed(() => !!me.value?.demoMode));
const armed = ref(false);
const busy = ref(false);

const JOBS: [JobName, string][] = [
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

const clock = computed(() => me.value?.clock);
const offset = computed(() => (clock.value ? diffDays(clock.value.today, clock.value.realToday) : 0));

const shift = (days: number) => mutate(() => sessionApi.setClock({ shiftDays: days }), days > 0 ? `Đã tua tới +${days} ngày` : `Đã lùi ${-days} ngày`);
const back = () => mutate(() => sessionApi.setClock({ date: null }), 'Đã về ngày thật');

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
      <template v-else-if="clock">
        <div class="grid g2">
          <div class="card pad stack">
            <div class="h2">Ngày giả lập</div>
            <div>
              Hôm nay trong hệ thống: <b>{{ fmtDate(clock.today) }}</b>
              <span v-if="clock.simulated" class="pill warn">{{ offset > 0 ? '+' : '' }}{{ offset }} ngày so với ngày thật</span>
              <span v-else class="pill ok">Ngày thật</span>
            </div>
            <div class="sm mut">Mọi phép tính hạn, trạng thái, hàng đợi đều lấy ngày này. Áp dụng cho mọi người dùng trên máy demo.</div>
            <div class="rowf">
              <button class="btn" type="button" @click="shift(-1)">−1 ngày</button>
              <button class="btn" type="button" @click="shift(1)">+1 ngày</button>
              <button class="btn" type="button" @click="shift(7)">+1 tuần</button>
              <button class="btn" type="button" @click="shift(30)">+30 ngày</button>
              <button class="btn" type="button" :disabled="!clock.simulated" @click="back">Về ngày thật</button>
            </div>
            <div class="sm mut">Ví dụ: ngày mai là {{ fmtDate(addDays(clock.today, 1)) }}.</div>
          </div>

          <div class="card pad stack">
            <div class="h2">Khôi phục dữ liệu mẫu</div>
            <div class="sm mut">
              Xóa toàn bộ dữ liệu, nạp lại bộ lộ trình v2.1 và các tài khoản mẫu, đặt lại ngày thật. Ngày bắt đầu Level được tính lùi từ hôm nay nên luôn có đủ tình
              huống: đang chạy, sắp đến hạn, quá hạn, sắp bắt đầu.
            </div>
            <div>
              <button class="btn bad" type="button" :disabled="busy" @click="reset">
                {{ armed ? 'Bấm lần nữa để khôi phục' : 'Khôi phục dữ liệu mẫu' }}
              </button>
            </div>
          </div>
        </div>

        <div class="card pad stack">
          <div class="h2">Chạy job ngay</div>
          <div class="sm mut">
            Job chạy tự động khi khởi động, khi sang ngày mới và mỗi lần đổi ngày giả lập. Chạy lại không tạo thông báo trùng (mỗi người một bản tin mỗi ngày).
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
