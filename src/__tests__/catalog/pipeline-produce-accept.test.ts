// Fast headless guard: drive every registered catalog pipeline's produce→accept loop
// for its seeded entity and assert the CLAUDE Rule-5 config-complete rule (every step's
// produce drives its accept to pass|deferred, never fail|pending). This is the
// browser-free complement to e2e/catalog-pipeline-walker.spec.ts — it exercises the same
// Produce/Acceptance wiring in ~2s with no dev server (the walker is perf-fragile under
// `npm run dev`), so a wiring regression is caught here even when the heavy lab UI can't
// be walked. (The walker still owns the View-renders/persist/hydrate UI assertions.)
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { seededEntities } from '@/lib/catalog/seed';

const CONFIG_COMPLETE = new Set(['pass', 'deferred']);
// Registered pipelines with no CATALOG_SECTIONS entity (so they can't be walked). Keep in
// lockstep with WALKER_SKIP — adding one here without a section is a known coverage gap.
// (Empty: player-movement was given a section + starter on 2026-06-21.)
const KNOWN_UNSEEDED = new Set<string>([]);

describe('catalog pipelines — headless produce→accept config-complete', () => {
  for (const pipeline of allCatalogPipelines()) {
    const { catalogId, steps } = pipeline;
    const entity = seededEntities(catalogId)[0];

    if (!entity) {
      it(`${catalogId}: has a seeded entity (or is a known gap)`, () => {
        expect(KNOWN_UNSEEDED.has(catalogId), `${catalogId} is registered but has no seeded entity and is not a documented gap`).toBe(true);
      });
      continue;
    }

    it(`${catalogId}: all ${steps.length} steps produce→accept to config-complete`, () => {
      const labEntity = { id: entity.id, name: entity.name, lifecycle: entity.lifecycle, data: entity.data };
      const bad: string[] = [];
      for (const step of steps) {
        let status: string;
        try {
          status = step.accept(step.produce(labEntity).data ?? {}).status;
        } catch (e) {
          bad.push(`${step.label}→THREW(${(e as Error).message.slice(0, 60)})`);
          continue;
        }
        if (!CONFIG_COMPLETE.has(status)) bad.push(`${step.label}→${status}`);
      }
      expect(bad, `${catalogId} non-config-complete steps: ${bad.join(', ')}`).toEqual([]);
    });
  }
});
