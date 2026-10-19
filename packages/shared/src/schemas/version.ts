import { z } from 'zod';
import { TASK_ROLES } from '../roles';

/**
 * Nội dung một phiên bản Bộ lộ trình (mục 7.1, 13.2), lưu thành một tài liệu JSONB; bản đã ban hành là bất biến (R03).
 * Mốc thời gian là số ngày tính từ ngày bắt đầu Level.
 *
 * Schema chỉ kiểm tra cấu trúc và kiểu để bản nháp đang soạn dở vẫn lưu được.
 * Quy tắc nghiệp vụ (CK-01..CK-11) nằm ở validation/checklist.ts và chặn gửi duyệt, ban hành.
 */

const taskRole = z.enum(TASK_ROLES);
export const VERIFIER_ROLES = ['buddy', 'cht', 'qlkv', 'bp'] as const;
const verifierRole = taskRole.exclude(['nv']);

export const ItemSchema = z.object({
  /** Mã cố định qua các phiên bản, dạng L{level}-{giai đoạn}-{thứ tự} */
  key: z.string(),
  order: z.number().int(),
  category: z.string(),
  content: z.string(),
  guidance: z.string().default(''),
  /** Vai trò phải xác nhận ngoài phần NV (mục 7.2) */
  verifiers: z.array(verifierRole),
  /** NV phải báo hoàn thành trước khi người khác xác nhận */
  requireNvFirst: z.boolean().default(true),
  dueOffset: z.number().int().min(0),
  gpp: z.boolean().default(false),
  required: z.boolean().default(true),
  allowNa: z.boolean().default(true),
  dataSource: z.enum(['manual', 'lms', 'pos']).default('manual'),
  evidence: z.enum(['none', 'score', 'note', 'file']).default('none'),
  dependsOn: z.array(z.string()).default([]),
  sourceRef: z.string().optional(),
  /** Checklist CHT: buổi trong ngày */
  session: z.enum(['sang', 'chieu', 'cuoi_ngay']).optional(),
  /** Checklist CHT: người hỗ trợ tại chỗ (chữ tự do: HR, NV kỳ cựu, QLKV…); người xác nhận vẫn là verifiers */
  supporter: z.string().optional(),
  /** Link tài liệu hướng dẫn */
  link: z.string().optional(),
});

export const SESSION_LABEL: Record<NonNullable<z.infer<typeof ItemSchema>['session']>, string> = {
  sang: 'Sáng',
  chieu: 'Chiều',
  cuoi_ngay: 'Cuối ngày',
};

export const StageSchema = z.object({
  key: z.string(),
  order: z.number().int(),
  name: z.string(),
  /** Nhãn hiển thị: Tuần 1, Tháng 4–6, Quý 1… */
  label: z.string(),
  offsetStart: z.number().int(),
  offsetEnd: z.number().int(),
  shiftFrom: z.number().int().positive().optional(),
  shiftTo: z.number().int().positive().optional(),
  goal: z.string().default(''),
  /** Chuỗi ký cuối giai đoạn theo thứ tự */
  signers: z.array(taskRole).default(['cht']),
  items: z.array(ItemSchema),
});

export const LevelOverviewSchema = z.object({
  goals: z.array(z.object({ title: z.string(), body: z.string() })),
  kpiTable: z.array(z.array(z.string())),
  responsibilities: z.array(z.object({ heading: z.string(), items: z.array(z.string()) })),
  lms: z.array(z.string()),
  counter: z.array(z.string()),
  note: z.string().optional(),
});

/** Chỉ tiêu doanh số của Level (mục 6.1, R15). Đơn vị: triệu đồng */
export const KpiSchema = z.object({
  total: z.number(),
  coef1: z.number(),
  /** Tỉ trọng H.số 1 mục tiêu (%) */
  ratio: z.number(),
  /** all_months: mọi tháng trong cửa sổ phải đạt · average: trung bình các tháng trong cửa sổ đạt */
  method: z.enum(['all_months', 'average']).optional(),
  /** Cửa sổ xét theo tháng của Level (V8), mặc định: L1 tháng 1–2, L2–L4 hai tháng cuối */
  windowFrom: z.number().int().optional(),
  windowTo: z.number().int().optional(),
});

