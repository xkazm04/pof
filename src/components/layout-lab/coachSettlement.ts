/**
 * The coach's side of the settlement contract (`stepSettlement.settlementOf`): which act settles
 * the step the ladder picked, said in the coach's own words — and which rows the ladder must skip
 * because nothing here can settle them.
 *
 * ONE classifier, two readers. The headless/MCP loop (`entityNextStep`) and every lab ladder
 * caller (`nextActionableStep`, `globalCoachModel`, `matrixRows`) rank through
 * {@link ladderStatusOf}, so they name the same next step for the same verdicts. It never moves a
 * status: an unsettleable row keeps its display status everywhere it is shown; only the LADDER
 * reads it as settled, and {@link unsettleable} names it so the coach says so instead of hiding it.
 *
 * {@link coachActionFor} is the single hint channel: every settling act's action word, plain hint
 * and CTA is built here from the verdict's own reason (the reason is the work order). Pure.
 */
import { settlementOf, type Settlement, type SettleSpec, type SettleVerdict } from '@/lib/catalog/stepSettlement';
import type { StepDisplayStatus } from './hooks/useEntityArtifacts';

/** What the coach's primary button does for a pick. */
export type CoachCta = 'jump' | 'drain';

export interface CoachAction {
  actionWord: string;
  plainHint: string;
  cta: CoachCta;
}

type VerdictOf = (step: string) => SettleVerdict | null | undefined;
type SpecOf = (step: string) => SettleSpec | undefined;

/**
 * A checker that THREW in the lab (`ungradedResult`) is stamped `UNGRADED:` too, but it is a
 * lab-local defect a human fixes (the checker or the stored data) — never a persisted row the MCP
 * loop reads — so the ladder keeps coaching it rather than skipping it.
 */
const LAB_THROW = 'the Acceptance checker THREW';

/** Whether nothing the loop can do settles this verdict (settlementOf's `actionable: false`). */
function cannotSettle(verdict: SettleVerdict | null | undefined, spec?: SettleSpec): boolean {
  if (!verdict || verdict.reason?.includes(LAB_THROW)) return false;
  return settlementOf(verdict, spec)?.actionable === false;
}

/**
 * The status the shared ladder RANKS for a step: its display status, except a row nothing can
 * settle reads as settled (`pass`) so no coach points at work nothing can do. Display only.
 */
export function ladderStatusOf(display: StepDisplayStatus, verdict?: SettleVerdict | null, spec?: SettleSpec): StepDisplayStatus {
  if (display === 'pass' || display === 'unproduced') return display;
  return cannotSettle(verdict, spec) ? 'pass' : display;
}

/**
 * Wrap a caller's display-status function with {@link ladderStatusOf}. `reasonOf` is enough for
 * callers that only hold the derived reason — actionability reads the status and the marker.
 */
export function settledLadder(
  statusByStep: (step: string, i: number) => StepDisplayStatus,
  reasonOf: (step: string) => string | undefined,
): (step: string, i: number) => StepDisplayStatus {
  return (step, i) => {
    const display = statusByStep(step, i);
    return ladderStatusOf(display, { status: display, reason: reasonOf(step) });
  };
}

/** The steps the ladder skips because nothing here can settle them (UNGRADED), in pipeline order. */
export function unsettleable(steps: readonly string[], verdictOf: VerdictOf, specOf?: SpecOf): string[] {
  return steps.filter((s) => cannotSettle(verdictOf(s), specOf?.(s)));
}

/** How many verdicts the live L3/L4 drain can settle (a tierless deferral drains unscoped). */
export function drainableCount(verdicts: Iterable<SettleVerdict & { step?: string }>, specOf?: SpecOf): number {
  let n = 0;
  for (const v of verdicts) {
    if (settlementOf(v, v.step ? specOf?.(v.step) : undefined)?.kind === 'drain') n++;
  }
  return n;
}

/** The fields a declared-gap reason names: `(declared gap: a, b — "not in the reference")`. */
function gapFields(reason: string): string | undefined {
  return /declared gap:\s*(.+?)\s+[—-]\s+"/.exec(reason)?.[1];
}

/** The exemplar a TEMPLATE reason names: `TEMPLATE: <exemplar> template, …`. */
function exemplarOf(reason: string): string | undefined {
  return /TEMPLATE:\s*(\S+)\s+template/.exec(reason)?.[1];
}

/**
 * The coach's words for the act that settles a pick. `reason` is the verdict's own reason; it is
 * quoted, never paraphrased into something stronger — a hint may name the work, never a grade.
 */
export function coachActionFor(settlement: Settlement, reason?: string): CoachAction {
  const r = reason?.trim() || undefined;
  switch (settlement.kind) {
    case 'resubmit':
      return { actionWord: 'Fix', plainHint: r ?? 'This step ran but did not pass — open it to see what to change.', cta: 'jump' };
    case 'fill-gap': {
      const fields = r ? gapFields(r) : undefined;
      return {
        actionWord: 'Fill gap',
        plainHint: fields
          ? `The reference does not state ${fields} — supply a designed value (say it is designed) and resubmit.`
          : `A declared reference gap holds this step — ${r ?? settlement.why}`,
        cta: 'jump',
      };
    }
    case 'produce':
      return r?.startsWith('SOURCED:')
        ? { actionWord: 'Produce', plainHint: 'This row was seeded from a reference and never produced — produce it from its recipe and submit.', cta: 'jump' }
        : { actionWord: 'Produce', plainHint: r ?? settlement.why, cta: 'jump' };
    case 'produce-live': {
      const exemplar = r ? exemplarOf(r) : undefined;
      return {
        actionWord: 'Produce for this entity',
        plainHint: exemplar
          ? `This row is ${exemplar}'s template, not this entity's — produce this step live for this entity from its recipe.`
          : settlement.why,
        cta: 'jump',
      };
    }
    case 'settle':
      return {
        actionWord: 'Settle',
        plainHint: 'A disk-truth gate is waiting — the settle passes (bind-icons → verify-static → verify-packaging) re-grade it; the live drain cannot.',
        cta: 'jump',
      };
    case 'drain':
      return { actionWord: 'Run live test', plainHint: r ?? 'Waiting on a live Unreal run — use “Run deferred gates” to send it.', cta: 'drain' };
    case 'none':
      // Only a lab-local throw is ever picked here (the ladder skips every other UNGRADED row).
      return r?.includes(LAB_THROW)
        ? { actionWord: 'Fix', plainHint: r, cta: 'jump' }
        : { actionWord: 'Review', plainHint: `Nothing here can settle this — ${r ?? settlement.why}`, cta: 'jump' };
  }
}
