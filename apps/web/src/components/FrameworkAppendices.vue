<script setup lang="ts">
import type { Rubric } from '@lotrinh/shared';
import { computed } from 'vue';
import GppModules from './GppModules.vue';
import Icon from './Icon.vue';
import SkuAppendix from './SkuAppendix.vue';

/**
 * Phụ lục A–F của Khung năng lực N1 (docs/nguon/Khung_Nang_Luc_Upharma_v2.1.docx), mỗi phụ lục một khối bấm để mở rộng.
 * C lấy từ Rubric của phiên bản đang hiệu lực; A, B, D, E, F là nội dung tĩnh chép nguyên văn từ N1.
 */
const props = defineProps<{ rubric: Rubric }>();

const BUDDY_QUESTIONS: { text: string; weight: number }[] = [
  { text: 'Buddy/CHT đã giải thích rõ từng mục trong checklist cho tôi', weight: 20 },
  { text: 'Tôi được phản hồi kịp thời khi làm sai, không bị để sang ngày hôm sau', weight: 25 },
  { text: 'Buddy/CHT kiên nhẫn và không làm tôi cảm thấy phán xét khi hỏi', weight: 20 },
  { text: 'Buddy/CHT biết sản phẩm đủ tốt để giải đáp thắc mắc của tôi', weight: 20 },
  { text: 'Tôi cảm thấy tự tin hơn nhờ sự hướng dẫn trong 30 ngày đầu', weight: 15 },
];

const CAREER_PATHS: { name: string; condition: string; reward: string }[] = [
  {
    name: 'Chuyên gia sản phẩm (Product Expert)',
    condition: 'Trở thành tham chiếu kỹ năng tư vấn sản phẩm cho chuỗi. Đóng góp vào cập nhật danh mục SKU và tài liệu đào tạo.',
    reward: 'Chứng nhận Product Expert nội bộ. Phụ cấp chuyên môn. Được mời tham gia các dự án danh mục sản phẩm.',
  },
  {
    name: 'Đào tạo viên nội bộ (Internal Trainer)',
    condition: 'Đồng tác giả ≥ 2 module. Dẫn dắt ≥ 3 NV Level 1–2 thành công.',
    reward: 'Chứng nhận Trainer nội bộ. Phụ cấp đào tạo khi dẫn lớp. Ưu tiên xét tuyển vào BP Đào tạo khi có vị trí.',
  },
  {
    name: 'Cửa hàng trưởng (Store Manager)',
    condition: 'Đạt đánh giá 360° tích cực. Được QLKV đề xuất dựa trên tiềm năng lãnh đạo.',
    reward: 'Lộ trình thăng tiến chính thức với timeline cụ thể. Điều chỉnh thu nhập theo chức danh. Ưu tiên khi có vị trí CHT mở.',
  },
];

const ROLLOUT_STEPS: { title: string; body: string }[] = [
  {
    title: 'Họp thống nhất phân công (tuần 1)',
    body: 'Trình bày tài liệu với toàn bộ CHT và QLKV. Xác nhận ai là Buddy, ai theo dõi LMS, ai kiểm tra checklist.',
  },
  { title: 'Upload checklist (tuần 1–2)', body: '' },
  {
    title: 'Chạy thí điểm 1 cửa hàng (tháng 1)',
    body: 'Chọn 1 cửa hàng có nhân viên mới để thí điểm. Rút kinh nghiệm trước khi mở rộng toàn chuỗi.',
  },
];

const WARNING_SIGNS: { sign: string; action: string }[] = [
  { sign: 'Checklist tuần 2 chưa hoàn thành không có lý do', action: 'Khu vực liên hệ nhà thuốc trong 24h' },
  {
    sign: 'Module GPP cơ bản chưa hoàn thành sau 30 ngày làm việc',
    action: 'Nhân viên không được tiếp xúc khách hàng độc lập — BP Đào tạo thông báo CHT ngay',
  },
  { sign: 'Nhân viên không đăng nhập LMS sau 5 ngày', action: 'BP Đào tạo gửi nhắc tự động' },
  { sign: 'Buddy thay đổi mà chưa có người thay thế', action: 'Khu vực xác nhận Buddy mới trong 48h' },
  { sign: 'Tỉ lệ hoàn thành Level thấp hơn mục tiêu 2 quý liên tiếp', action: 'Họp review ba bên để điều chỉnh' },
];

type Key = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

const appendices = computed<{ key: Key; title: string; desc: string }[]>(() => [
  { key: 'A', title: 'Danh sách SKU theo Level', desc: 'Nhóm SKU phải nắm theo từng Level: 55 · 98 · 66 · 27 SKU' },
  { key: 'B', title: 'Module GPP tối thiểu (bắt buộc — Bộ Y tế)', desc: '6 module GPP, chia theo Level' },
  {
    key: 'C',
    title: 'Rubric đánh giá tư vấn tại quầy',
    desc: `${props.rubric.criteria.length} tiêu chí, thang 1–${props.rubric.scaleMax} điểm, dùng chung mọi Level`,
  },
  { key: 'D', title: 'Buddy Performance Score', desc: 'NV mới đánh giá ngược Buddy/CHT sau 30 ngày' },
  { key: 'E', title: 'Career Path Map — Sau Level 4', desc: 'Ba hướng phát triển: Chuyên gia sản phẩm, Đào tạo viên nội bộ, Cửa hàng trưởng' },
  { key: 'F', title: 'Hướng dẫn triển khai', desc: 'Ba bước khởi động, dấu hiệu cần can thiệp sớm, cập nhật tài liệu' },
]);
</script>

