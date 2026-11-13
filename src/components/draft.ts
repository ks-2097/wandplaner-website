import { specSchema, type PlannerSpec } from '@/planner';

/** The customer's work in progress lives in their browser until they order. */

const KEY = 'plana.draft.v2';
export type Draft = { spec: PlannerSpec; calNames: Record<string, string> };

export function loadDraft(): Draft | undefined {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    const parsed = specSchema.safeParse(raw?.spec);
    if (!parsed.success) return undefined;
    return { spec: parsed.data as PlannerSpec, calNames: raw.calNames ?? {} };
  } catch {
    return undefined;
  }
}

export function saveDraft(draft: Draft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Private windows and full storage: the configurator still works for this visit.
  }
}
