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
  // player-movement is no longer skipped (2026-06-21): it now has a NEW_CATALOGS section +
  // starter (Manny Locomotion), and its bridge steps are L3/L4-deferred-to-the-bridge in
  // stub mode (config-complete), so the generic walker covers it like any other pipeline.
};
