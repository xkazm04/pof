import type { ABTest, ABTestVerdict, ABTestView, EvolutionSuggestion, PromptVariant } from '@/types/prompt-evolution';
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

/**
 * What the band licenses: strong and moderate adopt; weak is a lead; none detected
 * no difference (a ceiling or decide-now conclusion still crowns one arm).
 */
function evidenceCaution(reading: ABTestVerdict): string | null {
  const counts = `${reading.trialsA} vs ${reading.trialsB} ${reading.basis === 'judge' ? 'judge verdicts' : 'self-reported runs'}`;
  if (reading.band === 'weak') return `This win is a lead, not a result (weak evidence, ${counts}). Running the test longer would settle it.`;
  if (reading.band === 'none') return `No reliable difference was detected (${counts}), so this pick is close to a coin flip.`;
  return null;
}

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
    : evidenceCaution(reading);

  return { ok: true, data: { winner, incumbent, diff, contested, caution } };
}

/**
 * Drop adopt-winner suggestions whose variant is already the served one, so an
 * adopted winner stops being re-suggested (and stops crowding the 4-row bar).
 * The server suggests one card per concluded test, but the action adopts the item's
 * LATEST winner, so a card naming an earlier winner would adopt a different version.
 */
export function filterAdoptSuggestions(
  suggestions: EvolutionSuggestion[],
  variants: PromptVariant[],
  tests: AnyTest[] = [],
): EvolutionSuggestion[] {
  const activeIds = new Set(variants.filter((v) => v.active).map((v) => v.id));
  const latest = new Map<string, AnyTest>();
  for (const t of tests) {
    if (t.status !== 'concluded' || !t.winnerId) continue;
    const key = `${t.moduleId}::${t.checklistItemId}`;
    const current = latest.get(key);
    if (!current || decidedAt(t) > decidedAt(current)) latest.set(key, t);
  }
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    if (s.type !== 'adopt-winner' || !s.variantId) return true;
    if (activeIds.has(s.variantId)) return false;
    const key = `${s.moduleId}::${s.checklistItemId}`;
    const current = latest.get(key);
    if (current && current.winnerId !== s.variantId) return false;
    if (seen.has(`${key}::${s.variantId}`)) return false;
    seen.add(`${key}::${s.variantId}`);
    return true;
  });
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
