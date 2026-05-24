'use client';

export function CatalogsTabPlaceholder() {
  return (
    <div className="flex-1 p-8 overflow-auto">
      <h1 className="text-2xl font-bold text-text mb-2">Catalogs</h1>
      <p className="text-text-muted">The entity-centric creative surface lands in Phases 2 + 3.</p>
      <ul className="mt-4 text-sm text-text-muted/80 list-disc list-inside space-y-1">
        <li>Phase 2 — Entity Inspector primitive</li>
        <li>Phase 3 — Catalog Hub + per-catalog detail</li>
        <li>Phase 7-8 — module migration into catalog facets</li>
        <li>Phase 10 — per-catalog KEEP-ENHANCE ideas (~67)</li>
      </ul>
    </div>
  );
}
