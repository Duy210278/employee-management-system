<script setup lang="ts">
import type { ImportUsersResponse } from '@lotrinh/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { ref } from 'vue';
import { userApi } from '@/api/queries';
import { useToast } from '@/composables/toast';

/** Nhập tài khoản hàng loạt (mục 5.6): tải mẫu CSV, xem trước, chỉ nhập các dòng hợp lệ khi xác nhận */
const qc = useQueryClient();
const toast = useToast();
const csv = ref('');
const fileName = ref('');
const result = ref<ImportUsersResponse | null>(null);
const busy = ref(false);

const TEMPLATE = [
  'ma_nv,ho_ten,email,dien_thoai,vai_tro,ma_cua_hang,ma_khu_vuc,buddy',
  'NV401,Đinh Thị Yến,yen@upharma.local,0912000111,NV,NTA,,',
  'CH003,Mai Văn Cường,cuong@upharma.local,0912000222,CHT,NTB,,x',
  'QL002,Trương Thị Hoa,hoa@upharma.local,,QLKV,,HN1,',
].join('\r\n');

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob(['﻿' + TEMPLATE], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mau-nhap-tai-khoan.csv';
  a.click();
  URL.revokeObjectURL(url);
}

async function pick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  fileName.value = file.name;
  csv.value = await file.text();
  result.value = null;
}

async function send(commit: boolean) {
  if (!csv.value.trim()) return toast.show('Chọn tệp CSV hoặc dán nội dung');
  busy.value = true;
  try {
    result.value = await userApi.importCsv(csv.value, commit);
    if (commit) {
      toast.show(`Đã nhập ${result.value.imported} tài khoản`);
      await qc.invalidateQueries({ queryKey: ['users'] });
      csv.value = '';
      fileName.value = '';
    }
  } catch (err) {
    toast.show((err as Error).message);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="stack">
    <div class="card pad stack">
      <div class="h2">Nhập tài khoản từ CSV</div>
      <div class="sm mut">
        Cột: mã NV, họ tên, email, điện thoại, vai trò (NV, CHT, QLKV, BP), mã cửa hàng (bắt buộc với CHT), mã khu vực (bắt buộc với QLKV), quyền Buddy (x). Dấu phân
        cách phẩy hoặc chấm phẩy đều được. Tài khoản nhập vào hoạt động ngay.
      </div>
      <div class="rowf">
        <button class="btn" type="button" @click="downloadTemplate">Tải mẫu CSV</button>
        <label class="btn">Chọn tệp CSV<input type="file" accept=".csv,text/csv" hidden @change="pick" /></label>
        <span v-if="fileName" class="sm mut">{{ fileName }}</span>
      </div>
      <textarea v-model="csv" rows="6" class="mono sm" placeholder="Hoặc dán nội dung CSV vào đây" aria-label="Nội dung CSV" @input="result = null"></textarea>
      <div class="rowf">
        <button class="btn" type="button" :disabled="busy" @click="send(false)">Xem trước</button>
        <button v-if="result && result.valid && result.imported === null" class="btn pri" type="button" :disabled="busy" @click="send(true)">
          Nhập {{ result.valid }} tài khoản hợp lệ
        </button>
      </div>
    </div>

    <div v-if="result" class="card">
      <div class="stg">
        <b>{{ result.imported !== null ? `Đã nhập ${result.imported} tài khoản` : 'Xem trước' }}</b>
        <span class="rowf">
          <span class="pill ok">{{ result.valid }} hợp lệ</span>
          <span class="pill" :class="{ bad: result.invalid }">{{ result.invalid }} lỗi</span>
        </span>
      </div>
      <div v-if="result.imported" class="alert info" style="margin: 10px 14px">
        <div>Mật khẩu ban đầu của các tài khoản vừa nhập: <b class="mono">{{ result.initialPassword }}</b>. Gửi cho từng người và nhắc đổi mật khẩu.</div>
      </div>
      <table class="rt">
        <thead>
          <tr><th>Dòng</th><th>Mã NV</th><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Cửa hàng / khu vực</th><th>Kết quả</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in result.rows" :key="r.line">
            <td data-l="Dòng" class="mono">{{ r.line }}</td>
            <td data-l="Mã NV">{{ r.employeeCode || '—' }}</td>
            <td data-l="Họ tên">{{ r.fullName }}</td>
            <td data-l="Email" class="sm">{{ r.email }}</td>
            <td data-l="Vai trò">{{ r.role }}<template v-if="r.canBuddy"> · Buddy</template></td>
            <td data-l="Phạm vi" class="mono sm">{{ [r.storeCode, r.areaCode].filter(Boolean).join(' · ') || '—' }}</td>
            <td data-l="Kết quả">
              <span v-if="!r.errors.length" class="pill ok">Hợp lệ</span>
              <span v-for="e in r.errors" v-else :key="e" class="pill bad" style="margin: 1px">{{ e }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
