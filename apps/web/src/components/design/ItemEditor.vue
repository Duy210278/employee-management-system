<script setup lang="ts">
import { addDays, roleShortFor, SESSION_LABEL, VERIFIER_ROLES, type Item, type Stage, type Track } from '@lotrinh/shared';
import { computed, ref, watch } from 'vue';
import { useToast } from '@/composables/toast';
import { useDesigner } from '@/designer/editor';
import { intOf, isChtOwner, moveToStage, moveWithin, removeItem, renameKey, setGpp, type StageOwner } from '@/designer/ops';

/** Một đầu việc trong trình soạn checklist (mục 7.1, 7.3); checklist CHT có thêm buổi, người hỗ trợ, tài liệu hướng dẫn */
const props = defineProps<{ item: Item; index: number; stage: Stage; level: StageOwner }>();
const cht = computed(() => isChtOwner(props.level));
const track = computed<Track>(() => (isChtOwner(props.level) ? props.level.key : 'nvbh'));
/** CHT: người học là CHT nên không chọn CHT làm người xác nhận; Đào tạo đứng đầu */
const verifierRoles = computed(() => (cht.value ? (['bp', 'qlkv', 'buddy'] as const) : VERIFIER_ROLES));
const short = (r: Parameters<typeof roleShortFor>[0]) => roleShortFor(r, track.value);
const d = useDesigner();
const toast = useToast();
const issues = computed(() => d.issuesFor({ itemKey: props.item.key }));
const ro = computed(() => !d.editable.value);
const keyDraft = ref(props.item.key);
watch(
  () => props.item.key,
  (k) => (keyDraft.value = k),
);
const depsText = computed(() => props.item.dependsOn.join(', '));

function toggleVerifier(role: (typeof VERIFIER_ROLES)[number]) {
  const has = props.item.verifiers.includes(role);
  props.item.verifiers = has ? props.item.verifiers.filter((r) => r !== role) : [...props.item.verifiers, role];
}

function commitKey() {
  const next = keyDraft.value.trim();
  if (next === props.item.key) return;
  if (!next) {
    keyDraft.value = props.item.key;
    return;
  }
  renameKey(props.level, props.item.key, next);
  toast.show('Đã đổi mã. Khi gửi duyệt, đổi mã được tính là bỏ mục cũ và thêm mục mới');
}

