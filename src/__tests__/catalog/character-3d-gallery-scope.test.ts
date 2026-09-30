import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/character-pipeline';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { appendBatch, emptyHistory, historyData, makeBatch } from '@/components/layout-lab/steps/shared/genHistory';
import { collectStepEvidence } from '@/components/layout-lab/steps/shared/stepEvidence';
import { iconSlug } from '@/lib/visual-gen/generated-icons';
import type { GenAssetRef, StepSpec } from '@/lib/catalog/stepSpec';

/**
 * "The download that graduated": the character pipeline's 3D Generation step used to take
 * EVERY `.glb` on disk, auto-select the first into candidate 0 and grade it `pass` at L1 —
 * then cite that foreign mesh into the next produce prompt as "what the step holds". A mesh
 * now reaches this step only when its filename re-encodes the step's own identity
 * `iconSlug('character-pipeline', '3D Generation')` (the lab's catalogId for this pipeline).
 */

function spec3d(): StepSpec {
  const s = getCatalogPipeline('character-pipeline')?.steps.find((x) => x.label === '3D Generation');
  if (!s?.genCandidates) throw new Error('character-pipeline 3D Generation has no genCandidates');
  return s;
}

/** Exactly the lab's generate loop: build → makeBatch → appendBatch (auto-selects c0) → project. */
function produceWith(assets: GenAssetRef[]): Record<string, unknown> {
  const build = spec3d().genCandidates!.build('hero, braids', 0, assets);
  const batch = makeBatch({ seq: 0, at: '2026-09-28T00:00:00.000Z', direction: 'hero, braids', prompt: 'p', candidates: build });
  return historyData(appendBatch(emptyHistory(), batch));
}

const ref = (base: string): GenAssetRef => ({
  name: `${base} · tripo3d`,
  url: `/api/visual-gen/asset/${base}.glb?dir=tripo3d`,
  slug: base.replace(/_a\d+$/, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase(),
});

const STEP_SLUG = iconSlug('character-pipeline', '3D Generation');

describe('character-pipeline 3D Generation — only its own mesh can fill, pass or be cited', () => {
  it('an unrelated mesh defers at L4 and is cited as nothing', () => {
    const data = produceWith([ref('chair_1759000000')]);
    const r = spec3d().accept(data);
    expect(r.status).toBe('deferred');
    expect(r.tier).toBe('L4');
    expect(r.reason).toBeTruthy();
    expect(JSON.stringify(r)).not.toContain('chair');
    expect(collectStepEvidence(data)).toEqual([]);
  });

  it('a step-scoped mesh still passes and names that mesh (the honest pass stays reachable)', () => {
    expect(STEP_SLUG).toBe('character_pipeline_3d_generation');
    const data = produceWith([ref('chair_1759000000'), ref(STEP_SLUG)]);
    const r = spec3d().accept(data);
    expect(r.status).toBe('pass');
    expect(r.detail).toContain(STEP_SLUG);
    expect(collectStepEvidence(data).map((e) => e.url)).toEqual([`/api/visual-gen/asset/${STEP_SLUG}.glb?dir=tripo3d`]);
  });

  it('a retry-attempt file (_a2) of the step mesh also matches', () => {
    const data = produceWith([ref(`${STEP_SLUG}_a2`)]);
    const r = spec3d().accept(data);
    expect(r.status).toBe('pass');
    expect(r.detail).toContain(`${STEP_SLUG}_a2`);
  });

  it("an entity-scoped mesh never answers for every character (0 glbUrl slots)", () => {
    const build = spec3d().genCandidates!.build('hero', 0, [
      { name: 'character-pipeline__aria__3d_generation · tripo3d', url: '/api/visual-gen/asset/character-pipeline__aria__3d_generation.glb?dir=tripo3d', slug: 'character_pipeline_aria_3d_generation' },
      { name: 'character__aria__3d_generation · tripo3d', url: '/api/visual-gen/asset/character__aria__3d_generation.glb?dir=tripo3d', slug: 'character_aria_3d_generation' },
    ]);
    expect(build).toHaveLength(3);
    expect(build.filter((c) => c.payload.glbUrl !== undefined)).toHaveLength(0);
  });
});
