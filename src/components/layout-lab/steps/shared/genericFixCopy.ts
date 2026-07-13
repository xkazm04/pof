import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';
import type { StepFixCopy, StepSpec } from '@/lib/catalog/stepSpec';
import type { Acceptance } from '../StepFrame';

/**
 * Neutral, honest remediation copy derived PURELY from the checker result — the
 * generic fallback for the ~330 non-Items steps served by the generic ArchetypeStep,
 * which previously rendered no `why`/`suggestion`/fix at all. It invents no
 * catalog-specific content: the plain-language line is composed from the acceptance
 * `status` (+ the checker's own `reason`, when it returns one), so it can never
 * contradict the row's truth. Bespoke steps override it via `StepSpec.copy`.
 */
export function genericFixCopy(a: AcceptanceResult): StepFixCopy {
  const reasonPart = a.reason ? ` — ${a.reason}` : '';
  if (a.status === 'deferred') {
    // Deferred is a CORRECT terminal state (an L3/L4 runtime/visual gate) — not a
    // "you are lost here" failure. Explain it; offer no local produce-fix.
    return {
      why: `This step is deferred to a later gate${reasonPart}.`,
      suggestion: 'A runtime or visual gate proves this — it clears when the gate drain runs, not from this panel.',
    };
  }
  if (a.status === 'pending') {
    return {
      why: `This step hasn't produced its data yet${reasonPart}.`,
      suggestion: 'Run Produce to generate it and derive acceptance.',
      fixDirection: a.reason ? `Address the acceptance gap: ${a.reason}` : undefined,
    };
  }
  // fail (or any other non-pass, non-deferred status)
  return {
    why: `This step's acceptance is failing${reasonPart}.`,
    suggestion: 'Produce with a corrective direction to move it toward a passing state.',
    fixDirection: a.reason ? `Correct the failing acceptance: ${a.reason}` : undefined,
  };
}

/**
 * Merge remediation copy into an acceptance for the StepFrame banner. Uses the step's
 * bespoke `copy` when it has one, else the generic fallback. Attaches nothing on
 * `pass` (so a passing banner stays clean), matching the Items `withCopy` contract.
 */
export function withGenericFixCopy(
  spec: StepSpec,
  base: AcceptanceResult,
  data: Record<string, unknown>,
): Acceptance {
  if (base.status === 'pass') return base;
  const copy = spec.copy?.(data) ?? genericFixCopy(base);
  return { ...base, why: copy.why, suggestion: copy.suggestion || undefined, fixDirection: copy.fixDirection };
}
