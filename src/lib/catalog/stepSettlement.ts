/**
 * What settles a step verdict — the headless loop's answer to "the server graded it; now what?"
 *
 * A non-pass verdict is settled by exactly one kind of act, and which one is a DECLARED contract, not
 * prose: the fixed reason markers (`acceptance/markers.ts`), the verdict's tier, and the packaging
 * predicate. Measured on the real DB (2026-09-29, 1052 non-pass rows): 143 wait on an L3 drain, 7 on
 * verify-static, 339 are SOURCED, 407 are declared reference gaps, 114 are UNGRADED — and the pof-mcp
 * skill knew only "fail → resubmit, deferred → drain", so an agent resubmitted rows no submit can
 * settle and never reached the settle route that settles L2/packaging/icon deferrals.
 *
 * `entityNextStep` is the lab coaches' own ladder (`pickLadderIssue`) over the entity's persisted
 * verdicts, ranked through the same `ladderStatusOf` every lab ladder caller uses (rows nothing
 * here can settle are skipped) — so the headless loop and the lab name the same next step.
 * Pure: no db, no fs.
 */
import { pickLadderIssue, type CoachPriority } from '@/components/layout-lab/coachLadder';
import { ladderStatusOf } from '@/components/layout-lab/coachSettlement';
import type { StepDisplayStatus } from '@/components/layout-lab/hooks/useEntityArtifacts';
import { SOURCED_MARKER, TEMPLATE_MARKER, UNGRADED_MARKER } from '@/lib/catalog/acceptance/markers';
import { isPackagingStep } from '@/lib/catalog/acceptance/packagingStep';

export type SettlementKind = 'resubmit' | 'fill-gap' | 'produce' | 'produce-live' | 'drain' | 'settle' | 'none';

export interface Settlement {
  kind: SettlementKind;
  /** The pof-mcp tool that performs the act, when one does. */
  tool?: string;
  /** The app route that performs it when no tool advertises it. */
  route?: string;
  args?: Record<string, unknown>;
  /** False when nothing the loop can do settles the verdict — do not resubmit it. */
  actionable: boolean;
  why: string;
}

/** The verdict fields the classifier reads (an `AcceptanceResult`, a submit's `acceptance`, a persisted row). */
export interface SettleVerdict {
  status: string;
  tier?: string;
  reason?: string;
}

/** What the classifier reads off a step spec. */
export interface SettleSpec {
  label: string;
  archetype?: string;
  packaging?: boolean;
}

export const SETTLE_ROUTE = 'POST /api/pipeline-artifacts/settle';

const hasMarker = (reason: string, marker: string) => reason.includes(`${marker}:`);
const DECLARED_GAP = /\(declared gap\b/;

/** The act that settles `verdict`, or null for a pass (nothing to settle). */
export function settlementOf(verdict: SettleVerdict, spec?: SettleSpec): Settlement | null {
  const { status, tier } = verdict;
  const reason = verdict.reason ?? '';
  if (status === 'pass') return null;
  if (hasMarker(reason, UNGRADED_MARKER)) {
    return { kind: 'none', actionable: false, why: 'UNGRADED — no checker or no law grades this row here; a resubmit cannot settle it.' };
  }
  if (status === 'fail') {
    return { kind: 'resubmit', tool: 'pof_submit_artifact', actionable: true, why: 'the checker rejected the data — fix what the reason names and resubmit.' };
  }
  if (status === 'deferred') {
    // Packaging and L0–L2 deferrals are re-graded from disk by the settle passes (bind-icons,
    // verify-static, verify-packaging); the drain runs only live L3/L4 gates.
    // A deferral with no tier is left to the drain unscoped (it drains both live tiers).
    if ((spec && isPackagingStep(spec)) || tier === 'L0' || tier === 'L1' || tier === 'L2') {
      return { kind: 'settle', route: SETTLE_ROUTE, actionable: true, why: 'a disk-truth gate is waiting — the settle passes (bind-icons → verify-static → verify-packaging) re-grade it.' };
    }
    return {
      kind: 'drain', tool: 'pof_drain_gates', args: tier ? { tier } : {}, actionable: true,
      why: `${tier ? `an ${tier}` : 'a'} runtime/visual gate is waiting on a live editor — drain it.`,
    };
  }
  if (hasMarker(reason, TEMPLATE_MARKER)) {
    return { kind: 'produce-live', tool: 'pof_get_step', actionable: true, why: "the row is the exemplar's template — produce this step for this entity from its recipe." };
  }
  if (hasMarker(reason, SOURCED_MARKER)) {
    return { kind: 'produce', tool: 'pof_get_step', actionable: true, why: 'the row was seeded from a reference, never produced — produce it from the recipe and submit.' };
  }
  if (DECLARED_GAP.test(reason)) {
    return { kind: 'fill-gap', tool: 'pof_submit_artifact', actionable: true, why: 'the reference does not state these fields — supply a designed value (say it is designed) and resubmit.' };
  }
  return { kind: 'produce', tool: 'pof_get_step', actionable: true, why: reason || 'nothing graded yet — produce the step from its recipe and submit.' };
}

/** A ladder pick without its index: the step and the rung it sits on. */
export interface EntityStepPick {
  step: string;
  priority: CoachPriority;
}

/**
 * The step the lab coach ladder would pick for an entity. `verdictOf` returns the persisted
 * (judge-bridged) verdict, or null when the step was never produced. A row whose settlement is
 * not actionable reads as settled, so the ladder never points at work nothing can do.
 */
export function entityNextStep(steps: readonly SettleSpec[], verdictOf: (label: string) => SettleVerdict | null): EntityStepPick | null {
  const specs = new Map(steps.map((s) => [s.label, s]));
  const statusOf = (label: string): StepDisplayStatus => {
    const v = verdictOf(label);
    return v ? ladderStatusOf(v.status as StepDisplayStatus, v, specs.get(label)) : 'unproduced';
  };
  const pick = pickLadderIssue(steps.map((s) => s.label), statusOf);
  return pick ? { step: pick.step, priority: pick.priority } : null;
}
