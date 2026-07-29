import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { CATALOG_SECTIONS, seedAllCatalogs } from '@/lib/catalog/sections';
// Relative import (no @/ for an e2e helper): src/__tests__/catalog -> repo-root e2e/helpers.
import { WALKER_SKIP } from '../../../e2e/helpers/pipeline-coverage';
import { readWalkStatus } from '../../../e2e/helpers/walk-status';

/**
 * Gap guard (runs in `npm run validate`). Fails fast when a registered catalog
 * pipeline has no way to be exercised end-to-end by the Playwright walker:
 * no catalog section, no seeded entity, or an undocumented skip. Because the
 * walker enumerates `allCatalogPipelines()`, a NEW pipeline is auto-covered the
 * moment it self-registers — this guard makes "added a pipeline with no e2e path"
 * a red `validate` instead of a silently-skipped e2e.
 */
describe('catalog-pipeline e2e coverage guard', () => {
  const pipelines = allCatalogPipelines();
  const seeded = seedAllCatalogs(); // { [catalogId]: { [entityId]: entity } }
  const sectionIds = new Set(CATALOG_SECTIONS.map((s) => s.catalogId));
  const isSkipped = (id: string) => WALKER_SKIP[id] !== undefined;

  it('finds every registered pipeline (sanity: registry is non-empty)', () => {
    expect(pipelines.length).toBeGreaterThan(0);
  });

  // A pipeline is "covered" iff it is NOT skipped AND the lab can surface + open it.
  // A documented WALKER_SKIP entry is the only sanctioned exception (e.g. covered by a
  // bespoke spec, or a known orphan), and it must carry a non-empty reason.

  it('every NON-skipped pipeline has a catalog section so the walker can find it', () => {
    const missing = pipelines
      .map((p) => p.catalogId)
      .filter((id) => !isSkipped(id) && !sectionIds.has(id));
    expect(missing, `pipelines with no CATALOG_SECTIONS entry (add a section or a documented WALKER_SKIP): ${missing.join(', ')}`).toEqual([]);
  });

  it('every NON-skipped pipeline has >=1 seeded entity so the lab can open one', () => {
    const empty = pipelines
      .map((p) => p.catalogId)
      .filter((id) => !isSkipped(id) && Object.keys(seeded[id] ?? {}).length === 0);
    expect(empty, `pipelines with no seeded entity (add a seed or a documented WALKER_SKIP): ${empty.join(', ')}`).toEqual([]);
  });

  it('every WALKER_SKIP entry has a non-empty documented reason', () => {
    for (const [id, reason] of Object.entries(WALKER_SKIP)) {
      expect(reason.trim().length, `WALKER_SKIP['${id}'] must have a non-empty reason`).toBeGreaterThan(0);
    }
  });

  it('WALKER_SKIP has no stale entries (every key is a real registered pipeline)', () => {
    const ids = new Set(pipelines.map((p) => p.catalogId));
    const stale = Object.keys(WALKER_SKIP).filter((id) => !ids.has(id));
    expect(stale, `WALKER_SKIP references unknown catalogs: ${stale.join(', ')}`).toEqual([]);
  });

  // ── Walk-success signal ────────────────────────────────────────────────────
  // Registration hygiene (above) proves a pipeline COULD be walked. It cannot notice a
  // walker that has rotted — a pipeline whose walk now fails, or one added after the last
  // full run. `e2e/walk-status.json` is written by the walker itself after a FULL green run
  // and committed; reading it back here makes "never actually walked" a red `validate`.
  describe('walk-success signal (e2e/walk-status.json)', () => {
    const status = readWalkStatus();
    const RERUN = 'Run the walker (`npm run test:e2e -- e2e/catalog-pipeline-walker.spec.ts`); a full green run rewrites e2e/walk-status.json.';

    it('exists — the walker has been run at least once and recorded its result', () => {
      expect(status, `e2e/walk-status.json is missing or unreadable. ${RERUN}`).not.toBeNull();
    });

    it('records a green walk for every non-skipped registered pipeline', () => {
      if (!status) return; // reported by the test above
      const walked = new Set(status.walked);
      const unwalked = pipelines.map((p) => p.catalogId).filter((id) => !isSkipped(id) && !walked.has(id));
      expect(
        unwalked,
        `pipelines with no recorded green e2e walk: ${unwalked.join(', ')}. ${RERUN}`,
      ).toEqual([]);
    });

    it('was recorded against the current WALKER_SKIP set (no silently-skipped pipeline)', () => {
      if (!status) return;
      expect(
        Object.keys(status.skipped).sort(),
        `e2e/walk-status.json was recorded with a different WALKER_SKIP set. ${RERUN}`,
      ).toEqual(Object.keys(WALKER_SKIP).sort());
    });
  });
});
