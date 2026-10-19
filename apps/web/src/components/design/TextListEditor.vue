<script setup lang="ts">
/** Soạn một danh sách dòng chữ (nhiệm vụ LMS, việc tại quầy, phân công…): thêm, sửa, xóa, đổi thứ tự */
const props = withDefaults(defineProps<{ items: string[]; readonly: boolean; placeholder?: string; addLabel?: string }>(), {
  placeholder: '',
  addLabel: '+ Thêm dòng',
});

function move(i: number, d: -1 | 1) {
  const j = i + d;
  if (j < 0 || j >= props.items.length) return;
  [props.items[i], props.items[j]] = [props.items[j], props.items[i]];
}
</script>

<template>
  <div class="tle">
    <div v-for="(_, i) in items" :key="i" class="tle-row">
      <span class="tle-no mono">{{ i + 1 }}</span>
      <textarea v-model="items[i]" rows="1" :placeholder="placeholder" :disabled="readonly" :aria-label="`Dòng ${i + 1}`"></textarea>
      <template v-if="!readonly">
        <button class="btn sm" type="button" :disabled="i === 0" aria-label="Lên" @click="move(i, -1)">↑</button>
        <button class="btn sm" type="button" :disabled="i === items.length - 1" aria-label="Xuống" @click="move(i, 1)">↓</button>
        <button class="btn sm bad" type="button" aria-label="Xóa dòng" @click="items.splice(i, 1)">×</button>
      </template>
    </div>
    <div v-if="!items.length" class="sm mut">Chưa có dòng nào.</div>
    <div v-if="!readonly"><button class="btn sm" type="button" @click="items.push('')">{{ addLabel }}</button></div>
  </div>
</template>
