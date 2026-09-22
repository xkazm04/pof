// /diablo W05 (decision D18): a step may be scoped to canon profiles. A prerendered-sprite render
// means nothing for a 3D game's monsters and the chassis has no "not applicable" status, so the
// step is simply not part of their pipeline — resolved in ONE place and honoured everywhere.
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { stepAppliesTo, stepLabelsForProfile, stepsForProfile } from '@/lib/catalog/stepScope';
import { buildMatrixRows } from '@/components/layout-lab/matrixRows';
import { SPRITE_PROJECTION } from '@/lib/catalog/acceptance/spriteCheckers';

const bestiary = getCatalogPipeline('bestiary')!;
const sprite = bestiary.steps.find((s) => s.label === 'Sprite Render')!;

describe('stepScope', () => {
  it('an unscoped step applies to every profile; a scoped one only to its own', () => {
    expect(stepAppliesTo({}, 'diablo1')).toBe(true);
    expect(stepAppliesTo({}, undefined)).toBe(true);
    expect(stepAppliesTo(sprite, 'diablo1')).toBe(true);
    expect(stepAppliesTo(sprite, 'pof')).toBe(false);
    expect(stepAppliesTo(sprite, undefined)).toBe(false); // no profile = the project's own
  });

  it('PoF entities keep exactly the step lists they had — only scoped steps drop out', () => {
    for (const p of allCatalogPipelines()) {
      const unscoped = p.steps.filter((s) => !s.profiles?.length).map((s) => s.label);
      expect(stepsForProfile(p).map((s) => s.label)).toEqual(unscoped);
    }
  });

  it('a diablo1 bestiary entity has Sprite Render right after 3D & Rig', () => {
    const labels = stepsForProfile(bestiary, 'diablo1').map((s) => s.label);
    expect(labels.indexOf('Sprite Render')).toBe(labels.indexOf('3D & Rig') + 1);
    expect(labels.length).toBe(stepsForProfile(bestiary).length + 1);
  });

  it('label filtering keeps labels the pipeline does not know (bespoke steps are never dropped)', () => {
    expect(stepLabelsForProfile(bestiary, ['Stat Block', 'Sprite Render', 'Some Bespoke'], 'pof')).toEqual(['Stat Block', 'Some Bespoke']);
    expect(stepLabelsForProfile(null, ['a', 'b'], 'pof')).toEqual(['a', 'b']);
  });
});

describe('the matrix honours the scope per entity', () => {
  const labels = bestiary.steps.map((s) => s.label);
  const rows = buildMatrixRows('bestiary', [
    { id: 'pof-brute', name: 'Brute', lifecycle: 'planned', data: {} },
    { id: 'd1-z', name: 'Zombie', lifecycle: 'planned', data: {}, canonProfile: 'diablo1' },
  ], new Map(), {}, labels);

  it('a PoF entity does not have the step, and opens later steps at ITS OWN index', () => {
    const [pof, d1] = rows;
    expect(pof.applies('Sprite Render')).toBe(false);
    expect(d1.applies('Sprite Render')).toBe(true);
    // UE Packaging sits after Sprite Render in the catalog list — one earlier for the PoF entity.
    expect(pof.stepIndex('UE Packaging')).toBe(d1.stepIndex('UE Packaging') - 1);
    expect(pof.rollup.total).toBe(d1.rollup.total - 1); // its completion is counted over its OWN steps
  });
});

describe('Sprite Render grades what the render records', () => {
  const accept = sprite.accept;
  const ctx = { catalog: 'bestiary', siblings: {}, has: () => true, canonProfile: 'diablo1' };
  const eight = Array.from({ length: 8 }, (_, i) => `dir${i}`);

  it('a requested-but-unrendered set defers with the command that runs it (never pending, never pass)', () => {
    const r = accept(sprite.produce({ id: 'd1-z', name: 'Zombie', lifecycle: 'planned', data: {} }, 'walk frame 12, 64px').data, ctx);
    expect(r.status).toBe('deferred');
    expect(r.reason).toMatch(/scripts\/diablo\/render\.ts/);
  });

  it('the direction is a real request: frame size and pose land on the artifact', () => {
    const d = sprite.produce({ id: 'd1-z', name: 'Zombie', lifecycle: 'planned', data: {} }, 'walk frame 12, 64px').data as { sprites: Record<string, unknown> };
    expect(d.sprites.frameSize).toBe(64);
    expect(d.sprites.requestedPose).toBe('walk frame 12, 64px');
  });

  it('8 directions from the canon camera pass; a wrong projection FAILS', () => {
    expect(accept({ sprites: { directions: eight, camera: { ...SPRITE_PROJECTION }, frameSize: 96 } }, ctx).status).toBe('pass');
    expect(accept({ sprites: { directions: eight, camera: { ...SPRITE_PROJECTION, elevationDeg: 45 }, frameSize: 96 } }, ctx).status).toBe('fail');
    expect(accept({ sprites: { directions: eight.slice(0, 5), camera: { ...SPRITE_PROJECTION }, frameSize: 96 } }, ctx).status).toBe('pending');
  });
});
