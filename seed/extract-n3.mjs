// Trích bộ lộ trình v2.1 từ giao diện tham chiếu N3 (docs/nguon/Checklist_onboarding_UI.html)
// thành seed/v2.1.json theo VersionContentSchema (packages/shared/src/schemas/version.ts).
// Chạy: pnpm seed:extract
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(here, '../docs/nguon/Checklist_onboarding_UI.html');
const outPath = path.resolve(here, 'v2.1.json');

const html = fs.readFileSync(sourcePath, 'utf8');
function grabConst(name) {
  const line = html.split('\n').find((l) => l.startsWith(`const ${name}=`));
  if (!line) throw new Error(`Không tìm thấy const ${name} trong N3`);
  return JSON.parse(line.slice(`const ${name}=`.length).replace(/;\s*$/, ''));
}
const LEVELS = grabConst('LEVELS');
const OV = grabConst('OV');

// Sửa nội dung theo giả định mặc định mục 16 tài liệu thiết kế
const CONTENT_FIXES = {
  'L1-6-3': [/Tháng 3/g, 'Tháng 2', 'V1: Level 1 dài 60 ngày nên không có Tháng 3'],
  'L1-6-4': [/Tháng 3/g, 'Tháng 2', 'V1: Level 1 dài 60 ngày nên không có Tháng 3'],
  'L4-1-7': [/SKU Level 3/g, 'SKU Level 4', 'V12: nội dung sai Level'],
};
const fixLog = [];

// Người xác nhận theo hàm ver() của N3: "co" (phối hợp) L1 = Buddy + CHT, L2–L4 = CHT + QLKV;
// "nv" (NV tự làm) = NV tự xác nhận, không có người kiểm tra (mục 7.2)
function verifiersOf(w, lv) {
  if (w === 'co') return lv === 1 ? ['buddy', 'cht'] : ['cht', 'qlkv'];
  if (w === 'nv') return [];
  return [w];
}

// Người xác nhận theo Checklist Onboarding v2.1 (N2) ở những mục N3 ghi khác
const VERIFIER_FIXES = {
  'L1-1-1': [[], 'N2 để trống ô người xác nhận: NV tự xác nhận'],
};

function parseStageName(raw) {
  const m = raw.match(/^(.*?)\s+—\s+(.*)$/);
  let label = m ? m[1] : raw;
  let name = m ? m[2] : raw;
  let shiftFrom, shiftTo;
  const shift = name.match(/\s*\(Ca\s*(\d+)\s*[–-]\s*(\d+)\)\s*$/);
  if (shift) {
    shiftFrom = Number(shift[1]);
    shiftTo = Number(shift[2]);
    name = name.slice(0, shift.index).trim();
  }
  label = label.replace('TUẦN', 'Tuần').replace('THÁNG', 'Tháng').replace('QUÝ', 'Quý');
  return { label, name, shiftFrom, shiftTo };
}

function normalizeCategory(g) {
  return g.startsWith('GPP') ? 'GPP' : g;
}

function cleanNote(note) {
  if (!note) return undefined;
  return note.replace(/^⚑\s*(LƯU Ý QUAN TRỌNG|LƯU Ý)\s*\/?\s*/, '').trim();
}

