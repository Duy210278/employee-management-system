import {
  classifyChanges,
  countIssues,
  proposeVersionCode,
  validateChecklist,
  type ValidationIssue,
  type VersionContent,
  type VersionDetailResponse,
} from '@lotrinh/shared';
import { computed, inject, nextTick, provide, reactive, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue';

/** Trạng thái chung của trình soạn bản lộ trình, chia sẻ cho các thẻ giai đoạn và dòng đầu việc */
export interface DesignerContext {
  content: Ref<VersionContent>;
  /** "Hôm nay" theo đồng hồ nghiệp vụ của máy chủ (có tính ngày giả lập) */
  today: ComputedRef<string>;
  editable: ComputedRef<boolean>;
  levelKey: Ref<number>;
  collapsed: Set<string>;
  issues: ComputedRef<ValidationIssue[]>;
  issuesFor: (where: { itemKey?: string; stageKey?: string }) => ValidationIssue[];
  counts: ComputedRef<{ errors: number; warnings: number }>;
  summary: ComputedRef<ReturnType<typeof classifyChanges> | null>;
  proposedCode: ComputedRef<string | null>;
  categories: ComputedRef<string[]>;
  flashKey: Ref<string | null>;
  /** Chuyển tới đúng Level, mở giai đoạn, cuộn và nhấp nháy dòng có lỗi (mục 6.2, 7.7) */
  focus: (at: ValidationIssue['at']) => void;
}

const KEY: InjectionKey<DesignerContext> = Symbol('designer');

export function createDesigner(detail: Ref<VersionDetailResponse>, content: Ref<VersionContent>): DesignerContext {
  const levelKey = ref(1);
  const collapsed = reactive(new Set<string>());
  const flashKey = ref<string | null>(null);
  const editable = computed(() => detail.value.permissions.edit);
  const issues = computed(() => validateChecklist(content.value));
  const byItem = computed(() => {
    const m = new Map<string, ValidationIssue[]>();
    for (const i of issues.value) {
      const k = i.at.itemKey ?? (i.at.stageKey ? `stage:${i.at.stageKey}` : null);
      if (k) m.set(k, [...(m.get(k) ?? []), i]);
    }
    return m;
  });
  const summary = computed(() => (detail.value.parentContent ? classifyChanges(detail.value.parentContent, content.value) : null));
  const proposedCode = computed(() => {
    const s = summary.value;
    const line = detail.value.parentLine;
    if (detail.value.version.code) return detail.value.version.code;
    return s?.kind && line ? proposeVersionCode(line, s.kind, detail.value.existingCodes) : null;
  });
  const categories = computed(() => [...new Set(content.value.levels.flatMap((l) => l.stages.flatMap((s) => s.items.map((i) => i.category))))].filter(Boolean).sort());

  function focus(at: ValidationIssue['at']) {
    if (at.levelKey) levelKey.value = at.levelKey;
    if (at.stageKey) collapsed.delete(at.stageKey);
    const key = at.itemKey ?? at.stageKey ?? null;
    void nextTick(() => {
      const el = document.getElementById(at.itemKey ? `it-${at.itemKey}` : `st-${at.stageKey}`);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const field = at.field ? el.querySelector<HTMLElement>(`[data-field="${at.field}"]`) : null;
      field?.focus({ preventScroll: true });
      flashKey.value = key;
      setTimeout(() => (flashKey.value = null), 1600);
    });
  }

  const ctx: DesignerContext = {
    content,
    today: computed(() => detail.value.today),
    editable,
    levelKey,
    collapsed,
    issues,
    issuesFor: (w) => byItem.value.get(w.itemKey ?? `stage:${w.stageKey}`) ?? [],
    counts: computed(() => countIssues(issues.value)),
    summary,
    proposedCode,
    categories,
    flashKey,
    focus,
  };
  provide(KEY, ctx);
  return ctx;
}

export function useDesigner(): DesignerContext {
  const ctx = inject(KEY);
  if (!ctx) throw new Error('useDesigner() phải nằm trong VersionEditor');
  return ctx;
}
