import { sourcedGuard } from './acceptance/sourced';
import { templateGuard } from './acceptance/template';
import type { CatalogPipeline } from './stepSpec';

const _registry = new Map<string, CatalogPipeline>();

/**
 * Called at module load by each src/lib/catalog/pipelines/<id>.ts file.
 *
 * Every step's checker is wrapped ONCE here with the SOURCED guard (`acceptance/sourced.ts`): a step
 * artifact seeded from a reference source can never grade `pass` — and with the TEMPLATE guard
 * (`acceptance/template.ts`): a data-blind stub written for a non-exemplar entity can't either.
 * Registration is the one place every grading path reads `accept` from, so neither guard can be
 * bypassed by any of them. `produce` is NOT wrapped: the stamp is added at the stub write sites.
 */
export function registerCatalogPipeline(pipeline: CatalogPipeline): void {
  _registry.set(pipeline.catalogId, {
    ...pipeline,
    steps: pipeline.steps.map((s) => ({ ...s, accept: templateGuard(sourcedGuard(s.accept)) })),
  });
}

export function getCatalogPipeline(catalogId: string): CatalogPipeline | null {
  return _registry.get(catalogId) ?? null;
}

export function allCatalogPipelines(): CatalogPipeline[] {
  return [..._registry.values()];
}

/** Test-only reset. */
export function _resetRegistry(): void {
  _registry.clear();
}
