<script setup lang="ts">
/** Soạn một bảng chữ hiển thị (dòng đầu là tiêu đề cột): sửa ô, thêm và xóa dòng */
const props = defineProps<{ rows: string[][]; readonly: boolean }>();

function addRow() {
  const cols = props.rows[0]?.length ?? 1;
  props.rows.push(Array.from({ length: cols }, () => ''));
}
</script>

<template>
  <div class="tw">
    <table class="te">
      <thead v-if="rows.length">
        <tr>
          <th v-for="(_, c) in rows[0]" :key="c"><input v-model="rows[0][c]" :disabled="readonly" :aria-label="`Tiêu đề cột ${c + 1}`" /></th>
          <th v-if="!readonly"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, r) in rows.slice(1)" :key="r">
          <td v-for="(_, c) in row" :key="c"><textarea v-model="rows[r + 1][c]" rows="1" :disabled="readonly" :aria-label="`Dòng ${r + 1}, cột ${c + 1}`"></textarea></td>
          <td v-if="!readonly"><button class="btn sm bad" type="button" aria-label="Xóa dòng" @click="rows.splice(r + 1, 1)">×</button></td>
        </tr>
      </tbody>
    </table>
    <div v-if="!readonly" style="margin-top: 6px"><button class="btn sm" type="button" @click="addRow">+ Thêm dòng</button></div>
  </div>
</template>