/** Phiếu đánh giá tổng kết của Level (mục 7.4), phần B–D; phần A là reviewCriteria */
export const ReviewFormSchema = z.object({
  flow: z.string().default(''),
  when: z.string().default(''),
  prompts: z.array(z.object({ key: z.string(), text: z.string(), minPoints: z.number().int().min(0) })),
  passLabel: z.string(),
  allowFail: z.boolean().default(true),
  extension: z.object({
    enabled: z.boolean(),
    months: z.number().int().min(1),
    maxTimes: z.number().int().min(0),
    maxGoals: z.number().int().min(1),
  }),
  /** Chuỗi ký theo thứ tự (R12) */
  signers: z.array(taskRole),
});

/** Rubric quan sát tư vấn (Phụ lục C, R16), dùng chung mọi Level */
export const RubricSchema = z.object({
  scaleMax: z.number().int().min(2).default(3),
  passTotal: z.number().int(),
  forbidOne: z.boolean(),
  minObsPerMonth: z.number().int().min(0),
  /** Tỉ lệ ca đạt mục tiêu (%) */
  targetRate: z.number().min(0).max(100),
  criteria: z.array(z.object({ key: z.string(), name: z.string(), d1: z.string(), d2: z.string(), d3: z.string(), critical: z.boolean().default(false) })),
});

export const LevelSchema = z.object({
  key: z.number().int().min(1).max(4),
  name: z.string(),
  phase: z.string(),
  motto: z.string(),
  durationLabel: z.string(),
  rangeLabel: z.string(),
  months: z.number().int().positive(),
  totalDays: z.number().int().positive(),
  checklistName: z.string(),
  kpi: KpiSchema,
  overview: LevelOverviewSchema,
  reviewCriteria: z
    .array(z.object({ name: z.string(), threshold: z.string(), source: z.string() }))
    .default([]),
  review: ReviewFormSchema.optional(),
  stages: z.array(StageSchema),
});

/** Tham số lịch (mục 10.4) */
export const ScheduleParamsSchema = z.object({
  remindDays: z.number().int().min(0).default(3),
  escalateDays: z.number().int().min(0).default(7),
  signOpenBefore: z.number().int().min(0).default(3),
  signDueAfter: z.number().int().min(0).default(3),
  posDataDay: z.number().int().min(1).max(28).default(5),
  exemptFromDay: z.number().int().min(1).max(31).default(15),
  upcomingDays: z.number().int().min(0).default(14),
  graceDays: z.number().int().min(0).default(14),
  shiftsPerWeek: z.number().int().min(1).default(6),
});

/**
 * Checklist onboarding Cửa hàng trưởng: hai loại "mới tuyển" và "thăng tiến từ NVBH" (docs/nguon/Onboarding_CHT_*.xlsx).
 * Mỗi giai đoạn là một ngày (Ngày D … D+4); kèm nhật ký check-in hằng ngày và đánh giá tổng kết tuần đầu.
 */
export const CHT_TRACKS = ['cht_moi_tuyen', 'cht_thang_tien'] as const;
export type ChtTrackKey = (typeof CHT_TRACKS)[number];

export const ChtTrackSchema = z.object({
  key: z.enum(CHT_TRACKS),
  /** Tiền tố mã đầu việc, ví dụ CM-1-3 */
  code: z.string().regex(/^[A-Z]{2,4}$/, 'Tiền tố mã gồm 2–4 chữ in hoa'),
  name: z.string(),
  title: z.string().default(''),
  goal: z.string().default(''),
  tip: z.string().default(''),
  /** Lưu ý sử dụng / điểm khác biệt, hiện ở trang tổng quan */
  notes: z.array(z.string()).default([]),
  totalDays: z.number().int().positive(),
  /** Lựa chọn "Cảm xúc CHT" trong nhật ký theo dõi */
  moods: z.array(z.string()).default([]),
  /** Tiêu chí chấm sao (1–5) khi đánh giá tổng kết tuần đầu */
  ratings: z.array(z.object({ key: z.string(), label: z.string() })).default([]),
  stages: z.array(StageSchema),
});

