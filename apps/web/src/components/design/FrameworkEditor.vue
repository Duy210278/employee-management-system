<script setup lang="ts">
import { DEFAULT_RUBRIC, reviewFormOf, ROLE_SHORT, TASK_ROLES, type TaskRole } from '@lotrinh/shared';
import { computed } from 'vue';
import { useDesigner } from '@/designer/editor';
import { intOf, numOf, optIntOf } from '@/designer/ops';
import TableEditor from './TableEditor.vue';
import TextListEditor from './TextListEditor.vue';

/** Tab "Khung năng lực" của trình soạn (mục 6.1). Chỉ BP Đào tạo sửa được, trên bản nháp */
const d = useDesigner();
const ro = computed(() => !d.editable.value);
const c = computed(() => d.content.value);
const level = computed(() => c.value.levels.find((l) => l.key === d.levelKey.value)!);
const issuesOf = (section: string, levelKey: number | null) =>
  d.issues.value.filter((i) => i.at.section === section && (i.at.levelKey ?? null) === levelKey);

const SECTIONS = [
  ['info', 'Thông tin Level'],
  ['goals', 'Mục tiêu'],
  ['resp', 'Phân công trách nhiệm'],
  ['kpi', 'Doanh số'],
  ['tasks', 'LMS và tại quầy'],
  ['review', 'Phiếu đánh giá'],
] as const;

