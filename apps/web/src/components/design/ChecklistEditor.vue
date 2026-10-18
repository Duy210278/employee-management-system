<script setup lang="ts">
import { ROLE_SHORT, VERIFIER_ROLES, type Item } from '@lotrinh/shared';
import { computed, nextTick, ref } from 'vue';
import { useDesigner } from '@/designer/editor';
import { addStage } from '@/designer/ops';
import StageEditor from './StageEditor.vue';
import StageTimeline from './StageTimeline.vue';

/** Tab "Checklist theo giai đoạn" (mục 7.3) */
const d = useDesigner();
const q = ref('');
const role = ref('');
const gppOnly = ref(false);

const level = computed(() => d.content.value.levels.find((l) => l.key === d.levelKey.value)!);
const levels = computed(() =>
  d.content.value.levels.map((l) => ({
    key: l.key,
    days: l.totalDays,
    items: l.stages.reduce((a, s) => a + s.items.length, 0),
    errors: d.issues.value.filter((i) => i.at.levelKey === l.key && i.level === 'error').length,
  })),
);

const visible = computed(() => {
  const text = q.value.trim().toLowerCase();
  return (it: Item) =>
    (!text || `${it.key} ${it.content} ${it.guidance} ${it.category}`.toLowerCase().includes(text)) &&
    (!role.value || it.verifiers.includes(role.value as Item['verifiers'][number])) &&
    (!gppOnly.value || it.gpp);
});
const filtering = computed(() => !!q.value.trim() || !!role.value || gppOnly.value);

function collapseAll(on: boolean) {
  for (const s of level.value.stages) {
    if (on) d.collapsed.add(s.key);
    else d.collapsed.delete(s.key);
  }
}

function newStage() {
  const s = addStage(level.value);
  void nextTick(() => d.focus({ levelKey: level.value.key, stageKey: s.key, field: 'name' }));
}
</script>

<template>
  <div class="stack">
    <div class="sub" role="tablist" aria-label="Chọn Level">
      <button
        v-for="l in levels"
        :key="l.key"
        type="button"
        role="tab"
        :aria-current="d.levelKey.value === l.key"
        :aria-selected="d.levelKey.value === l.key"
        @click="d.levelKey.value = l.key"
      >
        L{{ l.key }} · {{ l.days }} ngày · {{ l.items }} mục<template v-if="l.errors"> · <span style="color: var(--bad)">{{ l.errors }} lỗi</span></template>
      </button>
    </div>

    <StageTimeline :level="level" />

    <div class="rowf sp">
      <div class="rowf">
        <input v-model="q" placeholder="Tìm mã, nội dung, hướng dẫn" aria-label="Tìm đầu việc" />
        <select v-model="role" aria-label="Lọc theo người xác nhận">
          <option value="">Mọi người xác nhận</option>
          <option v-for="r in VERIFIER_ROLES" :key="r" :value="r">{{ ROLE_SHORT[r] }}</option>
        </select>
        <label class="rowf sm" style="gap: 4px"><input v-model="gppOnly" type="checkbox" /> Chỉ mục GPP</label>
      </div>
      <div class="rowf">
        <button class="btn sm" type="button" @click="collapseAll(true)">Thu gọn tất cả</button>
        <button class="btn sm" type="button" @click="collapseAll(false)">Mở tất cả</button>
      </div>
    </div>
    <div v-if="filtering" class="sm mut">Đang lọc: chỉ hiện đầu việc khớp điều kiện.</div>

    <StageEditor v-for="s in level.stages" :key="s.key" :stage="s" :level="level" :visible="visible" />
    <div v-if="!level.stages.length" class="card empty">
      <h3>Level {{ level.key }} chưa có giai đoạn</h3>
      <div>Bấm "Thêm giai đoạn" để bắt đầu.</div>
    </div>
    <div v-if="d.editable.value"><button class="btn" type="button" @click="newStage">+ Thêm giai đoạn</button></div>

    <datalist id="designer-categories">
      <option v-for="c in d.categories.value" :key="c" :value="c"></option>
    </datalist>
  </div>
</template>
