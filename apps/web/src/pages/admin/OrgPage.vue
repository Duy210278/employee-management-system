<script setup lang="ts">
import { AreaBody, StoreBody } from '@lotrinh/shared';
import { useQueryClient } from '@tanstack/vue-query';
import { reactive, ref } from 'vue';
import { orgApi, useOrg } from '@/api/queries';
import { useToast } from '@/composables/toast';

/** Danh mục cửa hàng, khu vực (mục 5.5): CHT, QLKV phụ trách lấy theo phạm vi tài khoản */
const qc = useQueryClient();
const toast = useToast();
const { data, isLoading, error } = useOrg();
const busy = ref(false);

const area = reactive({ id: 0, code: '', name: '', active: true });
const store = reactive({ id: 0, code: '', name: '', address: '', areaId: 0, active: true });

async function save<T>(fn: () => Promise<T>, done: string, reset: () => void) {
  busy.value = true;
  try {
    qc.setQueryData(['org'], await fn());
    await qc.invalidateQueries({ queryKey: ['users'] });
    toast.show(done);
    reset();
  } catch (err) {
    toast.show((err as Error).message);
  } finally {
    busy.value = false;
  }
}
const resetArea = () => Object.assign(area, { id: 0, code: '', name: '', active: true });
const resetStore = () => Object.assign(store, { id: 0, code: '', name: '', address: '', areaId: 0, active: true });

function saveArea() {
  const parsed = AreaBody.safeParse(area);
  if (!parsed.success) return toast.show(parsed.error.issues[0]?.message ?? 'Kiểm tra lại');
  void save(() => (area.id ? orgApi.updateArea(area.id, parsed.data) : orgApi.createArea(parsed.data)), area.id ? 'Đã lưu khu vực' : 'Đã thêm khu vực', resetArea);
}
function saveStore() {
  const parsed = StoreBody.safeParse(store);
  if (!parsed.success) return toast.show(parsed.error.issues[0]?.message ?? 'Chọn khu vực cho cửa hàng');
  void save(() => (store.id ? orgApi.updateStore(store.id, parsed.data) : orgApi.createStore(parsed.data)), store.id ? 'Đã lưu cửa hàng' : 'Đã thêm cửa hàng', resetStore);
}
</script>

<template>
  <div v-if="isLoading" class="card empty">Đang tải…</div>
  <div v-else-if="error" class="alert bad"><div>{{ error.message }}</div></div>
  <div v-else-if="data" class="stack">
    <div class="card">
      <div class="stg"><b>Khu vực</b><span class="sm mut">QLKV phụ trách lấy từ phạm vi tài khoản QLKV</span></div>
      <table class="rt">
        <thead>
          <tr><th>Mã</th><th>Tên</th><th>Cửa hàng</th><th>QLKV phụ trách</th><th>Trạng thái</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="a in data.areas" :key="a.id">
            <td data-l="Mã" class="mono">{{ a.code }}</td>
            <td data-l="Tên"><b>{{ a.name }}</b></td>
            <td data-l="Cửa hàng">{{ a.storeCount }}</td>
            <td data-l="QLKV">{{ a.qlkvNames.join(', ') || '—' }}</td>
            <td data-l="Trạng thái"><span class="pill" :class="a.active ? 'ok' : ''">{{ a.active ? 'Hoạt động' : 'Ngừng' }}</span></td>
            <td><button class="btn sm" type="button" @click="Object.assign(area, { id: a.id, code: a.code, name: a.name, active: a.active })">Sửa</button></td>
          </tr>
        </tbody>
      </table>
      <form class="pad rowf bt" @submit.prevent="saveArea">
        <b class="sm">{{ area.id ? 'Sửa khu vực' : 'Thêm khu vực' }}</b>
        <input v-model="area.code" placeholder="Mã, vd. HN2" size="8" aria-label="Mã khu vực" />
        <input v-model="area.name" placeholder="Tên khu vực" aria-label="Tên khu vực" />
        <label class="p cb"><input v-model="area.active" type="checkbox" /> Hoạt động</label>
        <button class="btn sm pri" type="submit" :disabled="busy">{{ area.id ? 'Lưu' : 'Thêm' }}</button>
        <button v-if="area.id" class="btn sm" type="button" @click="resetArea">Hủy</button>
      </form>
    </div>

    <div class="card">
      <div class="stg"><b>Cửa hàng</b><span class="sm mut">Hồ sơ NV và tài khoản chọn cửa hàng từ danh mục này</span></div>
      <table class="rt">
        <thead>
          <tr><th>Mã</th><th>Tên</th><th>Khu vực</th><th>CHT phụ trách</th><th>NV đang theo dõi</th><th>Trạng thái</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="s in data.stores" :key="s.id">
            <td data-l="Mã" class="mono">{{ s.code }}</td>
            <td data-l="Tên"><b>{{ s.name }}</b><div v-if="s.address" class="sm mut">{{ s.address }}</div></td>
            <td data-l="Khu vực">{{ s.areaName }}</td>
            <td data-l="CHT">{{ s.chtNames.join(', ') || '—' }}</td>
            <td data-l="NV">{{ s.staffCount }}</td>
            <td data-l="Trạng thái"><span class="pill" :class="s.active ? 'ok' : ''">{{ s.active ? 'Hoạt động' : 'Ngừng' }}</span></td>
            <td>
              <button class="btn sm" type="button" @click="Object.assign(store, { id: s.id, code: s.code, name: s.name, address: s.address ?? '', areaId: s.areaId, active: s.active })">
                Sửa
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <form class="pad stack bt" @submit.prevent="saveStore">
        <b class="sm">{{ store.id ? 'Sửa cửa hàng' : 'Thêm cửa hàng' }}</b>
        <div class="form">
          <label class="f">Mã<input v-model="store.code" placeholder="vd. NTC" /></label>
          <label class="f">Tên<input v-model="store.name" /></label>
          <label class="f">Địa chỉ<input v-model="store.address" /></label>
          <label class="f">
            Khu vực
            <select v-model.number="store.areaId">
              <option :value="0" disabled>Chọn khu vực</option>
              <option v-for="a in data.areas" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </label>
        </div>
        <div class="rowf">
          <label class="p cb"><input v-model="store.active" type="checkbox" /> Hoạt động</label>
          <button class="btn sm pri" type="submit" :disabled="busy">{{ store.id ? 'Lưu' : 'Thêm cửa hàng' }}</button>
          <button v-if="store.id" class="btn sm" type="button" @click="resetStore">Hủy</button>
        </div>
      </form>
    </div>
  </div>
</template>
