'use client';

/**
 * Per-catalog custom-facets tab strip. Empty placeholder for Phase 2 — Phase 7
 * (module migration A) introduces a `facetRegistry` keyed by catalogId that
 * maps to arrays of custom facet definitions (e.g. ArchetypesTab radar for
 * bestiary, ComboChainDiagram for combat-map). This component then renders the
 * registered facets as additional tabs below the generic panels above.
 */
export function EntityFacetsTabStrip() {
  return (
    <section className="px-4 py-3" role="tabpanel" aria-label="Per-catalog facets">
      <span className="text-xs font-mono uppercase tracking-wider text-text-muted">Facets</span>
      <p className="text-2xs text-text-muted/60 italic mt-1">
        Per-catalog custom facets (stat bars · radar · graph views · timelines) land in Phase 7.
      </p>
    </section>
  );
}
