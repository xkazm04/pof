import type { ABTest, ABTestView, EvolutionSuggestion, PromptVariant } from '@/types/prompt-evolution';
import { TIE_MARGIN, verdictOf } from '@/lib/prompt-evolution/verdict';

// ── Adopt a decided winner ──────────────────────────────────────────────────
// One pure rule set for "may this concluded test's winner become the served
// version, and what would change?" — shared by the test card and the suggestions
// bar so the two entry points cannot disagree.

export type AdoptionBlockKind =
  | 'not-concluded'
  | 'no-winner'
  | 'unknown-winner'
  | 'already-active'
  | 'superseded';

export interface AdoptionBlock {
  kind: AdoptionBlockKind;
  message: string;
  /** The newer concluded test, for `superseded`. */
  testId?: string;
}

export interface AdoptionDiff {
  /** The currently served prompt; null when the item has no active version. */
  before: string | null;
  after: string;
  identical: boolean;
  /** Characters added (positive) or removed (negative) versus the incumbent. */
  lengthDelta: number;
}

export interface AdoptionPlan {
  winner: PromptVariant;
  incumbent: PromptVariant | null;
  diff: AdoptionDiff;
  /** True when current evidence favours the loser by at least TIE_MARGIN. */
  contested: boolean;
  caution: string | null;
}

export type AdoptionResult =
  | { ok: true; data: AdoptionPlan }
  | { ok: false; error: AdoptionBlock };

type AnyTest = ABTest | ABTestView;

const fail = (kind: AdoptionBlockKind, message: string, testId?: string): AdoptionResult => ({
  ok: false,
  error: { kind, message, ...(testId ? { testId } : {}) },
});

const decidedAt = (t: AnyTest): number => Date.parse(t.concludedAt ?? t.createdAt) || 0;

export function planAdoption(input: {
  test: AnyTest;
  variants: PromptVariant[];
  /** Every loaded test, for the superseded check. */
  tests?: AnyTest[];
  /** Override the active id; defaults to the item's active variant. */
  activeId?: string | null;
}): AdoptionResult {
  const { test, variants, tests = [] } = input;
  if (test.status !== 'concluded') return fail('not-concluded', 'This test has not been decided yet.');
  if (!test.winnerId) return fail('no-winner', 'This test ended without a winner, so there is nothing to adopt.');

  const winner = variants.find((v) => v.id === test.winnerId);
  if (!winner) return fail('unknown-winner', 'The winning version is not loaded, so it cannot be adopted.');

  const activeId = input.activeId !== undefined
    ? input.activeId
    : variants.find((v) => v.checklistItemId === test.checklistItemId && v.active)?.id ?? null;
  if (activeId === winner.id) return fail('already-active', `“${winner.label}” is already the version in use.`);

  const newer = tests.find((t) =>
    t.id !== test.id
    && t.moduleId === test.moduleId
    && t.checklistItemId === test.checklistItemId
    && t.status === 'concluded'
    && t.winnerId
    && t.winnerId !== test.winnerId
    && decidedAt(t) > decidedAt(test));
  if (newer) {
    return fail('superseded', 'A newer test on this item picked a different winner; adopt that one instead.', newer.id);
  }

  const incumbent = activeId ? variants.find((v) => v.id === activeId) ?? null : null;
  const diff: AdoptionDiff = {
    before: incumbent?.prompt ?? null,
    after: winner.prompt,
    identical: incumbent?.prompt === winner.prompt,
    lengthDelta: winner.prompt.length - (incumbent?.prompt.length ?? 0),
  };

  const reading = verdictOf(test);
  const winnerIsA = test.winnerId === test.variantAId;
  const winRate = winnerIsA ? reading.rateA : reading.rateB;
  const loseRate = winnerIsA ? reading.rateB : reading.rateA;
  const contested = loseRate - winRate >= TIE_MARGIN;
  const caution = contested
    ? `Current evidence now favours the other version (${Math.round(loseRate * 100)}% vs ${Math.round(winRate * 100)}%). Adopt only if you still trust this win.`
    : null;

  return { ok: true, data: { winner, incumbent, diff, contested, caution } };
}

/**
 * Drop adopt-winner suggestions whose variant is already the served one, so an
 * adopted winner stops being re-suggested (and stops crowding the 4-row bar).
 */
export function filterAdoptSuggestions(
  suggestions: EvolutionSuggestion[],
  variants: PromptVariant[],
): EvolutionSuggestion[] {
  const activeIds = new Set(variants.filter((v) => v.active).map((v) => v.id));
  return suggestions.filter((s) => !(s.type === 'adopt-winner' && s.variantId && activeIds.has(s.variantId)));
}

export interface AdoptionHandle {
  ok: true;
  winnerId: string;
  previousId: string | null;
  /** Restores the previous version; absent when nothing was active before. */
  undo?: () => Promise<boolean>;
}

/** Run the adoption through the store's reversible restore primitive. */
export async function runAdoption(
  plan: Pick<AdoptionPlan, 'winner' | 'incumbent'>,
  restore: (variantId: string) => Promise<PromptVariant | null>,
): Promise<AdoptionHandle | { ok: false; message: string }> {
  const restored = await restore(plan.winner.id);
  if (!restored) return { ok: false, message: 'Failed to adopt the winning version.' };
  const previousId = plan.incumbent?.id ?? null;
  return {
    ok: true,
    winnerId: plan.winner.id,
    previousId,
    ...(previousId ? { undo: async () => (await restore(previousId)) !== null } : {}),
  };
}
