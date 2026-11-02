import type { TaskRole } from '../roles';
import type { Actor, RunPeople } from '../rules/confirm';
import type { Level, ReviewForm } from '../schemas/version';

/**
 * Phiếu đánh giá tổng kết và chuỗi ký (mục 7.4, 11.5, R12–R14).
 */

export type ReviewResult = 'pass' | 'extend' | 'fail';
export type CriterionResult = '' | 'pass' | 'fail';

export interface ReviewDraft {
  criteria: CriterionResult[];
  notes: Record<string, string>;
  result: ReviewResult | null;
  goals: string;
}

/** Cấu hình mặc định theo giao diện tham chiếu N3 và giả định V7, V13, V14 */
export function reviewFormOf(level: Pick<Level, 'key' | 'review'>): ReviewForm {
  if (level.review) return level.review;
  return {
    flow: 'Buddy hoặc CHT điền. CHT ký đề xuất, QLKV phê duyệt, BP Đào tạo xác nhận và lưu hồ sơ.',
    when: 'Từ khi mở giai đoạn cuối của Level',
    prompts: [
      { key: 'strengths', text: 'Điểm mạnh nổi bật (≥ 2 điểm cụ thể, kèm ví dụ)', minPoints: 2 },
      { key: 'improve', text: 'Điểm cần phát triển (≥ 2 điểm, không chung chung)', minPoints: 2 },
      {
        key: 'potential',
        text: `Tiềm năng phù hợp vai trò nào trong tương lai${level.key >= 2 ? ' · năng lực dẫn dắt, huấn luyện người khác' : ''}`,
        minPoints: 0,
      },
    ],
    passLabel: level.key < 4 ? `Đủ điều kiện lên Level ${level.key + 1}` : 'Đạt chuẩn Level 4',
    allowFail: true,
    extension: { enabled: true, months: 1, maxTimes: 2, maxGoals: 3 },
    signers: ['cht', 'qlkv', 'bp'],
  };
}

/** Số ý trong một ô nhận xét: mỗi dòng không rỗng là một ý (mục 7.4 phần B) */
export const countPoints = (text: string) =>
  text
    .split('\n')
    .map((s) => s.replace(/^\s*([-•*+]|\d+[.)])\s*/, '').trim())
    .filter(Boolean).length;

export const RESULT_LABEL = (form: Pick<ReviewForm, 'passLabel'>): Record<ReviewResult, string> => ({
  pass: form.passLabel,
  extend: 'Gia hạn',
  fail: 'Không đạt (đóng lượt)',
});

/** R13, R14: những điều còn thiếu trước khi người ký đầu tiên ký được */
export function reviewProblems(form: ReviewForm, draft: ReviewDraft, extCount: number): string[] {
  const out: string[] = [];
  if (!draft.result) out.push('Chọn kết quả đề xuất');
  for (const p of form.prompts) {
    if (p.minPoints > 0 && countPoints(draft.notes[p.key] ?? '') < p.minPoints) {
      out.push(`"${p.text}" cần ít nhất ${p.minPoints} ý, mỗi ý một dòng`);
    }
  }
  if (draft.result === 'extend') {
    if (!form.extension.enabled) out.push('Phiếu Level này không cho phép gia hạn');
    else if (extCount >= form.extension.maxTimes) out.push(`Không gia hạn quá ${form.extension.maxTimes} lần. Cần họp ba bên với QLKV và BP Đào tạo`);
    const goals = countPoints(draft.goals);
    if (goals === 0) out.push('Ghi mục tiêu cần đạt trong thời gian gia hạn');
    if (goals > form.extension.maxGoals) out.push(`Gia hạn tối đa ${form.extension.maxGoals} mục tiêu`);
  }
  if (draft.result === 'fail' && !form.allowFail) out.push('Phiếu Level này không có kết quả "Không đạt"');
  return out;
}

/** Bước ký kế tiếp (R12: bước sau chỉ mở khi bước trước đã ký); null khi đã ký hết */
export function nextSignStep(signers: readonly TaskRole[], signedSteps: readonly number[]): number | null {
  const idx = signers.findIndex((_, i) => !signedSteps.includes(i));
  return idx === -1 ? null : idx;
}

/** Ai ký được một bước của chuỗi ký trên lượt Level */
export function canSignAs(actor: Actor, people: RunPeople, role: TaskRole): boolean {
  switch (role) {
    case 'cht':
      return actor.userId === people.chtId;
    case 'qlkv':
      return actor.userId === people.qlkvId;
    case 'bp':
      return actor.role === 'bp';
    case 'buddy':
      return actor.userId === people.buddyId;
    case 'nv':
      // NV chưa có tài khoản thì Buddy hoặc CHT ký nhận thay
      return people.staffUserId !== null ? actor.userId === people.staffUserId : actor.userId === people.buddyId || actor.userId === people.chtId;
  }
}

export const SIGN_STEP_LABEL: Record<TaskRole, string> = {
  cht: 'Cửa hàng trưởng ký đề xuất',
  qlkv: 'QLKV phê duyệt',
  bp: 'BP Đào tạo xác nhận và lưu hồ sơ',
  nv: 'Nhân viên ký đã nhận kết quả',
  buddy: 'Buddy ký xác nhận',
};

/** Bước ký áp dụng kết quả (chuyển Level, gia hạn, đóng lượt): bước BP ĐT, nếu chuỗi không có BP ĐT thì bước cuối */
export const outcomeStep = (signers: readonly TaskRole[]) => {
  const bp = signers.indexOf('bp');
  return bp >= 0 ? bp : signers.length - 1;
};