function setDeps(value: string) {
  props.item.dependsOn = value
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function remove() {
  if (!confirm(`Xóa đầu việc ${props.item.key}?`)) return;
  const detached = removeItem(props.level, props.item.key);
  toast.show(detached ? `Đã xóa ${props.item.key} và gỡ phụ thuộc ở ${detached} mục` : `Đã xóa ${props.item.key}`);
}

/** Ví dụ ngày cụ thể nếu NV bắt đầu Level hôm nay, giúp người soạn hình dung hạn */
const exampleDate = computed(() => {
  const [, m, day] = addDays(d.today.value, props.item.dueOffset).split('-');
  return `${day}/${m}`;
});
</script>

<template>
  <div :id="`it-${item.key}`" class="ie" :class="{ gppRow: item.gpp, flash: d.flashKey.value === item.key, bad: issues.some((i) => i.level === 'error') }">
    <div class="ie-main">
      <div class="ie-cols">
        <label class="f">
          Nội dung cần thực hiện / kiểm tra
          <textarea v-model="item.content" data-field="content" rows="2" :disabled="ro" :aria-label="`Nội dung ${item.key}`"></textarea>
        </label>
        <label class="f">
          Hướng dẫn cho người xác nhận
          <textarea v-model="item.guidance" rows="2" :disabled="ro" :aria-label="`Hướng dẫn ${item.key}`"></textarea>
        </label>
      </div>
      <div class="ie-props">
        <label class="p">
          Mã
          <input v-model="keyDraft" class="mono" data-field="key" size="8" :disabled="ro" @change="commitKey" />
        </label>
        <label class="p">
          Nhóm
          <input v-model="item.category" data-field="category" list="designer-categories" size="12" :disabled="ro" />
        </label>
        <span class="p" data-field="verifiers" tabindex="-1">
          Xác nhận
          <span class="rowf tight">
            <span class="rl nv" :class="{ off: !item.requireNvFirst }" :title="cht ? 'Phần của CHT' : 'Phần nhân viên'">{{ short('nv') }}</span>
            <button
              v-for="r in verifierRoles"
              :key="r"
              type="button"
              class="rl chipbtn"
              :class="[r, { off: !item.verifiers.includes(r) }]"
              :aria-pressed="item.verifiers.includes(r)"
              :disabled="ro"
              @click="toggleVerifier(r)"
            >
              {{ item.verifiers.includes(r) ? '✓ ' : '' }}{{ short(r) }}
            </button>
            <span v-if="!item.verifiers.length && item.requireNvFirst" class="sm mut">Chỉ {{ short('nv') }} tự xác nhận</span>
          </span>
        </span>
        <label
          class="p cb"
          :title="`Bật: ${short('nv')} tự báo hoàn thành, người xác nhận chỉ xác nhận sau ${short('nv')}. Tắt: ${short('nv')} không cần bấm, chỉ người xác nhận đánh dấu.`"
        >
          <input v-model="item.requireNvFirst" type="checkbox" :disabled="ro" /> Có phần {{ short('nv') }} xác nhận
        </label>
        <template v-if="cht">
          <label class="p">
            Buổi
            <select :value="item.session ?? ''" :disabled="ro" @change="item.session = (($event.target as HTMLSelectElement).value || undefined) as Item['session']">
              <option value="">–</option>
              <option v-for="(label, k) in SESSION_LABEL" :key="k" :value="k">{{ label }}</option>
            </select>
          </label>
          <label class="p">
            Người hỗ trợ
            <input :value="item.supporter ?? ''" size="14" placeholder="vd. Đào tạo, QLKV" :disabled="ro" @change="item.supporter = ($event.target as HTMLInputElement).value.trim() || undefined" />
          </label>
          <label class="p">
            Tài liệu
            <input :value="item.link ?? ''" data-field="link" size="18" placeholder="https://…" :disabled="ro" @change="item.link = ($event.target as HTMLInputElement).value.trim() || undefined" />
          </label>
        </template>
        <label class="p">
          Hạn: ngày
          <input :value="item.dueOffset" data-field="dueOffset" type="number" min="0" class="w72" :disabled="ro" @change="item.dueOffset = intOf($event)" />
          <span class="sm mut" :title="'Nếu NV bắt đầu Level hôm nay'">({{ exampleDate }})</span>
        </label>
        <label v-if="!cht" class="p cb" data-field="gpp"><input :checked="item.gpp" type="checkbox" :disabled="ro" @change="setGpp(item, ($event.target as HTMLInputElement).checked)" /> GPP</label>
        <label class="p cb"><input v-model="item.required" type="checkbox" :disabled="ro || item.gpp" /> Bắt buộc</label>
        <label class="p cb"><input v-model="item.allowNa" type="checkbox" :disabled="ro || item.gpp" /> Cho phép N/A</label>
        <!-- Nguồn (LMS/POS) và Bằng chứng đã ẩn: chưa có tích hợp và đính kèm, mọi mục xác nhận tay. Dữ liệu vẫn giữ trong phiên bản -->
        <label class="p">
          Phụ thuộc
          <input :value="depsText" data-field="dependsOn" class="mono" size="12" :placeholder="cht ? `vd. ${(level as { code: string }).code}-1-2` : 'vd. L1-2-9'" :disabled="ro" @change="setDeps(($event.target as HTMLInputElement).value)" />
        </label>
        <label v-if="!ro && level.stages.length > 1" class="p">
          Chuyển tới
          <select :value="stage.key" @change="moveToStage(level, item.key, ($event.target as HTMLSelectElement).value)">
            <option v-for="s in level.stages" :key="s.key" :value="s.key">{{ s.label }}</option>
          </select>
        </label>
      </div>
      <ul v-if="issues.length" class="ie-issues">
        <li v-for="(i, n) in issues" :key="n" :class="i.level">{{ i.code }} · {{ i.message }}</li>
      </ul>
    </div>
    <div v-if="!ro" class="ie-tools">
      <button class="btn sm" type="button" :disabled="index === 0" aria-label="Lên" @click="moveWithin(stage, index, -1)">↑</button>
      <button class="btn sm" type="button" :disabled="index === stage.items.length - 1" aria-label="Xuống" @click="moveWithin(stage, index, 1)">↓</button>
      <button class="btn sm bad" type="button" aria-label="Xóa đầu việc" @click="remove">×</button>
    </div>
  </div>
</template>
