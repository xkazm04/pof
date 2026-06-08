// Single source of truth for which registered catalog pipelines the data-driven
// walker (catalog-pipeline-walker.spec.ts) deliberately does NOT walk, and why.
// The vitest guard (src/__tests__/catalog/pipeline-e2e-coverage.test.ts) reads the
// SAME map, so a skip is only ever valid with a documented, non-empty reason.
//
// RULE: never skip a pipeline to dodge a real failure. A skip means the pipeline is
// covered better elsewhere, or genuinely cannot be exercised in stub mode (explain
// exactly why). See CLAUDE.md -> "Rule 5 - Every pipeline is e2e-walked".

/** catalogId -> reason it is excluded from the generic walker. */
export const WALKER_SKIP: Record<string, string> = {
  items: 'covered in depth by catalog-items-reference.spec.ts (bespoke 13-step UI)',
  // KNOWN COVERAGE GAP (2026-06-08): player-movement registers a CatalogPipeline but
  // has NO CATALOG_SECTIONS / NEW_CATALOGS entry, so the /layout lab never surfaces it
  // and there is no entity to open. To close the gap, add a NEW_CATALOGS entry
  // (catalogId 'player-movement') with a starter entity whose seed data satisfies the
  // pipeline's accept checkers — then remove this skip. Until then it is uncovered.
  'player-movement': 'orphaned pipeline: registered but absent from CATALOG_SECTIONS/NEW_CATALOGS, so the lab surfaces no entity to walk. Needs a section + starter to be walkable.',
};