const levels = LEVELS.map((l) => {
  const ov = OV.lv[String(l.lv)];
  return {
    key: l.lv,
    name: l.name,
    phase: l.phase,
    motto: l.motto,
    durationLabel: l.dur,
    rangeLabel: l.range,
    months: l.months,
    totalDays: l.days,
    checklistName: l.lv === 1 ? 'Buddy Checklist' : 'CHT Checklist',
    // R15 (hàm kpiResult của N3): L1 mọi tháng 1–2 phải đạt; L2–L4 trung bình 2 tháng cuối Level
    kpi: {
      total: l.kpi.tot,
      coef1: l.kpi.hs1,
      ratio: l.kpi.pct,
      method: l.lv === 1 ? 'all_months' : 'average',
      windowFrom: l.lv === 1 ? 1 : l.months - 1,
      windowTo: l.months,
    },
    overview: {
      goals: ov.goals.map(([title, body]) => ({ title: title ?? '', body })),
      kpiTable: ov.kpi,
      responsibilities: ov.resp.map((r) => ({ heading: r.h, items: r.items })),
      lms: ov.lms ?? [],
      counter: ov.counter ?? [],
      note: cleanNote(ov.note),
    },
    reviewCriteria: (l.crit ?? []).map((c) => ({ name: c.n, threshold: c.th, source: c.src })),
    // Phiếu đánh giá theo promoTab của N3; chuỗi ký theo V7, gia hạn theo V14
    review: {
      flow: 'Buddy hoặc CHT điền. CHT ký đề xuất, QLKV phê duyệt, BP Đào tạo xác nhận và lưu hồ sơ, nhân viên ký đã nhận kết quả.',
      when: 'Từ khi mở giai đoạn cuối của Level',
      prompts: [
        { key: 'strengths', text: 'Điểm mạnh nổi bật (≥ 2 điểm cụ thể, kèm ví dụ)', minPoints: 2 },
        { key: 'improve', text: 'Điểm cần phát triển (≥ 2 điểm, không chung chung)', minPoints: 2 },
        { key: 'potential', text: `Tiềm năng phù hợp vai trò nào trong tương lai${l.lv >= 2 ? ' · năng lực dẫn dắt, huấn luyện người khác' : ''}`, minPoints: 0 },
      ],
      passLabel: l.lv < 4 ? `Đủ điều kiện lên Level ${l.lv + 1}` : 'Đạt chuẩn Level 4',
      allowFail: true,
      extension: { enabled: true, months: 1, maxTimes: 2, maxGoals: 3 },
      signers: ['cht', 'qlkv', 'bp', 'nv'],
    },
    stages: l.stages.map((s, si) => {
      const { label, name, shiftFrom, shiftTo } = parseStageName(s.n);
      return {
        key: `L${l.lv}-S${si + 1}`,
        order: si + 1,
        name,
        label,
        offsetStart: s.a,
        offsetEnd: s.b,
        ...(shiftFrom ? { shiftFrom, shiftTo } : {}),
        goal: s.goal ?? '',
        signers: ['cht'],
        items: s.items.map((it, ii) => {
          let content = it.t;
          const fix = CONTENT_FIXES[it.k];
          if (fix) {
            const fixed = content.replace(fix[0], fix[1]);
            if (fixed !== content) fixLog.push(`${it.k}: ${fix[2]}`);
            content = fixed;
          }
          const category = normalizeCategory(it.g);
          const verifierFix = VERIFIER_FIXES[it.k];
          if (verifierFix) fixLog.push(`${it.k}: ${verifierFix[1]}`);
          return {
            key: it.k,
            order: ii + 1,
            category,
            content,
            guidance: it.h ?? '',
            verifiers: verifierFix ? verifierFix[0] : verifiersOf(it.w, l.lv),
            requireNvFirst: true,
            dueOffset: it.d,
            gpp: !!it.gpp,
            required: true,
            allowNa: !it.gpp,
            dataSource: category === 'LMS' ? 'lms' : 'manual',
            evidence: 'none',
            dependsOn: [],
          };
        }),
      };
    }),
  };
});

const content = {
  levels,
  scheduleParams: {
    remindDays: 3,
    escalateDays: 7,
    signOpenBefore: 3,
    signDueAfter: 3,
    posDataDay: 5,
    exemptFromDay: 15,
    upcomingDays: 14,
    graceDays: 14,
    shiftsPerWeek: 6,
  },
  // Rubric đánh giá tư vấn tại quầy: Phụ lục C của Khung năng lực (N1, docs/nguon/Khung_Nang_Luc_Upharma_v2.1.docx)
  rubric: {
    scaleMax: 3,
    passTotal: 10,
    forbidOne: true,
    minObsPerMonth: 3,
    targetRate: 80,
    criteria: [
      { key: 'needs', name: 'Khai thác nhu cầu', d1: 'Không hỏi hoặc hỏi sai', d2: 'Hỏi đủ 3–4 câu cơ bản', d3: 'Hỏi sâu, phát hiện nhu cầu tiềm ẩn', critical: false },
      { key: 'advice', name: 'Tư vấn sản phẩm', d1: 'Tư vấn sai hoặc không đủ thông tin', d2: 'Đúng sản phẩm, công dụng cơ bản', d3: 'Đúng + cá nhân hoá cho đối tượng khách', critical: false },
      { key: 'safety', name: 'An toàn thuốc', d1: 'Bỏ qua cảnh báo quan trọng', d2: 'Đề cập cảnh báo', d3: 'Chủ động cảnh báo phù hợp', critical: true },
      { key: 'upsell', name: 'Upsell / Cross-sell', d1: 'Không đề xuất khi có cơ hội rõ', d2: 'Đề xuất nhưng chưa có lý do thuyết phục', d3: 'Đề xuất tự nhiên, có lý do rõ ràng', critical: false },
      { key: 'closing', name: 'Kết thúc giao dịch', d1: 'Không dặn dò', d2: 'Dặn dò cơ bản', d3: 'Dặn dò đầy đủ, mời quay lại', critical: false },
    ],
  },
  framework: {
    intro: OV.sys.goals,
    levelTable: OV.sys.levels,
    responsibilityTable: OV.sys.resp,
    kpiTable: OV.sys.kpi,
  },
};

fs.writeFileSync(outPath, JSON.stringify(content, null, 2) + '\n');
const stageCount = levels.reduce((a, l) => a + l.stages.length, 0);
const itemCount = levels.reduce((a, l) => a + l.stages.reduce((b, s) => b + s.items.length, 0), 0);
console.log(`Đã ghi ${path.relative(process.cwd(), outPath)}: ${levels.length} Level, ${stageCount} giai đoạn, ${itemCount} đầu việc`);
for (const line of fixLog) console.log(`  Sửa ${line}`);
