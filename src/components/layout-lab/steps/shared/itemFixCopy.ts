import { fixDirectionFor, genericFixCopy } from './genericFixCopy';
import { ITEM_STEP_COPY } from '../itemsSteps';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { Acceptance } from '../StepFrame';

/**
 * The bespoke Items steps carry no `StepSpec`; `fixDirectionFor` / `genericFixCopy` read
 * only `archetype` + `label` from one. Single-sourcing the derived corrective prose with
 * the generic path is deliberate — the fix instruction must not fork between the reference
 * pipeline and the ~330 generic steps. `custom` is the honest archetype: an Items step
 * declares none, and `custom`'s authored act ("re-run the step so it writes the fields its
 * checker actually reads") invents no catalog content.
 */
function minimalSpec(step: string): StepSpec {
  const partial: Pick<StepSpec, 'archetype' | 'label'> = { archetype: 'custom', label: step };
  return partial as StepSpec;
}

/**
 * Merge remediation copy into the RESOLVED verdict of a bespoke Items step — the
 * counterpart to {@link withGenericFixCopy}, applied in the same POSITION the generic
 * renderer applies it: on the output of `useStepAcceptance` (checker → server drain overlay
 * → judge bridge), never inside `accept`.
 *
 * ── Why this exists ────────────────────────────────────────────────────────────
 * `itemsSteps.ts`'s `withCopy` runs INSIDE `accept` and returns early on `pass`, so the
 * plain-language `why` / `suggestion` / `fixDirection` are computed BEFORE the overlay and
 * the judge can move the status. When either down-graded a bespoke step, the banner
 * rendered a bare FAIL/DEFERRED with a terse `detail` — and because `StepFrame` nests the
 * "⚡ Produce fix" button inside `{acceptance.why && …}`, the step lost its one-click
 * remediation entirely. This closes that gap for both bespoke frames.
 *
 * ── Which copy is used ─────────────────────────────────────────────────────────
 * `base.why` is present exactly when the step's OWN checker graded non-pass (that is the
 * only path on which `withCopy` attaches copy) — so it still describes what the banner
 * says, and is kept verbatim.
 *
 * When it is absent the status was moved by the judge bridge (which only ever down-grades a
 * checker `pass`) or the drain overlay. The bespoke `ITEM_STEP_COPY` bodies are authored
 * against the step's `data` for a CHECKER failure, so applying one here would misdescribe
 * the verdict — a 450-char brief called "too short" because a VLM failed its icon. The
 * reason-bearing {@link genericFixCopy} is composed purely from the resolved status plus
 * the winning layer's own `reason`, so it cannot contradict the verdict. This is the same
 * conclusion `StepSpec.copy`'s retirement note reaches for the generic path.
 *
 * `ITEM_STEP_COPY` is still consulted for the one remaining case — a non-pass verdict that
 * carries no `why` AND no `reason`, i.e. nothing for the generic line to name.
 *
 * Guarantees (both asserted by test):
 *  - **Display only.** Every graded field (`status`, `tier`, `label`, `detail`, `reason`,
 *    `judge`) is passed through untouched; this can provably not move a verdict.
 *  - **The fix direction is never empty** for a fixable status: `copy.fixDirection` →
 *    the step's `defaultDirection` → the derived `fixDirectionFor`. `deferred` keeps none —
 *    a runtime/visual gate is not locally fixable, and the frames pass no `onFix` there.
 */
export function withItemFixCopy(
  step: string,
  data: Record<string, unknown>,
  base: Acceptance,
  defaultDirection?: string,
): Acceptance {
  if (base.status === 'pass') return base;
  const gate = base as AcceptanceResult;
  const spec = minimalSpec(step);
  const copy = base.why != null
    ? { why: base.why, suggestion: base.suggestion, fixDirection: base.fixDirection }
    : (gate.reason ? genericFixCopy(gate, spec) : (ITEM_STEP_COPY[step]?.(data) ?? genericFixCopy(gate, spec)));
  const fixDirection = base.status === 'deferred'
    ? undefined
    : (copy.fixDirection?.trim() || defaultDirection?.trim() || fixDirectionFor(spec, gate));
  return { ...base, why: copy.why, suggestion: copy.suggestion || undefined, fixDirection };
}
