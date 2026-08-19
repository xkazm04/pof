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
  // items has TWO specs (see ITEMS_SPEC_DUALITY in src/components/layout-lab/catalogManifest.ts):
  // the lab renders the ORDERED UNION — the 13 bespoke step UIs first, then the 5 registry-only
  // labels routed to the generic ArchetypeStep (2026-08-19: those five carried 31 of the
  // catalog's 90 persisted rows while having no screen at all). The generic walker enumerates
  // the 11-label registry spec only, which would MISS the 7 bespoke-only steps, so the union is
  // walked in depth by the reference spec instead and the bespoke produce/accept pair is linted
  // by src/__tests__/catalog/items-spec-duality.test.ts.
  items: 'the lab renders the UNION of both items specs (13 bespoke step UIs + the 5 registry-only labels), which the generic 11-label walk would not cover; walked in depth by catalog-items-reference.spec.ts + linted by src/__tests__/catalog/items-spec-duality.test.ts',
  // player-movement is no longer skipped (2026-06-21): it now has a NEW_CATALOGS section +
  // starter (Manny Locomotion), and its bridge steps are L3/L4-deferred-to-the-bridge in
  // stub mode (config-complete), so the generic walker covers it like any other pipeline.
};
