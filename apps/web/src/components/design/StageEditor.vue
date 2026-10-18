<script setup lang="ts">
import { ROLE_SHORT, TASK_ROLES, type Item, type Level, type Stage, type TaskRole } from '@lotrinh/shared';
import { computed, nextTick } from 'vue';
import { useToast } from '@/composables/toast';
import { useDesigner } from '@/designer/editor';
import { addItem, intOf, optIntOf, removeStage, spreadDue } from '@/designer/ops';
import ItemEditor from './ItemEditor.vue';

/** Thẻ giai đoạn trong trình soạn (mục 7.3): thông tin giai đoạn, chuỗi ký, các đầu việc */
const props = defineProps<{ stage: Stage; level: Level; visible: (item: Item) => boolean }>();
const d = useDesigner();
const toast = useToast();
const ro = computed(() => !d.editable.value);
const open = computed(() => !d.collapsed.has(props.stage.key));
const issues = computed(() => d.issuesFor({ stageKey: props.stage.key }));
const shown = computed(() => props.stage.items.map((it, index) => ({ it, index })).filter(({ it }) => props.visible(it)));
const gppCount = computed(() => props.stage.items.filter((i) => i.gpp).length);

function toggle() {
  if (open.value) d.collapsed.add(props.stage.key);
  else d.collapsed.delete(props.stage.key);
}

function toggleSigner(role: TaskRole) {
  const s = props.stage.signers;
  props.stage.signers = s.includes(role) ? s.filter((r) => r !== role) : [...s, role];
}

function add() {
  const it = addItem(props.level, props.stage);
  void nextTick(() => d.focus({ levelKey: props.level.key, stageKey: props.stage.key, itemKey: it.key, field: 'content' }));
}

function spread() {
  if (!confirm(`Chia đều lại hạn của ${props.stage.items.length} đầu việc trong ${props.stage.label}?`)) return;
  spreadDue(props.stage);
  toast.show('Đã chia đều hạn theo thứ tự trong giai đoạn');
}

function remove() {
  if (!removeStage(props.level, props.stage.key)) toast.show('Chỉ xóa được giai đoạn không còn đầu việc. Chuyển hoặc xóa các đầu việc trước');
}
</script>

<template>
  <section :id="`st-${stage.key}`" class="card se" :class="{ flash: d.flashKey.value === stage.key }">
    <header class="se-head">
      <button class="btn sm" type="button" :aria-expanded="open" :aria-label="open ? 'Thu gọn' : 'Mở'" @click="toggle">{{ open ? '▾' : '▸' }}</button>
      <span class="se-no">{{ stage.order }}</span>
      <input v-model="stage.label" class="se-label" data-field="label" :disabled="ro" aria-label="Nhãn thời gian" />
      <input v-model="stage.name" class="grow" data-field="name" placeholder="Tên giai đoạn" :disabled="ro" aria-label="Tên giai đoạn" />
      <span class="sm mut">{{ stage.items.length }} mục<template v-if="gppCount"> · {{ gppCount }} GPP</template></span>
      <button v-if="!ro" class="btn sm bad" type="button" aria-label="Xóa giai đoạn" :disabled="stage.items.length > 0" :title="stage.items.length ? 'Còn đầu việc, không xóa được' : ''" @click="remove">×</button>
    </header>
    <div v-if="open" class="se-body">
      <div class="se-meta">
        <label class="p">
          Ngày
          <input :value="stage.offsetStart" data-field="offsetStart" type="number" min="0" style="width: 70px" :disabled="ro" aria-label="Từ ngày" @change="stage.offsetStart = intOf($event)" />
          –
          <input :value="stage.offsetEnd" data-field="offsetEnd" type="number" min="1" style="width: 70px" :disabled="ro" aria-label="Đến ngày" @change="stage.offsetEnd = intOf($event)" />
        </label>
        <label class="p">
          Ca tham khảo
          <input :value="stage.shiftFrom ?? ''" type="number" min="1" style="width: 60px" :disabled="ro" aria-label="Từ ca" @change="stage.shiftFrom = optIntOf($event)" />
          –
          <input :value="stage.shiftTo ?? ''" type="number" min="1" style="width: 60px" :disabled="ro" aria-label="Đến ca" @change="stage.shiftTo = optIntOf($event)" />
        </label>
        <span class="p" data-field="signers" tabindex="-1">
          Ký cuối giai đoạn
          <span class="rowf" style="gap: 4px">
            <button
              v-for="r in TASK_ROLES"
              :key="r"
              type="button"
              class="rl chipbtn"
              :class="[r, { off: !stage.signers.includes(r) }]"
              :aria-pressed="stage.signers.includes(r)"
              :disabled="ro"
              @click="toggleSigner(r)"
            >
              {{ stage.signers.includes(r) ? `${stage.signers.indexOf(r) + 1}. ` : '' }}{{ ROLE_SHORT[r] }}
            </button>
          </span>
        </span>
      </div>
      <label class="f">
        Mục tiêu giai đoạn
        <textarea v-model="stage.goal" rows="2" :disabled="ro"></textarea>
      </label>
      <ul v-if="issues.length" class="ie-issues">
        <li v-for="(i, n) in issues" :key="n" :class="i.level">{{ i.code }} · {{ i.message }}</li>
      </ul>

      <ItemEditor v-for="{ it, index } in shown" :key="it.key" :item="it" :index="index" :stage="stage" :level="level" />
      <div v-if="!shown.length" class="sm mut" style="padding: 8px 0">
        {{ stage.items.length ? 'Không có đầu việc khớp bộ lọc trong giai đoạn này.' : 'Giai đoạn chưa có đầu việc.' }}
      </div>
      <div v-if="!ro" class="rowf">
        <button class="btn sm pri" type="button" @click="add">+ Thêm đầu việc vào giai đoạn này</button>
        <button v-if="stage.items.length > 1" class="btn sm" type="button" @click="spread">Chia đều hạn</button>
      </div>
    </div>
  </section>
</template>
