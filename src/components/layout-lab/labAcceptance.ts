import type { Checker, AcceptanceTier } from '@/lib/catalog/acceptance/types';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { ITEM_STEP_SPECS } from '@/components/layout-lab/steps/itemsSteps';

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
  return getCatalogPipeline(catalogId)?.steps.find((s) => s.label === step)?.accept ?? null;
}
