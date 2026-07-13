import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated'; // side-effect: register all pipelines
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { catalogManifest, hasStepGrader } from '@/components/layout-lab/catalogManifest';

/**
 * Manifest desync guard (runs in `npm run validate`). Mirrors the spirit of
 * pipeline-e2e-coverage: making a catalog functional used to require coordinated
 * edits across four decentralized sources (section, steps, grader, bespoke UI)
 * with nothing tying them together. The `catalogManifest` resolver now unifies
 * them; this guard fails fast when they drift apart — a catalog that surfaces
 * graded steps must have a section AND a grader for every step it renders.
 */
describe('catalog manifest coverage guard', () => {
  const pipelines = allCatalogPipelines();
  const sectionIds = new Set(CATALOG_SECTIONS.map((s) => s.catalogId));

  it('resolves a non-empty manifest for every registered pipeline (sanity)', () => {
    expect(pipelines.length).toBeGreaterThan(0);
    for (const p of pipelines) {
      expect(catalogManifest(p.catalogId).steps.length, `${p.catalogId} resolved 0 steps`).toBeGreaterThan(0);
    }
  });

  it('every registered pipeline has a catalog section (steps but no section = desync)', () => {
    const missing = pipelines.map((p) => p.catalogId).filter((id) => !sectionIds.has(id));
    expect(missing, `pipelines with no CATALOG_SECTIONS entry: ${missing.join(', ')}`).toEqual([]);
  });

  it('every graded (bespoke/registry) catalog has a grader for each of its steps', () => {
    const offenders: string[] = [];
    for (const s of CATALOG_SECTIONS) {
      const m = catalogManifest(s.catalogId);
      // Ungraded track fallback (no registered pipeline) legitimately has no per-step grader.
      if (m.stepSource === 'fallback') continue;
      if (!m.section) offenders.push(`${s.catalogId}: manifest lost its section`);
      const ungraded = m.steps.filter((step) => !hasStepGrader(s.catalogId, step));
      if (ungraded.length) offenders.push(`${s.catalogId}: steps without a grader — ${ungraded.join(', ')}`);
    }
    expect(offenders, offenders.join(' | ')).toEqual([]);
  });

  it('bespoke catalogs render their curated fine steps, overriding any same-id registry pipeline', () => {
    // Items has BOTH a bespoke UI and a registered `items` StepSpec pipeline; the
    // manifest must pick the bespoke fine steps, or the rail and matrix drift.
    const items = catalogManifest('items');
    expect(items.bespoke).toBe(true);
    expect(items.stepSource).toBe('bespoke');
    expect(items.steps).toContain('Concept Brief');
    expect(items.steps).toContain('Attributes'); // a bespoke-only label absent from the registry pipeline
  });
});
