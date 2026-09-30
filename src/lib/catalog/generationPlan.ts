import { STEP_TO_LIFECYCLE, type GenerationStep } from '@/lib/catalog/recipe';
import type { LifecycleState } from '@/lib/catalog/types';

/**
 * What a catalog entity's generation recipe runs NEXT, and why a recipe callback's
 * requested lifecycle was held. Pure — no DB, no React.
 *
 * One lifecycle writer: `catalog_lifecycle.lifecycle` is the DERIVATION
 * (`syncEntityLifecycle`, headless.ts) — the recipe callback records evidence and
 * never walks a ladder of its own. So the step a cell offers is derived from the
 * recipe's own step list, never a hand-copied lifecycle ternary.
 */

const ORDER: readonly LifecycleState[] = ['planned', 'scaffolded', 'generated', 'wired', 'verified'];

/**
 * The recipe step to dispatch next for an entity at `lifecycle`, or null when no step
 * may be dispatched. THE one next-step rule (the Screen Flow tab's `nextRecipeStep`
 * delegates here):
 * - the FIRST step of `steps` whose target (STEP_TO_LIFECYCLE) ranks above
 *   `lifecycle` — so it is always a member of the recipe's own steps;
 * - 'verified' → null (nothing left; re-running cannot raise a proven entity);
 * - 'failed' → null (the derivation is 'failed' because a persisted artifact FAILED
 *   acceptance; a recipe callback records ueAssets, never artifacts, so a re-run from
 *   here cannot clear it — an offered button would be a no-op forever);
 * - null too when no step of `steps` advances past `lifecycle`.
 */
export function nextGenerationStep(
  steps: readonly GenerationStep[],
  lifecycle: LifecycleState,
): GenerationStep | null {
  if (lifecycle === 'verified' || lifecycle === 'failed') return null;
  const at = ORDER.indexOf(lifecycle);
  return steps.find((s) => ORDER.indexOf(STEP_TO_LIFECYCLE[s]) > at) ?? null;
}

/** The derivation a transition is measured against (an `EntityLifecycleView` fits). */
export interface DerivedOutcome {
  lifecycle: LifecycleState;
  evidence: { summary: string };
}

/**
 * The `held` sentence for a recipe callback: why the persisted lifecycle is not what
 * the step asked for — or undefined when the derivation reached (or passed) it.
 * `derived` is null when the catalog registers no pipeline (nothing to derive from).
 */
export function transitionOutcome(
  requested: LifecycleState,
  derived: DerivedOutcome | null,
): string | undefined {
  if (!derived) {
    return `no pipeline is registered for this catalog, so there is nothing to derive a lifecycle from — ueAssets recorded, lifecycle unchanged (requested '${requested}').`;
  }
  const got = derived.lifecycle;
  if (got === requested) return undefined;
  const gi = ORDER.indexOf(got);
  const ri = ORDER.indexOf(requested);
  if (gi >= 0 && ri >= 0 && gi > ri) return undefined;
  const why = requested === 'verified'
    ? "'verified' needs a drained L3/L4 gate that passes — a session-reported test result is not one"
    : 'the lifecycle is derived from persisted pipeline artifacts, not from the step that ran';
  return `held at '${got}' (requested '${requested}'): ${why}. ${derived.evidence.summary}`;
}
