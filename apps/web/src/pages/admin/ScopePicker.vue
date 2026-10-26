<script setup lang="ts">
import { ACCOUNT_ROLES, ROLE_LABEL, type AccountRole, type OrgOptions } from '@lotrinh/shared';
import { computed } from 'vue';

/** Chọn vai trò, phạm vi (cửa hàng cho CHT, khu vực cho QLKV) và quyền bổ sung (mục 5.3) */
const model = defineModel<{ role: AccountRole; storeIds: number[]; areaIds: number[]; canBuddy: boolean; canApproveVersions: boolean }>({ required: true });
const props = defineProps<{ options: OrgOptions; disabled?: boolean }>();
// Danh mục đang hoạt động, cộng thêm mục đã gán dù đã ngừng để không mất khi lưu lại
const stores = computed(() => props.options.stores.filter((x) => x.active || model.value.storeIds.includes(x.id)));
const areas = computed(() => props.options.areas.filter((x) => x.active || model.value.areaIds.includes(x.id)));

function toggle(list: 'storeIds' | 'areaIds', id: number) {
  const cur = model.value[list];
  model.value = { ...model.value, [list]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
}
</script>

<template>
  <div class="stack">
    <label class="f w-md">
      Vai trò tài khoản
      <select v-model="model.role" :disabled="disabled">
        <option v-for="r in ACCOUNT_ROLES" :key="r" :value="r">{{ ROLE_LABEL[r] }}</option>
      </select>
    </label>
    <div v-if="model.role === 'cht'" class="stack tight">
      <span class="sm b">Cửa hàng phụ trách (ít nhất 1)</span>
      <div class="rowf">
        <label v-for="s in stores" :key="s.id" class="p cb">
          <input type="checkbox" :checked="model.storeIds.includes(s.id)" :disabled="disabled" @change="toggle('storeIds', s.id)" /> {{ s.name }}
          <span class="mut fw4">· {{ s.areaName }}</span>
        </label>
      </div>
    </div>
    <div v-if="model.role === 'qlkv'" class="stack tight">
      <span class="sm b">Khu vực phụ trách (ít nhất 1)</span>
      <div class="rowf">
        <label v-for="a in areas" :key="a.id" class="p cb">
          <input type="checkbox" :checked="model.areaIds.includes(a.id)" :disabled="disabled" @change="toggle('areaIds', a.id)" /> {{ a.name }}
        </label>
      </div>
    </div>
    <div class="rowf">
      <label class="p cb"><input v-model="model.canBuddy" type="checkbox" :disabled="disabled" /> Có thể làm Buddy</label>
      <label class="p cb"><input v-model="model.canApproveVersions" type="checkbox" :disabled="disabled" /> Người duyệt phiên bản</label>
    </div>
  </div>
</template>
