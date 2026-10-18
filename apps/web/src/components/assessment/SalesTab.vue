<script setup lang="ts">
import type { SalesMonthView } from '@lotrinh/shared';
import { computed, toRef } from 'vue';
import { assessmentApi, useMutate, useSales } from '@/api/queries';
import { useToast } from '@/composables/toast';

/** Tab Doanh số (mục 11.5, theo salesTab của N3): nhập theo tháng của Level, đơn vị triệu đồng */
const props = defineProps<{ runId: number }>();
const { data, isLoading, error } = useSales(toRef(() => props.runId));
const mutate = useMutate();
const toast = useToast();

const k = computed(() => data.value!.kpi);
const tone = computed(() => ({ pass: 'ok', fail: 'bad', missing: '' })[k.value.state]);
const pct = (v: number | null, target: number) => (v === null || !target ? '—' : `${Math.round((v / target) * 100)}%`);
const share = (total: number | null, coef1: number | null) => (total && coef1 !== null ? `${Math.round((coef1 / total) * 100)}%` : '—');
const fmt = (v: number | null) => (v === null ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v));

function parse(value: string): number | null | undefined {
  const t = value.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

async function save(row: SalesMonthView, field: 'total' | 'coef1', e: Event) {
  const v = parse((e.target as HTMLInputElement).value);
  if (v === undefined) {
    toast.show('Nhập số không âm, đơn vị triệu đồng (ví dụ 32.5)');
    return;
  }
  if (v === row[field]) return;
  await mutate(() => assessmentApi.putSales(props.runId, row.month, { [field]: v }), `Đã lưu doanh số tháng ${row.month}`);
}
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải doanh số…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="data" class="card pad stack">
    <div class="rowf sp">
      <div>
        <div class="h2">Doanh số Level {{ data.levelKey }}</div>
        <div class="sm mut">
          Mức tham khảo/tháng: DS tổng {{ k.rule.total }} triệu · DS hệ số 1 {{ k.rule.coef1 }} triệu · tỉ trọng H.số 1 ≥ {{ k.rule.ratio }}%. Đơn vị: triệu đồng.
          <template v-if="data.canEdit">CHT hoặc QLKV nhập từ báo cáo POS cuối tháng; để trống cả hai ô là xóa số liệu tháng.</template>
        </div>
      </div>
      <span class="pill" :class="tone">{{ k.label }}</span>
    </div>

    <div class="tw">
      <table class="sales">
        <thead>
          <tr>
            <th>Tháng của Level</th>
            <th class="num">DS tổng</th>
            <th class="num">% đạt</th>
            <th class="num">DS H.số 1</th>
            <th class="num">% đạt</th>
            <th class="num">Tỉ trọng H.số 1</th>
            <th>Người nhập</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in data.rows" :key="r.month" :class="{ cur: r.month === data.currentMonth }">
            <td>
              Tháng {{ r.month }}
              <span v-if="r.inWindow" class="pill info">xét KPI</span>
              <span v-if="r.month === data.currentMonth" class="pill">hiện tại</span>
            </td>
            <td class="num">
              <input v-if="data.canEdit" :value="r.total ?? ''" inputmode="decimal" class="numin" :aria-label="`DS tổng tháng ${r.month}`" @change="save(r, 'total', $event)" />
              <template v-else>{{ fmt(r.total) }}</template>
            </td>
            <td class="num">{{ pct(r.total, k.rule.total) }}</td>
            <td class="num">
              <input v-if="data.canEdit" :value="r.coef1 ?? ''" inputmode="decimal" class="numin" :aria-label="`DS hệ số 1 tháng ${r.month}`" @change="save(r, 'coef1', $event)" />
              <template v-else>{{ fmt(r.coef1) }}</template>
            </td>
            <td class="num">{{ pct(r.coef1, k.rule.coef1) }}</td>
            <td class="num">{{ share(r.total, r.coef1) }}</td>
            <td class="sm mut">{{ r.enteredByName ?? '' }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th>Tổng cộng ({{ k.monthsEntered }} tháng đã nhập)</th>
            <th class="num">{{ fmt(k.sumTotal) }}</th>
            <th></th>
            <th class="num">{{ fmt(k.sumCoef1) }}</th>
            <th></th>
            <th class="num">{{ k.ratio === null ? '—' : `${k.ratio}%` }}</th>
            <th></th>
          </tr>
          <tr>
            <th>Trung bình/tháng</th>
            <th class="num">{{ fmt(k.avgTotal) }}</th>
            <th class="num">{{ pct(k.avgTotal, k.rule.total) }}</th>
            <th class="num">{{ fmt(k.avgCoef1) }}</th>
            <th class="num">{{ pct(k.avgCoef1, k.rule.coef1) }}</th>
            <th class="num">{{ share(k.avgTotal, k.avgCoef1) }}</th>
            <th></th>
          </tr>
          <tr class="win">
            <th>
              Cửa sổ xét KPI (tháng {{ k.rule.windowFrom }}<template v-if="k.rule.windowTo !== k.rule.windowFrom">–{{ k.rule.windowTo }}</template>)
            </th>
            <th class="num">{{ fmt(k.windowAvgTotal) }}</th>
            <th class="num">{{ pct(k.windowAvgTotal, k.rule.total) }}</th>
            <th class="num">{{ fmt(k.windowAvgCoef1) }}</th>
            <th class="num">{{ pct(k.windowAvgCoef1, k.rule.coef1) }}</th>
            <th class="num">{{ share(k.windowAvgTotal, k.windowAvgCoef1) }}</th>
            <th><span class="pill" :class="tone">{{ k.state === 'pass' ? 'Đạt' : k.state === 'fail' ? 'Chưa đạt' : 'Chưa đủ số liệu' }}</span></th>
          </tr>
        </tfoot>
      </table>
    </div>
    <div class="sm mut">
      <template v-if="k.rule.method === 'all_months'">
        Level {{ data.levelKey }}: mọi tháng trong cửa sổ xét phải đạt cả DS tổng và DS hệ số 1 (tối thiểu {{ k.windowMonths }}/{{ k.windowMonths }} tháng đạt KPI).
      </template>
      <template v-else>
        Level {{ data.levelKey }}: điều kiện chính thức là TRUNG BÌNH các tháng {{ k.rule.windowFrom }}–{{ k.rule.windowTo }} của Level. Số liệu các tháng trước để theo dõi
        xu hướng. Tháng của Level tính 30 ngày một tháng từ ngày bắt đầu Level.
      </template>
    </div>
  </div>
</template>
