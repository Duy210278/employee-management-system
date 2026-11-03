<script setup lang="ts">
import { computed } from 'vue';

/**
 * Phụ lục A của Khung năng lực N1 (docs/nguon/Khung_Nang_Luc_Upharma_v2.1.docx): danh sách SKU theo Level.
 * Nội dung tĩnh chép nguyên văn từ N1; chỉ hiện phần của Level đang học. Danh sách SKU chi tiết nằm trên LMS.
 */
const props = defineProps<{ level: number }>();

interface Part {
  title: string;
  intro: string;
  groups: string[];
  noteTitle: string;
  note: string;
}

const PARTS: Record<number, Part> = {
  1: {
    title: 'A.1 — 55 SKU Level 1 (nhóm tham chiếu)',
    intro: 'Danh sách đầy đủ 55 SKU Level 1 bao gồm 6 nhóm sau. BP Đào tạo chịu trách nhiệm duy trì và cập nhật danh sách khi có thay đổi danh mục:',
    groups: ['Giảm đau, hạ sốt', 'Kháng sinh', 'Chống viêm', 'Kháng histamin', 'Hô hấp, Tai Mũi Họng cơ bản', 'Vitamin & khoáng chất cơ bản'],
    noteTitle: 'LƯU Ý QUAN TRỌNG',
    note: 'Danh sách SKU chi tiết được lưu trên LMS. Buddy/CHT in ra và gắn tại quầy. BP Đào tạo cập nhật định kỳ mỗi tháng.',
  },
  2: {
    title: 'A.2 — 98 SKU Level 2 (không bao gồm 55 SKU Level 1)',
    intro: 'Bổ sung thêm 98 SKU so với Level 1, bao gồm:',
    groups: ['Tiêu hóa', 'Răng miệng', 'Cơ xương khớp', 'Kháng sinh mắt', 'Chăm sóc mắt', 'Vitamin & khoáng chất', 'Chăm sóc cơ thể'],
    noteTitle: 'LƯU Ý',
    note: 'Danh sách SKU Level 2 đầy đủ (98 mục) do BP Đào tạo cung cấp trên LMS. BP Đào tạo cập nhật định kỳ mỗi tháng.',
  },
  3: {
    title: 'A.3 — 66 SKU Level 3 (không bao gồm 153 SKU Level 1 & 2)',
    intro: 'Bổ sung thêm 66 SKU so với Level 2, bao gồm:',
    groups: ['Da liễu', 'Tiết niệu, sinh dục, phụ khoa', 'Thần kinh', 'Gan, thận'],
    noteTitle: 'LƯU Ý',
    note: 'Danh sách SKU Level 3 đầy đủ (66 mục) do BP Đào tạo cung cấp trên LMS. BP Đào tạo cập nhật định kỳ mỗi tháng.',
  },
  4: {
    title: 'A.4 — 27 SKU Level 4 (không bao gồm 219 SKU Level 1, 2 & 3)',
    intro: 'Bổ sung thêm 27 SKU so với Level 3, bao gồm:',
    groups: ['Thuốc tiêm, truyền', 'Thiết bị, dụng cụ theo dõi', 'Nhóm khác'],
    noteTitle: 'LƯU Ý',
    note: 'Danh sách SKU Level 4 đầy đủ (27 mục) do BP Đào tạo cung cấp trên LMS. BP Đào tạo cập nhật định kỳ mỗi tháng.',
  },
};

const part = computed(() => PARTS[props.level] ?? null);
</script>

<template>
  <div v-if="part" class="card pad stack">
    <div class="h2">Phụ lục A. Danh sách SKU theo Level</div>
    <div class="b">{{ part.title }}</div>
    <div>{{ part.intro }}</div>
    <ul class="ul">
      <li v-for="(g, i) in part.groups" :key="g">Nhóm {{ i + 1 }} — {{ g }}</li>
    </ul>
    <div class="alert info">
      <div><b>⚑ {{ part.noteTitle }}:</b> {{ part.note }}</div>
    </div>
  </div>
</template>
