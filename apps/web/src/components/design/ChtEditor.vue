<script setup lang="ts">
import { DEFAULT_CHT_TRACKS, TRACK_LABEL, type ChtTrackKey, type Item } from '@lotrinh/shared';
import { computed, nextTick, ref, watch } from 'vue';
import { useToast } from '@/composables/toast';
import { useDesigner } from '@/designer/editor';
import { addStage, intOf } from '@/designer/ops';
import StageEditor from './StageEditor.vue';
import TextListEditor from './TextListEditor.vue';

/**
 * Tab "Checklist CHT": checklist làm quen tuần đầu của Cửa hàng trưởng (mới tuyển, thăng tiến từ NVBH).
 * Mỗi ngày D+n là một giai đoạn; thông tin chung, cảm xúc của nhật ký và tiêu chí đánh giá tuần đầu nằm trong cùng checklist.
 */
const d = useDesigner();
const toast = useToast();
const q = ref('');
const ro = computed(() => !d.editable.value);

const tracks = computed(() => d.content.value.chtTracks ?? []);
const track = computed(() => tracks.value.find((t) => t.key === d.chtKey.value) ?? tracks.value[0] ?? null);
const missing = computed(() => DEFAULT_CHT_TRACKS.filter((t) => !tracks.value.some((x) => x.key === t.key)));
const tabs = computed(() =>
  tracks.value.map((t) => ({
    key: t.key,
    name: t.name || TRACK_LABEL[t.key],
    days: t.stages.length,
    items: t.stages.reduce((a, s) => a + s.items.length, 0),
    errors: d.issues.value.filter((i) => i.at.trackKey === t.key && i.level === 'error').length,
  })),
);
// Bản đang xem không có checklist đang chọn thì chuyển sang checklist đầu tiên
watch(
  tracks,
  (list) => {
    if (list.length && !list.some((t) => t.key === d.chtKey.value)) d.chtKey.value = list[0].key;
  },
  { immediate: true },
);

const visible = computed(() => {
  const text = q.value.trim().toLowerCase();
  return (it: Item) => !text || `${it.key} ${it.content} ${it.guidance} ${it.category} ${it.supporter ?? ''}`.toLowerCase().includes(text);
});

/** Thêm checklist CHT từ mẫu trích ở file Excel của BP Đào tạo (docs/nguon/Onboarding_CHT_*.xlsx) */
function addFromTemplate(key: ChtTrackKey) {
  const tpl = DEFAULT_CHT_TRACKS.find((t) => t.key === key)!;
  d.content.value.chtTracks = [...tracks.value, structuredClone(tpl)].sort((a, b) => a.key.localeCompare(b.key));
  d.chtKey.value = key;
  toast.show(`Đã thêm ${tpl.name} từ mẫu. Lưu nháp rồi gửi duyệt để áp dụng`);
}

function removeTrack() {
  const t = track.value;
  if (!t || !confirm(`Bỏ ${t.name} khỏi bản nháp? CHT đang onboarding vẫn theo phiên bản cũ; sau khi ban hành, không gán mới được loại checklist này.`)) return;
  d.content.value.chtTracks = tracks.value.filter((x) => x.key !== t.key);
}

function addRating() {
  const t = track.value!;
  let n = t.ratings.length + 1;
  while (t.ratings.some((r) => r.key === `tieu_chi_${n}`)) n++;
  t.ratings.push({ key: `tieu_chi_${n}`, label: '' });
}

function newDay() {
  const t = track.value!;
  const s = addStage(t);
  void nextTick(() => d.focus({ trackKey: t.key, stageKey: s.key, field: 'name' }));
}
</script>

