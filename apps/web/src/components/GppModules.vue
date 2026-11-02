<script setup lang="ts">
/**
 * Phụ lục B của Khung năng lực N1 (docs/nguon/Khung_Nang_Luc_Upharma_v2.1.docx): module GPP tối thiểu theo Level.
 * Nội dung tĩnh chép nguyên văn từ N1; currentLevel tô nổi các module của Level đang học.
 */
defineProps<{ currentLevel?: number }>();

const MODULES: { level: number; name: string }[] = [
  { level: 1, name: 'Nguyên tắc GPP cơ bản: Quy trình bán hàng' },
  { level: 2, name: 'Nguyên tắc GPP tối thiểu: Các giấy tờ niêm yết tại nhà thuốc, Sắp xếp – trưng bày hàng hóa' },
  { level: 3, name: 'Quy định liên quan đến nhiệt độ – độ ẩm tại nhà thuốc' },
  { level: 3, name: 'Các lỗi thường gặp, cần tránh trong hệ thống' },
  { level: 4, name: 'Quy định về hồ sơ liên quan đến PCCC' },
  { level: 4, name: 'Quy định liên thông đơn thuốc' },
];
</script>

<template>
  <div class="card pad stack">
    <div class="h2">Phụ lục B. Module GPP tối thiểu (bắt buộc — Bộ Y tế)</div>
    <div class="sm mut">
      Module GPP tối thiểu bắt buộc từ Level 2.<template v-if="currentLevel"> Các module của Level {{ currentLevel }} được tô nổi.</template>
    </div>
    <div class="tw">
      <table class="gpp">
        <thead>
          <tr><th>Level</th><th>Module</th></tr>
        </thead>
        <tbody>
          <tr v-for="(m, i) in MODULES" :key="i" :class="{ cur: m.level === currentLevel }">
            <td class="nowrap">
              <span class="pill" :class="{ info: m.level === currentLevel }">Level {{ m.level }}</span>
            </td>
            <td>{{ m.name }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

