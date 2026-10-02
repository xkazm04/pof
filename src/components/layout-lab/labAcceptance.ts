import type { Checker, AcceptanceTier } from '@/lib/catalog/acceptance/types';
import type { CatalogPipeline } from '@/lib/catalog/stepSpec';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { ITEM_STEP_SPECS } from '@/components/layout-lab/steps/itemsSteps';
import { itemsLabelOwner } from '@/components/layout-lab/itemsLabelOwner';

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
 * Resolve the acceptance checker for a (catalog, step) in the SERVER's order
 * (`headless.serverCheckerFor`): the registered `StepSpec` pipeline owns every label it
 * declares, and a bespoke Items spec grades only the labels the registry does not declare
 * (`itemsLabelOwner`, the same owner that routes the step's component and its produce).
 *
 * Until 2026-09-29 this was bespoke-first — the opposite precedence — so the six labels both
 * items specs declare had two graders: 15 of 36 live shared-label rows read differently in the
 * lab than on the server. Mostly LOWER (a registry-shaped Tooltip the server passes read
 * `pending`), but on bespoke-shaped data HIGHER (the unguarded bespoke Economy checker passed
 * the exemplar stub `{power:102,…}` the server holds `pending`). The lab may only come DOWN to
 * the server's reading, never up, so a registry-owned label has NO bespoke fallback. The
 * registry-only fallthrough (2026-08-19: 5 labels, 31 rows that had no on-screen grader) stays.
 */
export function resolveAccept(catalogId: string, step: string): Checker | null {
  const spec = catalogId === 'items' && itemsLabelOwner(step) === 'bespoke' ? ITEM_STEP_SPECS[step] : undefined;
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
