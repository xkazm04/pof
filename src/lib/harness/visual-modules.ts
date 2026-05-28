/**
 * Shared source of truth for which catalogs the visual gate exercises.
 *
 * Read by `visual-gate.ts` (generated Playwright script) and by Phase-2 gallery
 * UI when surfacing per-module rows. The list is intentionally narrow — the
 * gate is meant to catch *broad* layout regressions, not exhaustively click
 * every entity. Add a slug here when its catalog matters enough to screenshot
 * every iteration.
 *
 * The slug MUST match the `catalogId` exposed by `CATALOG_SECTIONS` in
 * `src/lib/catalog/sections.ts` so the data-testid wiring in `CatalogTree`
 * (`data-testid="harness-catalog-{catalogId}"`) is automatically aligned.
 */
export interface VisualModule {
  /** Stable id; doubles as catalogId for click locator. Lowercase, hyphenated. */
  slug: string;
  /** Human-readable label shown in the gallery + result.json. */
  label: string;
}

export const VISUAL_GATE_MODULES: readonly VisualModule[] = [
  { slug: 'items', label: 'Items' },
  { slug: 'spellbook', label: 'Spellbook' },
  { slug: 'enemies', label: 'Enemies' },
  { slug: 'achievements', label: 'Achievements' },
  { slug: 'biomes', label: 'Biomes' },
] as const;

/** The test-id pattern wired into CatalogTree. Kept here so the gate + UI stay in sync. */
export const HARNESS_CATALOG_TESTID = (catalogId: string): string => `harness-catalog-${catalogId}`;
/** Test-id placed on the lab so the gate can wait until the shell is interactive. */
export const HARNESS_LAB_READY_TESTID = 'harness-lab-ready';
