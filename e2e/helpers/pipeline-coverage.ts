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
  // the lab renders the bespoke 13-step UI, never the 11-label registry pipeline the generic
  // walker would enumerate. Walking it generically would grade steps nobody can see, so the
  // 13 on-screen steps are walked in depth by the reference spec instead, and the bespoke
  // produce/accept pair is linted by src/__tests__/catalog/items-spec-duality.test.ts.
  items: 'the lab renders the bespoke 13-step UI (not the 11-label registry pipeline); walked in depth by catalog-items-reference.spec.ts + linted by src/__tests__/catalog/items-spec-duality.test.ts',
  // player-movement is no longer skipped (2026-06-21): it now has a NEW_CATALOGS section +
  // starter (Manny Locomotion), and its bridge steps are L3/L4-deferred-to-the-bridge in
  // stub mode (config-complete), so the generic walker covers it like any other pipeline.
};