<template>
  <div class="stack">
    <div v-if="!tracks.length" class="card empty">
      <h3>Bản này chưa có checklist Cửa hàng trưởng</h3>
      <div v-if="!ro">Thêm từ mẫu (trích từ file Excel onboarding CHT của BP Đào tạo) rồi chỉnh sửa, lưu nháp và gửi duyệt.</div>
      <div v-else>Tạo bản nháp từ bản này để thêm checklist CHT.</div>
      <div v-if="!ro" class="rowf center">
        <button v-for="t in missing" :key="t.key" class="btn pri" type="button" @click="addFromTemplate(t.key)">+ Thêm {{ t.name }} từ mẫu</button>
      </div>
    </div>

    <template v-else-if="track">
      <div class="rowf sp">
        <div class="seg self-start" role="tablist" aria-label="Chọn checklist CHT">
          <button
            v-for="t in tabs"
            :key="t.key"
            type="button"
            role="tab"
            :aria-current="track.key === t.key"
            :aria-selected="track.key === t.key"
            @click="d.chtKey.value = t.key"
          >
            {{ t.name }} · {{ t.days }} ngày · {{ t.items }} mục<template v-if="t.errors"> · <span class="bad-text">{{ t.errors }} lỗi</span></template>
          </button>
        </div>
        <div v-if="!ro && missing.length" class="rowf">
          <button v-for="t in missing" :key="t.key" class="btn sm" type="button" @click="addFromTemplate(t.key)">+ Thêm {{ t.name }} từ mẫu</button>
        </div>
      </div>

      <section :id="`cht-${track.key}-info`" class="card pad stack" :class="{ flash: d.flashKey.value === `cht-${track.key}-info` }">
        <div class="rowf sp">
          <div class="h2">Thông tin checklist · {{ TRACK_LABEL[track.key] }}</div>
          <span class="sm mut">Tiền tố mã đầu việc <b class="mono">{{ track.code }}</b></span>
        </div>
        <div class="form">
          <label class="f">Tên ngắn<input v-model="track.name" data-field="name" :disabled="ro" /></label>
          <label class="f">Tiêu đề checklist<input v-model="track.title" data-field="title" :disabled="ro" /></label>
          <label class="f">
            Số ngày onboarding
            <input :value="track.totalDays" data-field="totalDays" type="number" min="1" :disabled="ro" @change="track.totalDays = Math.max(1, intOf($event, track.totalDays))" />
          </label>
        </div>
        <label class="f">Mục tiêu tuần đầu<textarea v-model="track.goal" data-field="goal" rows="2" :disabled="ro"></textarea></label>
        <label class="f">Mẹo / lưu ý chính<textarea v-model="track.tip" data-field="tip" rows="2" :disabled="ro"></textarea></label>
        <div class="f">
          <span>{{ track.key === 'cht_thang_tien' ? 'Điểm khác biệt so với CHT mới tuyển' : 'Lưu ý' }}</span>
          <TextListEditor :items="track.notes" :readonly="ro" add-label="+ Thêm lưu ý" />
        </div>
        <div class="form">
          <div class="f" data-field="moods" tabindex="-1">
            <span>Lựa chọn "Cảm xúc CHT" (nhật ký theo dõi)</span>
            <TextListEditor :items="track.moods" :readonly="ro" placeholder="vd. 😊 Tự tin" add-label="+ Thêm cảm xúc" />
          </div>
          <div class="f" data-field="ratings" tabindex="-1">
            <span>Tiêu chí đánh giá tuần đầu (chấm 1–5 sao)</span>
            <div class="tle">
              <div v-for="(r, i) in track.ratings" :key="i" class="tle-row">
                <span class="tle-no mono">{{ i + 1 }}</span>
                <input v-model="r.label" class="grow" placeholder="Tên tiêu chí" :disabled="ro" :aria-label="`Tiêu chí ${i + 1}`" />
                <input v-model="r.key" class="mono" size="14" placeholder="ma_tieu_chi" :disabled="ro" :aria-label="`Mã tiêu chí ${i + 1}`" />
                <button v-if="!ro" class="btn sm bad" type="button" aria-label="Xóa tiêu chí" @click="track.ratings.splice(i, 1)">×</button>
              </div>
              <div v-if="!track.ratings.length" class="sm mut">Chưa có tiêu chí.</div>
              <div v-if="!ro"><button class="btn sm" type="button" @click="addRating">+ Thêm tiêu chí</button></div>
            </div>
          </div>
        </div>
        <div v-if="!ro" class="rowf sp">
          <span class="sm mut">Đổi tiêu chí hoặc số ngày là thay đổi tiêu chí (lên số phiên bản); sửa câu chữ là thay đổi diễn đạt.</span>
          <button class="btn sm bad" type="button" @click="removeTrack">Bỏ checklist này khỏi bản nháp</button>
        </div>
      </section>

      <div class="rowf sp">
        <input v-model="q" placeholder="Tìm mã, nội dung, người hỗ trợ" aria-label="Tìm đầu việc CHT" />
        <span class="sm mut">Việc của Đào tạo giao cho người phụ trách Đào tạo của từng CHT; việc của QLKV giao cho QLKV phụ trách.</span>
      </div>
      <div v-if="q.trim()" class="sm mut">Đang lọc: chỉ hiện đầu việc khớp điều kiện.</div>

      <StageEditor v-for="s in track.stages" :key="s.key" :stage="s" :level="track" :visible="visible" />
      <div v-if="!track.stages.length" class="card empty">
        <h3>{{ track.name }} chưa có ngày nào</h3>
        <div>Bấm "Thêm ngày" để bắt đầu.</div>
      </div>
      <div v-if="!ro"><button class="btn" type="button" @click="newDay">+ Thêm ngày</button></div>
    </template>

    <datalist id="designer-categories">
      <option v-for="c in d.categories.value" :key="c" :value="c"></option>
    </datalist>
  </div>
</template>
