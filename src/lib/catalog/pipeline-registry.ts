import type { CatalogPipeline } from './stepSpec';

const _registry = new Map<string, CatalogPipeline>();

/** Called at module load by each src/lib/catalog/pipelines/<id>.ts file. */
export function registerCatalogPipeline(pipeline: CatalogPipeline): void {
  _registry.set(pipeline.catalogId, pipeline);
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
