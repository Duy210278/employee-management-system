<script setup lang="ts">
import { addDays, ROLE_LABEL } from '@lotrinh/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { sessionApi, useDemoAccounts, useMe, useMutate } from '@/api/queries';
import { useToast } from '@/composables/toast';
import { diffDays, fmtDate } from '@/format';

/** Quản trị (mục 4.3). Bản MVP mới có Công cụ demo (mục 14.7); quản trị tài khoản thuộc giai đoạn 2 */
const { data: me } = useMe();
const qc = useQueryClient();
const toast = useToast();
const mutate = useMutate();
const { data: accounts } = useDemoAccounts(computed(() => !!me.value?.demoMode));
const armed = ref(false);
const busy = ref(false);

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
    <div class="h2">Quản trị</div>
    <div v-if="me?.user.role !== 'bp'" class="card empty"><h3>Chỉ BP Đào tạo dùng được trang này</h3></div>
    <template v-else>
      <div class="card pad stack" style="color: var(--mut)">
        <div class="sm">Tài khoản và vai trò, hàng chờ duyệt đăng ký, danh mục cửa hàng, nhập CSV, nhật ký hệ thống: có ở giai đoạn 2.</div>
      </div>

      <template v-if="me.demoMode && clock">
        <div class="sec">Công cụ demo</div>
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