<template>
  <div class="sec">Phụ lục — Các tài liệu bắt buộc kèm theo</div>
  <details v-for="a in appendices" :key="a.key" class="card clip">
    <summary class="stage-head">
      <span class="stage-no" aria-hidden="true">{{ a.key }}</span>
      <div class="stage-main">
        <b>Phụ lục {{ a.key }}. {{ a.title }}</b>
        <div class="sm mut">{{ a.desc }}</div>
      </div>
      <Icon class="caret" name="chevron" />
    </summary>

    <div class="pad stack">
      <SkuAppendix v-if="a.key === 'A'" bare />

      <GppModules v-else-if="a.key === 'B'" bare />

      <template v-else-if="a.key === 'C'">
        <div class="sm mut">
          Ca đạt khi tổng ≥ {{ rubric.passTotal }}/{{ rubric.criteria.length * rubric.scaleMax }}<template v-if="rubric.forbidOne"> và không tiêu chí nào 1 điểm</template>.
          Tối thiểu {{ rubric.minObsPerMonth }} ca/tháng, mục tiêu {{ rubric.targetRate }}% ca đạt.
        </div>
        <div class="tw">
          <table>
            <thead>
              <tr><th>Tiêu chí</th><th>1 điểm</th><th>2 điểm</th><th>3 điểm</th></tr>
            </thead>
            <tbody>
              <tr v-for="c in rubric.criteria" :key="c.key">
                <td><b>{{ c.name }}</b> <span v-if="c.critical" class="pill bad">Trọng yếu</span></td>
                <td class="sm">{{ c.d1 }}</td>
                <td class="sm">{{ c.d2 }}</td>
                <td class="sm">{{ c.d3 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else-if="a.key === 'D'">
        <div>Nhân viên mới đánh giá ngược người hướng dẫn (Buddy/CHT Level 3) sau 30 ngày làm việc. Kết quả được đưa vào KPI của người hướng dẫn.</div>
        <div class="tw">
          <table>
            <thead>
              <tr><th>Câu hỏi đánh giá (NV mới trả lời 1–5)</th><th>Trọng số</th></tr>
            </thead>
            <tbody>
              <tr v-for="q in BUDDY_QUESTIONS" :key="q.text"><td>{{ q.text }}</td><td class="nowrap">{{ q.weight }}%</td></tr>
            </tbody>
          </table>
        </div>
        <div class="sm mut">Ngưỡng đạt: điểm trung bình ≥ 3.5/5. Nếu &lt; 3.0: họp ba bên CHT + Buddy + BP Đào tạo để xác định nguyên nhân.</div>
      </template>

      <template v-else-if="a.key === 'E'">
        <div>Nhân viên Level 4 có thể phát triển theo 3 hướng chính, không ép buộc — tôn trọng lựa chọn cá nhân:</div>
        <div class="tw">
          <table>
            <thead>
              <tr><th>Hướng phát triển</th><th>Mô tả &amp; Điều kiện</th><th>Đãi ngộ &amp; Ghi nhận gắn kèm</th></tr>
            </thead>
            <tbody>
              <tr v-for="p in CAREER_PATHS" :key="p.name"><td><b>{{ p.name }}</b></td><td class="sm">{{ p.condition }}</td><td class="sm">{{ p.reward }}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="alert info">
          <div>
            <b>⚑ NGUYÊN TẮC:</b> Level 3 là đích đến có giá trị độc lập — nhân viên không cần lên Level 4 để được ghi nhận. Hệ thống phải có phần
            thưởng/ghi nhận rõ ràng cho NV dừng ổn định tại Level 3 hoặc Level 4.
          </div>
        </div>
      </template>

      <template v-else-if="a.key === 'F'">
        <div class="b">F.1 Ba bước khởi động</div>
        <ol class="ul ol">
          <li v-for="s in ROLLOUT_STEPS" :key="s.title"><b>{{ s.title }}</b><template v-if="s.body">: {{ s.body }}</template></li>
        </ol>
        <div class="b">F.2 Dấu hiệu cảnh báo cần can thiệp sớm</div>
        <div class="tw">
          <table>
            <thead>
              <tr><th>Dấu hiệu</th><th>Hành động</th></tr>
            </thead>
            <tbody>
              <tr v-for="w in WARNING_SIGNS" :key="w.sign"><td>{{ w.sign }}</td><td class="sm">{{ w.action }}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="b">F.3 Cập nhật tài liệu</div>
        <div>
          Tài liệu này được xem xét và cập nhật 6 tháng/lần hoặc khi có thay đổi lớn về danh mục sản phẩm, quy định GPP, quy trình vận hành, hoặc cơ cấu tổ
          chức. Đơn vị chịu trách nhiệm: BP Đào tạo phối hợp với Khu vực.
        </div>
      </template>
    </div>
  </details>
</template>