function jump(id: string) {
  document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function move<T>(list: T[], i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
}

function toggleSigner(role: TaskRole) {
  const form = level.value.review!;
  form.signers = form.signers.includes(role) ? form.signers.filter((r) => r !== role) : [...form.signers, role];
}

const ensureReview = () => (level.value.review = reviewFormOf(level.value));
const ensureRubric = () => (c.value.rubric = structuredClone(DEFAULT_RUBRIC));
const ensureFramework = () => (c.value.framework = { intro: [], levelTable: [['Level', 'Thời gian', 'Giai đoạn', 'Định nghĩa']], responsibilityTable: [['']], kpiTable: [['Level']] });
</script>

<template>
  <div class="stack">
    <div class="rowf sp">
      <div class="seg self-start" role="tablist" aria-label="Chọn Level">
        <button
          v-for="l in c.levels"
          :key="l.key"
          type="button"
          role="tab"
          :aria-current="d.levelKey.value === l.key"
          :aria-selected="d.levelKey.value === l.key"
          @click="d.levelKey.value = l.key"
        >
          Level {{ l.key }} · {{ l.name || 'chưa đặt tên' }}
        </button>
      </div>
      <div class="rowf sm">
        <button v-for="[k, label] in SECTIONS" :key="k" class="btn sm" type="button" @click="jump(`knl-${level.key}-${k}`)">{{ label }}</button>
        <button class="btn sm" type="button" @click="jump('knl-all-rubric')">Rubric</button>
        <button class="btn sm" type="button" @click="jump('knl-all-framework')">Giới thiệu chung</button>
      </div>
    </div>
    <div class="sm mut">
      Khung năng lực là "luật" của lộ trình. Chỉ BP Đào tạo sửa được, trên bản nháp; thay đổi có hiệu lực khi phiên bản được ban hành. Đổi mô tả, mục tiêu là sửa
      diễn đạt; đổi số ngày, chỉ tiêu, Rubric, phiếu là thay đổi tiêu chí.
    </div>

    <!-- Thông tin Level -->
    <section :id="`knl-${level.key}-info`" class="card pad stack knl" :class="{ flash: d.flashKey.value === `knl-${level.key}-info` }">
      <div class="h2">Thông tin Level {{ level.key }}</div>
      <div class="form">
        <label class="f">Tên gọi<input v-model="level.name" data-field="name" :disabled="ro" /></label>
        <label class="f">Giai đoạn<input v-model="level.phase" :disabled="ro" /></label>
        <label class="f">Khẩu hiệu<input v-model="level.motto" :disabled="ro" /></label>
        <label class="f">Thời lượng hiển thị<input v-model="level.durationLabel" :disabled="ro" placeholder="2 tháng" /></label>
        <label class="f">Khoảng tháng hiển thị<input v-model="level.rangeLabel" :disabled="ro" placeholder="Tháng 1–2" /></label>
        <label class="f">Số tháng<input :value="level.months" type="number" min="1" :disabled="ro" @change="level.months = intOf($event, 1)" /></label>
        <label class="f">
          Số ngày của Level
          <input :value="level.totalDays" data-field="totalDays" type="number" min="1" :disabled="ro" @change="level.totalDays = intOf($event, 1)" />
        </label>
        <label class="f">Tên checklist<input v-model="level.checklistName" :disabled="ro" /></label>
      </div>
      <ul v-if="issuesOf('info', level.key).length" class="ie-issues">
        <li v-for="(i, n) in issuesOf('info', level.key)" :key="n" :class="i.level">{{ i.code }} · {{ i.message }}</li>
      </ul>
    </section>

    <!-- Mục tiêu -->
    <section :id="`knl-${level.key}-goals`" class="card pad stack knl">
      <div class="h2">Mục tiêu Level {{ level.key }}</div>
      <div class="sm mut">Hiện cho nhân viên ở trang Tổng quan Level. Mỗi mục tiêu là hành vi quan sát được.</div>
      <div v-for="(g, i) in level.overview.goals" :key="i" class="goal">
        <span class="tle-no mono">{{ i + 1 }}</span>
        <input v-model="g.title" placeholder="Tiêu đề" :disabled="ro" :aria-label="`Tiêu đề mục tiêu ${i + 1}`" />
        <textarea v-model="g.body" rows="2" placeholder="Mô tả" :disabled="ro" :aria-label="`Mô tả mục tiêu ${i + 1}`"></textarea>
        <template v-if="!ro">
          <button class="btn sm" type="button" :disabled="i === 0" @click="move(level.overview.goals, i, -1)">↑</button>
          <button class="btn sm" type="button" :disabled="i === level.overview.goals.length - 1" @click="move(level.overview.goals, i, 1)">↓</button>
          <button class="btn sm bad" type="button" aria-label="Xóa mục tiêu" @click="level.overview.goals.splice(i, 1)">×</button>
        </template>
      </div>
      <div v-if="!ro"><button class="btn sm" type="button" @click="level.overview.goals.push({ title: '', body: '' })">+ Thêm mục tiêu</button></div>
    </section>

    <!-- Phân công trách nhiệm -->
    <section :id="`knl-${level.key}-resp`" class="card pad stack knl">
      <div class="h2">Phân công trách nhiệm</div>
      <div class="grid g3">
        <div v-for="(r, i) in level.overview.responsibilities" :key="i" class="stack tight">
          <div class="rowf">
            <input v-model="r.heading" class="grow b" :disabled="ro" :aria-label="`Bên ${i + 1}`" />
            <button v-if="!ro" class="btn sm bad" type="button" aria-label="Xóa nhóm" @click="level.overview.responsibilities.splice(i, 1)">×</button>
          </div>
          <TextListEditor :items="r.items" :readonly="ro" add-label="+ Thêm việc" />
        </div>
      </div>
      <div v-if="!ro"><button class="btn sm" type="button" @click="level.overview.responsibilities.push({ heading: '', items: [] })">+ Thêm bên phụ trách</button></div>
    </section>

    <!-- Doanh số -->
    <section :id="`knl-${level.key}-kpi`" class="card pad stack knl" :class="{ flash: d.flashKey.value === `knl-${level.key}-kpi` }">
      <div class="h2">Chỉ tiêu doanh số (triệu đồng/tháng)</div>
      <div class="form">
        <label class="f">DS tổng<input :value="level.kpi.total" data-field="total" inputmode="decimal" :disabled="ro" @change="level.kpi.total = numOf($event)" /></label>
        <label class="f">DS hệ số 1<input :value="level.kpi.coef1" data-field="coef1" inputmode="decimal" :disabled="ro" @change="level.kpi.coef1 = numOf($event)" /></label>
        <label class="f">Tỉ trọng H.số 1 (%)<input :value="level.kpi.ratio" data-field="ratio" inputmode="decimal" :disabled="ro" @change="level.kpi.ratio = numOf($event)" /></label>
        <label class="f">
          Cách xét
          <select v-model="level.kpi.method" :disabled="ro">
            <option :value="undefined">Mặc định ({{ level.key === 1 ? 'mọi tháng đạt' : 'trung bình' }})</option>
            <option value="all_months">Mọi tháng trong cửa sổ đều đạt</option>
            <option value="average">Trung bình các tháng trong cửa sổ</option>
          </select>
        </label>
        <label class="f">Cửa sổ xét từ tháng<input :value="level.kpi.windowFrom ?? ''" data-field="windowFrom" type="number" min="1" :disabled="ro" placeholder="mặc định" @change="level.kpi.windowFrom = optIntOf($event)" /></label>
        <label class="f">đến tháng<input :value="level.kpi.windowTo ?? ''" data-field="windowTo" type="number" min="1" :disabled="ro" placeholder="mặc định" @change="level.kpi.windowTo = optIntOf($event)" /></label>
      </div>
      <ul v-if="issuesOf('kpi', level.key).length" class="ie-issues">
        <li v-for="(i, n) in issuesOf('kpi', level.key)" :key="n" :class="i.level">{{ i.code }} · {{ i.message }}</li>
      </ul>
      <div class="sm mut">Bảng chỉ tiêu hiển thị cho nhân viên (cột ngưỡng cảnh báo, người theo dõi):</div>
      <TableEditor :rows="level.overview.kpiTable" :readonly="ro" />
    </section>

    <!-- LMS và tại quầy -->
    <section :id="`knl-${level.key}-tasks`" class="card pad stack knl">
      <div class="h2">Nhiệm vụ LMS và xác nhận tại quầy</div>
      <div class="grid g2">
        <div class="stack tight">
          <b class="sm">Nhiệm vụ trên LMS (NV tự hoàn thành)</b>
          <TextListEditor :items="level.overview.lms" :readonly="ro" add-label="+ Thêm nhiệm vụ LMS" />
        </div>
        <div class="stack tight">
          <b class="sm">Xác nhận tại quầy (người khác kiểm tra)</b>
          <TextListEditor :items="level.overview.counter" :readonly="ro" add-label="+ Thêm việc kiểm tra" />
        </div>
      </div>
      <label class="f">Lưu ý hiển thị cuối trang Tổng quan<textarea v-model="level.overview.note" rows="2" :disabled="ro"></textarea></label>
    </section>

    <!-- Phiếu đánh giá -->
    <section :id="`knl-${level.key}-review`" class="card pad stack knl" :class="{ flash: d.flashKey.value === `knl-${level.key}-review` }">
      <div class="h2">Phiếu đánh giá tổng kết Level {{ level.key }}</div>
      <div class="sm mut">A. Tiêu chí định lượng</div>
      <div class="tw">
        <table class="te">
          <thead>
            <tr><th>Tiêu chí</th><th>Ngưỡng đạt</th><th>Nguồn dữ liệu</th><th v-if="!ro"></th></tr>
          </thead>
          <tbody>
            <tr v-for="(cr, i) in level.reviewCriteria" :key="i">
              <td><textarea v-model="cr.name" rows="1" :disabled="ro"></textarea></td>
              <td><textarea v-model="cr.threshold" rows="1" :disabled="ro"></textarea></td>
              <td><textarea v-model="cr.source" rows="1" :disabled="ro" placeholder="POS, Rubric, LMS…"></textarea></td>
              <td v-if="!ro"><button class="btn sm bad" type="button" aria-label="Xóa tiêu chí" @click="level.reviewCriteria.splice(i, 1)">×</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="!ro"><button class="btn sm" type="button" @click="level.reviewCriteria.push({ name: '', threshold: '', source: '' })">+ Thêm tiêu chí</button></div>

      <template v-if="level.review">
        <div class="sm mut">B. Nhận xét định tính (số ý tối thiểu: hệ thống đếm số dòng không rỗng)</div>
        <div v-for="(p, i) in level.review.prompts" :key="i" class="goal">
          <input v-model="p.key" class="mono" size="9" :disabled="ro" aria-label="Mã" />
          <textarea v-model="p.text" rows="1" :disabled="ro" aria-label="Câu hỏi nhận xét"></textarea>
          <label class="p">Tối thiểu<input :value="p.minPoints" type="number" min="0" class="w60" :disabled="ro" @change="p.minPoints = intOf($event)" /> ý</label>
          <button v-if="!ro" class="btn sm bad" type="button" aria-label="Xóa" @click="level.review.prompts.splice(i, 1)">×</button>
        </div>
        <div v-if="!ro"><button class="btn sm" type="button" @click="level.review.prompts.push({ key: `p${level.review.prompts.length + 1}`, text: '', minPoints: 0 })">+ Thêm phần nhận xét</button></div>

        <div class="sm mut">C. Kết quả và gia hạn</div>
        <div class="form">
          <label class="f">Tên kết quả "đạt"<input v-model="level.review.passLabel" data-field="passLabel" :disabled="ro" /></label>
          <label class="p cb"><input v-model="level.review.allowFail" type="checkbox" :disabled="ro" /> Có kết quả "Không đạt (đóng lượt)"</label>
          <label class="p cb"><input v-model="level.review.extension.enabled" type="checkbox" :disabled="ro" /> Cho phép gia hạn</label>
        </div>
        <div v-if="level.review.extension.enabled" class="form">
          <label class="f">Mỗi lần gia hạn (tháng)<input :value="level.review.extension.months" type="number" min="1" :disabled="ro" @change="level.review.extension.months = intOf($event, 1)" /></label>
          <label class="f">Số lần tối đa<input :value="level.review.extension.maxTimes" type="number" min="0" :disabled="ro" @change="level.review.extension.maxTimes = intOf($event)" /></label>
          <label class="f">Số mục tiêu tối đa<input :value="level.review.extension.maxGoals" type="number" min="1" :disabled="ro" @change="level.review.extension.maxGoals = intOf($event, 1)" /></label>
        </div>

        <div class="sm mut">D. Chuỗi ký (bấm theo thứ tự ký; bước BP Đào tạo áp dụng kết quả chuyển Level)</div>
        <div class="rowf tight" data-field="signers">
          <button
            v-for="r in TASK_ROLES"
            :key="r"
            type="button"
            class="rl chipbtn"
            :class="[r, { off: !level.review.signers.includes(r) }]"
            :aria-pressed="level.review.signers.includes(r)"
            :disabled="ro"
            @click="toggleSigner(r)"
          >
            {{ level.review.signers.includes(r) ? `${level.review.signers.indexOf(r) + 1}. ` : '' }}{{ ROLE_SHORT[r] }}
          </button>
        </div>
      </template>
      <div v-else class="rowf">
        <span class="sm mut">Phiên bản này chưa có cấu hình phiếu; hệ thống dùng mặc định.</span>
        <button v-if="!ro" class="btn sm" type="button" @click="ensureReview">Tạo cấu hình phiếu từ mặc định</button>
      </div>
      <ul v-if="issuesOf('review', level.key).length" class="ie-issues">
        <li v-for="(i, n) in issuesOf('review', level.key)" :key="n" :class="i.level">{{ i.code }} · {{ i.message }}</li>
      </ul>
    </section>

    <div class="sec">Dùng chung mọi Level</div>

    <!-- Rubric -->
    <section id="knl-all-rubric" class="card pad stack knl" :class="{ flash: d.flashKey.value === 'knl-all-rubric' }">
      <div class="h2">Rubric quan sát tư vấn (Phụ lục C)</div>
      <template v-if="c.rubric">
        <div class="form">
          <label class="f">Thang điểm tối đa<input :value="c.rubric.scaleMax" type="number" min="2" :disabled="ro" @change="c.rubric.scaleMax = intOf($event, 3)" /></label>
          <label class="f">Tổng điểm đạt<input :value="c.rubric.passTotal" data-field="passTotal" type="number" min="1" :disabled="ro" @change="c.rubric.passTotal = intOf($event, 1)" /></label>
          <label class="f">Số ca tối thiểu/tháng<input :value="c.rubric.minObsPerMonth" type="number" min="0" :disabled="ro" @change="c.rubric.minObsPerMonth = intOf($event)" /></label>
          <label class="f">Mục tiêu tỉ lệ ca đạt (%)<input :value="c.rubric.targetRate" type="number" min="0" max="100" :disabled="ro" @change="c.rubric.targetRate = intOf($event)" /></label>
          <label class="p cb"><input v-model="c.rubric.forbidOne" type="checkbox" :disabled="ro" /> Không chấp nhận tiêu chí nào 1 điểm</label>
        </div>
        <div class="tw">
          <table class="te">
            <thead>
              <tr><th>Mã</th><th>Tiêu chí</th><th>Mức 1</th><th>Mức 2</th><th>Mức 3</th><th>Trọng yếu</th><th v-if="!ro"></th></tr>
            </thead>
            <tbody>
              <tr v-for="(cr, i) in c.rubric.criteria" :key="i">
                <td><input v-model="cr.key" class="mono" size="8" :disabled="ro" /></td>
                <td><textarea v-model="cr.name" rows="1" :disabled="ro"></textarea></td>
                <td><textarea v-model="cr.d1" rows="1" :disabled="ro"></textarea></td>
                <td><textarea v-model="cr.d2" rows="1" :disabled="ro"></textarea></td>
                <td><textarea v-model="cr.d3" rows="1" :disabled="ro"></textarea></td>
                <td><input v-model="cr.critical" type="checkbox" :disabled="ro" :aria-label="`${cr.name} trọng yếu`" /></td>
                <td v-if="!ro"><button class="btn sm bad" type="button" aria-label="Xóa tiêu chí" @click="c.rubric.criteria.splice(i, 1)">×</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!ro"><button class="btn sm" type="button" @click="c.rubric.criteria.push({ key: `c${c.rubric.criteria.length + 1}`, name: '', d1: '', d2: '', d3: '', critical: false })">+ Thêm tiêu chí</button></div>
        <div class="sm mut">Điểm các ca đã quan sát lưu theo mã tiêu chí: đổi mã thì ca cũ không còn khớp tiêu chí đó.</div>
      </template>
      <div v-else class="rowf">
        <span class="sm mut">Phiên bản này chưa có Rubric riêng; hệ thống dùng Rubric mặc định theo Phụ lục C.</span>
        <button v-if="!ro" class="btn sm" type="button" @click="ensureRubric">Tạo Rubric từ mặc định</button>
      </div>
      <ul v-if="issuesOf('rubric', null).length" class="ie-issues">
        <li v-for="(i, n) in issuesOf('rubric', null)" :key="n" :class="i.level">{{ i.code }} · {{ i.message }}</li>
      </ul>
    </section>

    <!-- Giới thiệu chung -->
    <section id="knl-all-framework" class="card pad stack knl">
      <div class="h2">Giới thiệu chung (trang Khung năng lực)</div>
      <template v-if="c.framework">
        <b class="sm">Đoạn giới thiệu</b>
        <TextListEditor :items="c.framework.intro" :readonly="ro" add-label="+ Thêm đoạn" />
        <div v-if="!ro" class="sm mut">Đoạn bắt đầu bằng "- " hiện thành gạch đầu dòng.</div>
        <b class="sm">Bảng định nghĩa Level</b>
        <TableEditor :rows="c.framework.levelTable" :readonly="ro" />
        <b class="sm">Bảng trách nhiệm ba bên</b>
        <TableEditor :rows="c.framework.responsibilityTable" :readonly="ro" />
        <b class="sm">Bảng chỉ tiêu doanh số theo Level</b>
        <TableEditor :rows="c.framework.kpiTable" :readonly="ro" />
      </template>
      <div v-else class="rowf">
        <span class="sm mut">Chưa có phần giới thiệu.</span>
        <button v-if="!ro" class="btn sm" type="button" @click="ensureFramework">Tạo phần giới thiệu</button>
      </div>
    </section>
  </div>
</template>