/** Phần giới thiệu chung của Khung năng lực (màn "Khung năng lực" chỉ xem) */
export const FrameworkSchema = z.object({
  intro: z.array(z.string()),
  levelTable: z.array(z.array(z.string())),
  responsibilityTable: z.array(z.array(z.string())),
  kpiTable: z.array(z.array(z.string())),
});

export const VersionContentSchema = z
  .object({
    levels: z.array(LevelSchema).length(4),
    scheduleParams: ScheduleParamsSchema,
    rubric: RubricSchema.optional(),
    framework: FrameworkSchema.optional(),
    chtTracks: z.array(ChtTrackSchema).optional(),
  })
  .superRefine((content, ctx) => {
    content.levels.forEach((level, li) => {
      if (level.key !== li + 1) {
        ctx.addIssue({ code: 'custom', path: ['levels', li, 'key'], message: `Level thứ ${li + 1} phải có key ${li + 1}` });
      }
    });
    const keys = (content.chtTracks ?? []).map((t) => t.key);
    if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', path: ['chtTracks'], message: 'Mỗi loại checklist CHT chỉ có một' });
  });

export type Item = z.infer<typeof ItemSchema>;
export type Stage = z.infer<typeof StageSchema>;
export type Level = z.infer<typeof LevelSchema>;
export type LevelOverview = z.infer<typeof LevelOverviewSchema>;
export type ScheduleParams = z.infer<typeof ScheduleParamsSchema>;
export type Framework = z.infer<typeof FrameworkSchema>;
export type Kpi = z.infer<typeof KpiSchema>;
export type ReviewForm = z.infer<typeof ReviewFormSchema>;
export type Rubric = z.infer<typeof RubricSchema>;
export type VersionContent = z.infer<typeof VersionContentSchema>;
export type ChtTrack = z.infer<typeof ChtTrackSchema>;

/** Loại lộ trình của một lượt: NVBH 4 Level hoặc một loại checklist CHT */
export type Track = 'nvbh' | ChtTrackKey;
export const isChtTrack = (track: string): track is ChtTrackKey => (CHT_TRACKS as readonly string[]).includes(track);
export const TRACK_LABEL: Record<Track, string> = { nvbh: 'NVBH', cht_moi_tuyen: 'CHT mới tuyển', cht_thang_tien: 'CHT thăng tiến từ NVBH' };

export interface ItemWithStage {
  item: Item;
  stage: Stage;
  stageIndex: number;
}

export function findLevel(content: VersionContent, levelKey: number): Level {
  const level = content.levels.find((l) => l.key === levelKey);
  if (!level) throw new Error(`Phiên bản không có Level ${levelKey}`);
  return level;
}

export function findChtTrack(content: Pick<VersionContent, 'chtTracks'>, key: ChtTrackKey): ChtTrack | null {
  return content.chtTracks?.find((t) => t.key === key) ?? null;
}

/**
 * Checklist mà một lượt chạy theo, ở dạng Level để bộ tính lịch, quy tắc xác nhận, hàng đợi, cảnh báo dùng chung.
 * Lượt CHT: Level 1 giả lập từ checklist CHT (không có doanh số, phiếu đánh giá Level).
 */
export function levelForTrack(content: VersionContent, track: Track, levelKey: number): Level {
  if (!isChtTrack(track)) return findLevel(content, levelKey);
  const t = findChtTrack(content, track);
  if (!t) throw new Error(`Phiên bản không có checklist ${TRACK_LABEL[track]}`);
  return {
    key: 1,
    name: t.name,
    phase: 'Onboarding CHT',
    motto: t.goal,
    durationLabel: `${t.totalDays} ngày`,
    rangeLabel: `Ngày D → D+${t.totalDays - 1}`,
    months: 1,
    totalDays: t.totalDays,
    checklistName: t.title || t.name,
    kpi: { total: 0, coef1: 0, ratio: 0 },
    overview: { goals: [], kpiTable: [], responsibilities: [], lms: [], counter: [], note: t.tip || undefined },
    reviewCriteria: [],
    stages: t.stages,
  };
}

/** Mọi đầu việc của Level theo thứ tự giai đoạn rồi thứ tự trong giai đoạn. */
export function levelItems(level: Level): ItemWithStage[] {
  return level.stages.flatMap((stage, stageIndex) => stage.items.map((item) => ({ item, stage, stageIndex })));
}
