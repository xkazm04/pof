import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * Generic headless replay: re-runs SPECIFIC steps' produce() against a RUNNING app so
 * the server re-grades the fresh data with the registered checker (fabricated pass is
 * impossible). Use after fixing a step's content to refresh its persisted artifact.
 *
 * SKIPPED by default. Enable + scope via env:
 *   POF_WALK_APP_ORIGIN=http://localhost:3002 \
 *   POF_REPLAY_SPECS='[{"catalogId":"music","entityId":"music-combat-a","name":"Combat Theme A","steps":["Streaming Budget"]}]' \
 *   npx vitest run src/__tests__/lib/catalog/pipelines/replay.walk.integration.test.ts
 */
const ORIGIN = process.env.POF_WALK_APP_ORIGIN;
const SPECS = process.env.POF_REPLAY_SPECS;

interface ReplaySpec { catalogId: string; entityId: string; name: string; steps: string[] }

describe.skipIf(!ORIGIN || !SPECS)('replay walk (fixed steps → server re-grade)', () => {
  it('replays each spec step; server grading lands pass or deferred', async () => {
    const specs = JSON.parse(SPECS!) as ReplaySpec[];
    const results: Array<{ key: string; status: string }> = [];
    for (const spec of specs) {
      const pipeline = getCatalogPipeline(spec.catalogId);
      expect(pipeline, spec.catalogId).not.toBeNull();
      const entity = { id: spec.entityId, name: spec.name } as unknown as LabEntity;
      for (const stepLabel of spec.steps) {
        const step = pipeline!.steps.find((s) => s.label === stepLabel);
        expect(step, `${spec.catalogId}::${stepLabel}`).toBeDefined();
        const out = step!.produce(entity);
        const res = await fetch(`${ORIGIN}/api/pipeline-artifacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            catalogId: spec.catalogId,
            entityId: spec.entityId,
            step: stepLabel,
            data: out.data ?? {},
            ueAssets: out.ueAssets ?? [],
            status: 'pending', // discarded — server re-grades
          }),
        });
        expect(res.ok).toBe(true);
        const json = (await res.json()) as { data?: { status: string } };
        results.push({ key: `${spec.catalogId}::${stepLabel}`, status: json.data?.status ?? '?' });
      }
    }
    for (const r of results) {
      expect(['pass', 'deferred'], `${r.key} → ${r.status}`).toContain(r.status);
    }
    console.error('replayed:', results.map((r) => `${r.key}=${r.status}`).join(' · '));
  });
});
