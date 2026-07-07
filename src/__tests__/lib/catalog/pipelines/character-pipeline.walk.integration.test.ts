import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/character-pipeline';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * Headless walk of the character-pipeline row against a RUNNING app: replays each
 * step's produce() and POSTs the payload to /api/pipeline-artifacts, where the
 * SERVER re-grades it with the step's own checker (a client can never persist a
 * fabricated pass) — populating the /status swimlane with honest truth.
 *
 * SKIPPED by default (network). Enable against a live dev server:
 *   POF_WALK_APP_ORIGIN=http://localhost:3002 npx vitest run \
 *     src/__tests__/lib/catalog/pipelines/character-pipeline.walk.integration.test.ts
 */
const ORIGIN = process.env.POF_WALK_APP_ORIGIN;

describe.skipIf(!ORIGIN)('character-pipeline headless walk (produce → server-graded artifacts)', () => {
  it('walks every step; server grades pass (L0-L2) or deferred (L3/L4), never fabricated', async () => {
    const pipeline = getCatalogPipeline('character-pipeline');
    expect(pipeline).not.toBeNull();
    const entity = { id: 'char-pipeline-jinx', name: 'Jinx' } as unknown as LabEntity;

    const graded: Array<{ step: string; status: string; tier?: string }> = [];
    for (const step of pipeline!.steps) {
      const out = step.produce(entity);
      const res = await fetch(`${ORIGIN}/api/pipeline-artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogId: 'character-pipeline',
          entityId: 'char-pipeline-jinx',
          step: step.label,
          data: out.data ?? {},
          ueAssets: out.ueAssets ?? [],
          status: 'pending', // discarded: the server re-grades with the registered checker
        }),
      });
      expect(res.ok).toBe(true);
      const json = (await res.json()) as { data?: { status: string; tier?: string } };
      graded.push({ step: step.label, status: json.data?.status ?? '?', tier: json.data?.tier });
    }

    // Every step must land a walker-legal terminal status from the SERVER's grading.
    for (const g of graded) {
      expect(['pass', 'deferred'], `${g.step} → ${g.status}`).toContain(g.status);
    }
    const deferred = graded.filter((g) => g.status === 'deferred').map((g) => g.step);
    expect(deferred).toEqual(['Playable Wire', 'Visual Gate']); // honest L3/L4 waits
  });
});
