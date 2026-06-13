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

/** Resolve the acceptance checker for a (catalog, step): bespoke Items specs, else a registered StepSpec pipeline. */
export function resolveAccept(catalogId: string, step: string): Checker | null {
  if (catalogId === 'items') {
    const spec = ITEM_STEP_SPECS[step];
    if (!spec) return null;
    // ItemStepSpec.accept now shares the Checker signature (data); normalize its
    // optional tier/reason to the AcceptanceResult shape the rollup expects.
    return (data: Record<string, unknown>) => {
      const result = spec.accept(data);
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
