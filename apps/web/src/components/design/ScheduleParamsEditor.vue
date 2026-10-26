<script setup lang="ts">
import type { ScheduleParams } from '@lotrinh/shared';
import { computed } from 'vue';
import { useDesigner } from '@/designer/editor';
import { intOf } from '@/designer/ops';

/** Tham số lịch (mục 10.4), có phiên bản cùng Bộ lộ trình */
const d = useDesigner();
const p = computed(() => d.content.value.scheduleParams);
const fields: { key: keyof ScheduleParams; label: string; help: string }[] = [
  { key: 'remindDays', label: 'Nhắc trước hạn (ngày)', help: 'Chuyển "Sắp đến hạn" và gửi nhắc' },
  { key: 'escalateDays', label: 'Leo thang sau (ngày)', help: 'Quá hạn hơn số ngày này thì báo QLKV, tính là cảnh báo đỏ' },
  { key: 'signOpenBefore', label: 'Mở ký trước khi giai đoạn kết thúc (ngày)', help: 'Ký cuối giai đoạn' },
  { key: 'signDueAfter', label: 'Hạn ký sau khi giai đoạn kết thúc (ngày)', help: 'Ký cuối giai đoạn' },
  { key: 'posDataDay', label: 'Ngày chốt số liệu POS', help: 'Ngày trong tháng sau, đầu việc nguồn POS mở từ ngày này' },
  { key: 'exemptFromDay', label: 'Miễn chỉ tiêu tháng đầu nếu vào từ ngày', help: 'Theo Checklist N2 mục #37' },
  { key: 'upcomingDays', label: 'Hiện việc sắp mở trước (ngày)', help: 'Mục "Sắp tới"' },
  { key: 'graceDays', label: 'Ân hạn khi chuyển phiên bản (ngày)', help: 'Mục mới đã quá hạn được dời hạn thêm số ngày này' },
  { key: 'shiftsPerWeek', label: 'Số ca mỗi tuần', help: 'Ước tính "ca thứ mấy" khi chưa có chấm công' },
];
</script>

<template>
  <div id="settings" class="card pad stack">
    <div class="h2">Tham số lịch</div>
    <div class="sm mut">Đổi tham số là thay đổi tiêu chí: chỉ áp dụng cho lượt Level bắt đầu từ ngày hiệu lực của phiên bản mới.</div>
    <div class="form">
      <label v-for="f in fields" :key="f.key" class="f">
        {{ f.label }}
        <input :value="p[f.key]" type="number" min="0" :data-field="f.key" :disabled="!d.editable.value" @change="p[f.key] = intOf($event)" />
        <span class="sm fw4">{{ f.help }}</span>
      </label>
    </div>
  </div>
</template>
