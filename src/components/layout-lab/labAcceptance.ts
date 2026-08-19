import type { Checker, AcceptanceTier } from '@/lib/catalog/acceptance/types';
import type { CatalogPipeline } from '@/lib/catalog/stepSpec';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { ITEM_STEP_SPECS } from '@/components/layout-lab/steps/itemsSteps';

/**
 * Per-pipeline `label → accept` index, built once per pipeline object and reused
 * across calls. Keyed by the `CatalogPipeline` instance (WeakMap) so a pipeline
 * re-registered as a new object naturally gets a fresh index and a stale entry
 * can never be served. This turns the rollup's per-step `resolveAccept` calls
 * from an O(steps) linear `.find` each (O(steps²) over a full rollup) into an
 * O(1) Map lookup each (O(steps) total) — with byte-identical results.
 */
const _acceptIndex = new WeakMap<CatalogPipeline, Map<string, Checker>>();

function acceptIndexFor(pipeline: CatalogPipeline): Map<string, Checker> {
  let idx = _acceptIndex.get(pipeline);
  if (!idx) {
    idx = new Map<string, Checker>();
    // Mirror `.find((s) => s.label === step)` semantics: a later step with a
    // duplicate label would have been shadowed by the FIRST match, so only set
    // the first occurrence of each label.
    for (const s of pipeline.steps) if (!idx.has(s.label)) idx.set(s.label, s.accept);
    _acceptIndex.set(pipeline, idx);
  }
  return idx;
}

/**
 * Resolve the acceptance checker for a (catalog, step): a bespoke Items spec takes
 * precedence, and ANY step it does not define falls through to the registered `StepSpec`
 * pipeline of the same id.
 *
 * The fallthrough is the point. Until 2026-08-19 the `items` branch returned `null` for
 * every label outside `ITEM_STEP_SPECS`, which is precedence AND a dead end: the 5
 * registry-only items labels (affix tier tables, base-type/GE wiring, DPS derivation,
 * material, 3D mesh) had no on-screen grader at all, so the 31 persisted rows they carry
 * could not be graded even once the lab started rendering them. Precedence never required
 * the dead end — bespoke still wins every shared label, byte-identically.
 */
export function resolveAccept(catalogId: string, step: string): Checker | null {
  const spec = catalogId === 'items' ? ITEM_STEP_SPECS[step] : undefined;
  if (spec) {
    // ItemStepSpec.accept now shares the Checker signature (data, ctx?); normalize its
    // optional tier/reason to the AcceptanceResult shape the rollup expects, forwarding
    // the optional CheckerContext so a bespoke Items checker can read siblings / links too.
    return (data, ctx) => {
      const result = spec.accept(data, ctx);
      return {
        label: result.label,
        status: result.status,
        tier: (result.tier as AcceptanceTier | undefined) ?? 'L0',
        detail: result.detail,
        ...(result.reason ? { reason: result.reason } : {}),
      };
    };
  }
  const pipeline = getCatalogPipeline(catalogId);
  if (!pipeline) return null;
  return acceptIndexFor(pipeline).get(step) ?? null;
}
