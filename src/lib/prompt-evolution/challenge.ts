import type {
  ABTest,
  MutationType,
  PromptVariantFitness,
  VariantVersionEntry,
  VariantVersionHistory,
} from '@/types/prompt-evolution';
import { diffPrompts, type DiffSummary } from '@/lib/text-diff';
import { type Result, ok, err } from '@/types/result';

/**
 * Challenge the current prompt — the preflight for "test version X against the
 * one being served now". Pure: History already holds the lineage, the per-version
 * trial stats and the active flag; this adds the incumbent/challenger resolution,
 * a diff summary, the judge evidence per arm, and the reasons a challenge cannot
 * start. The arms are fixed — incumbent is ALWAYS arm A, the picked version arm B
 * — so which card was clicked first can no longer decide the arm order.
 */

/** What one arm brings to the test. `avgScore`/`passRate` are null when unjudged — never 0. */
export interface ArmEvidence {
  variantId: string;
  /** Self-reported A/B trials across every test this version was in. */
  trials: number;
  successRate: number | null;
  /** Judge verdicts on artifacts this version produced. */
  verdicts: number;
  avgScore: number | null;
  passRate: number | null;
}

export interface ChallengePlan {
  moduleId: VariantVersionHistory['moduleId'];
  checklistItemId: string;
  /** The version served today (arm A). */
  incumbentId: string;
  /** The picked version (arm B). */
  challengerId: string;
  incumbent: VariantVersionEntry;
  challenger: VariantVersionEntry;
  /** How the challenger was made, when it is a mutation; null for an edit or a seed. */
  mutationType: MutationType | null;
  parentId: string | null;
  /** Line counts of incumbent → challenger. */
  diff: DiffSummary;
  evidence: { incumbent: ArmEvidence; challenger: ArmEvidence };
}

export type ChallengeBlock =
  | { kind: 'no-incumbent'; message: string }
  | { kind: 'unknown-version'; message: string }
  | { kind: 'already-current'; message: string }
  | { kind: 'identical-prompt'; message: string }
  | { kind: 'test-running'; testId: string; message: string };

export interface ChallengeInput {
  history: VariantVersionHistory;
  candidateId: string;
  /** Tests the caller knows about; only running ones on this item block. */
  runningTests: readonly ABTest[];
  fitness: readonly PromptVariantFitness[];
}

/** The version served today: the active one, else the seeded root (the captured baseline). */
export function findIncumbent(history: VariantVersionHistory): VariantVersionEntry | null {
  const byActiveId = history.activeVariantId
    ? history.versions.find((v) => v.variant.id === history.activeVariantId)
    : undefined;
  return (
    byActiveId ??
    history.versions.find((v) => v.isActive) ??
    history.versions.find((v) => v.variant.origin === 'seeded' && v.variant.parentId === null) ??
    null
  );
}

function armEvidence(entry: VariantVersionEntry, fitness: readonly PromptVariantFitness[]): ArmEvidence {
  const judged = fitness.find((f) => f.variantId === entry.variant.id);
  return {
    variantId: entry.variant.id,
    trials: entry.stats.trials,
    successRate: entry.stats.trials > 0 ? entry.stats.successRate : null,
    verdicts: judged?.verdicts ?? 0,
    avgScore: judged?.avgScore ?? null,
    passRate: judged?.passRate ?? null,
  };
}

export function planChallenge(input: ChallengeInput): Result<ChallengePlan, ChallengeBlock> {
  const { history, candidateId, runningTests, fitness } = input;

  const incumbent = findIncumbent(history);
  if (!incumbent) {
    return err({ kind: 'no-incumbent', message: 'This item has no current version to challenge yet — run it once so its prompt is captured as v1.' });
  }
  const challenger = history.versions.find((v) => v.variant.id === candidateId);
  if (!challenger) {
    return err({ kind: 'unknown-version', message: 'That version is not in this item’s history.' });
  }
  if (challenger.variant.id === incumbent.variant.id) {
    return err({ kind: 'already-current', message: `“${incumbent.variant.label}” is already the current version.` });
  }
  if (challenger.variant.prompt === incumbent.variant.prompt) {
    return err({ kind: 'identical-prompt', message: 'This version’s prompt is identical to the current one — a test could only measure noise.' });
  }
  const running = runningTests.find(
    (t) => t.status === 'running' && t.moduleId === history.moduleId && t.checklistItemId === history.checklistItemId,
  );
  if (running) {
    return err({
      kind: 'test-running',
      testId: running.id,
      message: 'An A/B test is already running on this item. Conclude it before starting another — one live test per item keeps its trials honest.',
    });
  }

  return ok({
    moduleId: history.moduleId,
    checklistItemId: history.checklistItemId,
    incumbentId: incumbent.variant.id,
    challengerId: challenger.variant.id,
    incumbent,
    challenger,
    mutationType: challenger.variant.mutationType ?? null,
    parentId: challenger.variant.parentId,
    diff: diffPrompts(incumbent.variant.prompt, challenger.variant.prompt).summary,
    evidence: { incumbent: armEvidence(incumbent, fitness), challenger: armEvidence(challenger, fitness) },
  });
}
