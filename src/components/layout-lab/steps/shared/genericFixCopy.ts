import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';
import type { ArchetypeId, StepFixCopy, StepSpec } from '@/lib/catalog/stepSpec';
import type { Acceptance } from '../StepFrame';

/**
 * Authored corrective language per ARCHETYPE — the one place a human wrote what
 * "fix this" concretely means for each kind of deliverable.
 *
 * Why per archetype rather than per step: the archetype IS the deliverable contract
 * (a `balance` step owes a number inside a band; a `gallery` step owes a selected
 * candidate), and it is the largest unit that can carry a real, specific instruction
 * WITHOUT inventing catalog content. These 9 authored blocks cover all ~344 steps;
 * hand-writing 344 bespoke ones would mean inventing target values no checker stated.
 *
 * A step may still override the whole thing with a bespoke `StepSpec.copy`.
 */
const ARCHETYPE_FIX: Record<ArchetypeId, { noun: string; act: string }> = {
  brief: {
    noun: 'brief',
    act: 'Write the missing sections out in full prose — no placeholders, no TODOs.',
  },
  schema: {
    noun: 'schema',
    act: 'Give every declared field a concrete, correctly-typed value.',
  },
  balance: {
    noun: 'balance figures',
    act: 'Move the metric the criterion names back inside its stated band, and keep the other figures consistent with it.',
  },
  gallery: {
    noun: 'candidate batch',
    act: 'Generate a fresh batch in this direction and select the candidate that best answers the criterion.',
  },
  rules: {
    noun: 'rule set',
    act: 'State each rule explicitly as its own entry — one rule, one line.',
  },
  checklist: {
    noun: 'checklist',
    act: 'Complete every checklist entry with a statement that can be verified, not a restatement of the item.',
  },
  manifest: {
    noun: 'manifest',
    act: 'List every required entry with its concrete value; leave nothing null.',
  },
  graph: {
    noun: 'graph',
    act: 'Add the missing nodes and edges so every path reaches a terminal state.',
  },
  custom: {
    noun: 'artifact',
    act: 'Re-run the step so it writes the fields its checker actually reads.',
  },
};

/** Only what a direction is allowed to name: the status, the criterion, the reason. */
type GradedGate = Pick<AcceptanceResult, 'status' | 'label' | 'reason'>;

/** The checker's own reason, or an honest note that it gave none. Pure. */
function reasonClause(a: GradedGate): string {
  return a.reason ? `: ${a.reason}` : ' — the checker reported no further detail';
}

/**
 * The corrective direction a one-click "Produce fix" will dispatch. ALWAYS non-empty.
 *
 * Before this, `runFix` resolved to `acceptance.fixDirection ?? spec.defaultDirection ?? ''`
 * and — since 0 of 344 steps author either field, and many checkers return no `reason` —
 * the fix button dispatched an EMPTY direction: a produce run with no instruction at all.
 *
 * It invents no catalog content. Every clause is composed from the step's own label and
 * archetype, the criterion label the checker reported, and the checker's own `reason`;
 * it never names a target value the checker did not state.
 */
export function fixDirectionFor(spec: StepSpec, a: GradedGate): string {
  const { noun, act } = ARCHETYPE_FIX[spec.archetype] ?? ARCHETYPE_FIX.custom;
  const lead = a.status === 'pending'
    ? `Produce the ${noun} for “${spec.label}” — it has not produced yet, so the acceptance criterion “${a.label}” cannot be derived${reasonClause(a)}.`
    : `Re-produce the ${noun} for “${spec.label}” so it satisfies its acceptance criterion “${a.label}”, which is currently ${a.status}${reasonClause(a)}.`;
  return `${lead} ${act} Change only what that criterion names — keep every other produced field as it is, and invent no value the step's contract does not require.`;
}

/**
 * Neutral, honest remediation copy derived PURELY from the checker result (+ the step's
 * own declared archetype/label) — the generic fallback for the ~330 non-Items steps
 * served by the generic ArchetypeStep, which previously rendered no `why`/`suggestion`/fix
 * at all. It invents no catalog-specific content: the plain-language line is composed from
 * the acceptance `status` (+ the checker's own `reason`, when it returns one), so it can
 * never contradict the row's truth. Bespoke steps override it via `StepSpec.copy`.
 *
 * `spec` is optional so the copy stays usable for a bare acceptance. When given, the
 * `suggestion` PREVIEWS the exact direction the fix button will dispatch — the operator
 * reads what is about to be sent before sending it.
 */
export function genericFixCopy(a: AcceptanceResult, spec?: StepSpec): StepFixCopy {
  const reasonPart = a.reason ? ` — ${a.reason}` : '';
  if (a.status === 'deferred') {
    // Deferred is a CORRECT terminal state (an L3/L4 runtime/visual gate) — not a
    // "you are lost here" failure. Explain it; offer no local produce-fix.
    return {
      why: `This step is deferred to a later gate${reasonPart}.`,
      suggestion: 'A runtime or visual gate proves this — it clears when the gate drain runs, not from this panel.',
    };
  }
  const fixDirection = spec ? fixDirectionFor(spec, a) : undefined;
  const preview = fixDirection ? `Produce fix will dispatch: “${fixDirection}”` : undefined;
  if (a.status === 'pending') {
    return {
      why: `This step hasn't produced its data yet${reasonPart}.`,
      suggestion: preview ?? 'Run Produce to generate it and derive acceptance.',
      fixDirection,
    };
  }
  // fail (or any other non-pass, non-deferred status)
  return {
    why: `This step's acceptance is failing${reasonPart}.`,
    suggestion: preview ?? 'Produce with a corrective direction to move it toward a passing state.',
    fixDirection,
  };
}

/**
 * Merge remediation copy into an acceptance for the StepFrame banner. Uses the step's
 * bespoke `copy` when it has one, else the generic fallback. Attaches nothing on
 * `pass` (so a passing banner stays clean), matching the Items `withCopy` contract.
 *
 * Guarantee: for any non-pass, non-deferred status the returned `fixDirection` is
 * NON-EMPTY — a bespoke `copy` that omits it (or leaves it blank) falls through to the
 * step's `defaultDirection` and then to the derived direction, so the fix button can
 * never dispatch an empty string. `deferred` deliberately keeps none: a runtime/visual
 * gate is not locally fixable and StepFrame offers no button there.
 */
export function withGenericFixCopy(
  spec: StepSpec,
  base: AcceptanceResult,
  data: Record<string, unknown>,
): Acceptance {
  if (base.status === 'pass') return base;
  const copy = spec.copy?.(data) ?? genericFixCopy(base, spec);
  const fixDirection = base.status === 'deferred'
    ? undefined
    : (copy.fixDirection?.trim() || spec.defaultDirection?.trim() || fixDirectionFor(spec, base));
  return { ...base, why: copy.why, suggestion: copy.suggestion || undefined, fixDirection };
}
