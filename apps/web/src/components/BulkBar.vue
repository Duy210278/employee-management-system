<script setup lang="ts">
import type { ConfirmManyResult } from '@lotrinh/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { taskApi } from '@/api/queries';
import { useBulk } from '@/composables/bulkConfirm';
import { useToast } from '@/composables/toast';

/** Thanh duyệt nhanh ở đáy màn hình: báo hoàn thành (NV) hoặc xác nhận đạt (người kiểm tra) mọi đầu việc đang chọn */
const sel = useBulk();
const qc = useQueryClient();
const toast = useToast();
const busy = ref(false);
const failed = ref<ConfirmManyResult['failed']>([]);

const list = computed(() => [...(sel?.picked.values() ?? [])]);
const allNv = computed(() => list.value.every((t) => t.actions.confirmAs?.role === 'nv'));
const noNv = computed(() => list.value.every((t) => t.actions.confirmAs?.role !== 'nv'));
const label = computed(() => {
  const n = list.value.length;
  if (allNv.value) return `Báo hoàn thành ${n} mục`;
  return noNv.value ? `Xác nhận đạt ${n} mục` : `Xác nhận ${n} mục`;
});

async function run() {
  const n = list.value.length;
  const question = allNv.value ? `Báo hoàn thành ${n} mục đã chọn? Người xác nhận sẽ nhận thông báo.` : `Xác nhận đạt ${n} mục đã chọn?`;
  if (!sel || !n || !window.confirm(question)) return;
  busy.value = true;
  try {
    const res = await taskApi.confirmMany(list.value);
    failed.value = res.failed;
    sel.clear();
    if (res.failed.length) toast.show(`Đã xong ${res.confirmed}/${n} mục, ${res.failed.length} mục chưa duyệt được`);
    else toast.show(allNv.value ? `Đã báo hoàn thành ${n} mục` : `Đã xác nhận ${n} mục`);
  } catch (err) {
    toast.show(err instanceof Error ? err.message : 'Không duyệt được');
  } finally {
    busy.value = false;
    await qc.invalidateQueries();
  }
}
</script>

<template>
  <div v-if="list.length || failed.length" class="bulk" role="region" aria-label="Duyệt nhanh">
    <div v-if="failed.length" class="alert" role="alert">
      <div class="grow">
        <b>{{ failed.length }} mục chưa duyệt được</b>
        <ul class="ul mt6">
          <li v-for="f in failed" :key="f.id"><span class="mono">{{ f.itemKey }}</span> {{ f.message }}</li>
        </ul>
      </div>
      <button class="btn sm ghost" type="button" @click="failed = []">Đóng</button>
    </div>
    <div v-if="list.length" class="savebar">
      <span>Đã chọn {{ list.length }} mục</span>
      <button class="btn sm" type="button" :disabled="busy" @click="sel?.clear()">Bỏ chọn</button>
      <button class="btn sm pri" type="button" :disabled="busy" @click="run">{{ label }}</button>
    </div>
  </div>
</template>
