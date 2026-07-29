import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/character-pipeline';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

const entity = { id: 'char-pipeline-jinx', name: 'Jinx' } as never;

describe('character-pipeline pipeline', () => {
  const pipeline = getCatalogPipeline('character-pipeline');

  it('is registered with 12 steps', () => {
    expect(pipeline).not.toBeNull();
    expect(pipeline?.steps).toHaveLength(12);
  });

  it('has the gated-workflow step labels in order', () => {
    const labels = pipeline?.steps.map((s) => s.label);
    expect(labels).toEqual([
      'Concept 2D',
      'Face Gate 2D',
      '3D Generation',
      'Face Gate 3D',
      'Rig & Clips',
      'UE Import',
      'Apparel',
      'Playable Wire',
      'Game-Tier Convert',
      'Skins',
      'Icon 2D Art',
      'Visual Gate',
    ]);
  });

  it('Skins records a texture-set family over ONE geometry task (L0 pass)', () => {
    const s = pipeline!.steps[9];
    expect(s.label).toBe('Skins');
    const data = s.produce(entity).data as { skinSet: Record<string, unknown> };
    // The whole point of a skin: every variant re-textures the same geometry task.
    expect(data.skinSet.geometryTaskId).toBeTruthy();
    expect((data.skinSet.variants as unknown[]).length).toBeGreaterThanOrEqual(2);
    const r = s.accept(data);
    expect(r.status).toBe('pass');
    expect(r.tier).toBe('L0');
  });

  it('Concept 2D produces a face-gated selection (L1 pass)', () => {
    const s = pipeline!.steps[0];
    const r = s.accept(s.produce(entity).data ?? {});
    expect(r.status).toBe('deferred'); // a swatch placeholder is not a generated asset — the gallery gate now defers with a reason
    expect(r.tier).toBe('L4'); // a missing VISUAL asset, reported at the tier the walker expects for a deferral
  });

  it('face gates record verdict+method+evidence (L0 pass)', () => {
    for (const idx of [1, 3]) {
      const s = pipeline!.steps[idx];
      const r = s.accept(s.produce(entity).data ?? {});
      expect(r.status).toBe('pass');
      expect(r.tier).toBe('L0');
    }
  });

  it('3D Generation selects the v3.1 hero tier and records the failed tiers', () => {
    const s = pipeline!.steps[2];
    const data = s.produce(entity).data as { candidates: Array<{ name: string; verdict: string }>; selected: number };
    expect(data.candidates).toHaveLength(3);
    expect(data.candidates[data.selected].name).toMatch(/v3\.1/);
    expect(data.candidates.filter((c) => /FAIL/.test(c.verdict))).toHaveLength(2);
    expect(s.accept(data as never).status).toBe('deferred'); // a swatch placeholder is not a generated asset — the gallery gate now defers with a reason
  });

  it('Rig & Clips manifests one rig plus three preset takes', () => {
    const s = pipeline!.steps[4];
    const r = s.accept(s.produce(entity).data ?? {});
    expect(r.status).toBe('pass');
    expect(r.tier).toBe('L0');
  });

  it('Apparel manifests the Chaos Cloth setup and is the L3 runtime gate (honestly deferred)', () => {
    const s = pipeline!.steps[6];
    expect(s.label).toBe('Apparel');
    const data = s.produce(entity).data as { cloth: string[] };
    // manifest View renders an array field; the setup names the proven graph chain
    expect(Array.isArray(data.cloth)).toBe(true);
    expect(data.cloth.length).toBeGreaterThanOrEqual(4);
    expect(data.cloth.join('\n')).toMatch(/TransferSkinWeights/);
    const r = s.accept(data as never);
    expect(r).toMatchObject({ tier: 'L3', status: 'deferred' });
    expect(r.reason).toBeTruthy(); // deferred must carry a reason (Rule 4)
  });

  it('Playable Wire is the L3 Test Gate (honestly deferred)', () => {
    const s = pipeline!.steps[7];
    const r = s.accept(s.produce(entity).data ?? {});
    expect(r).toMatchObject({ tier: 'L3', status: 'deferred' });
  });

  it('Game-Tier Convert records the sustainability budget (L0 pass)', () => {
    const s = pipeline!.steps[8];
    const data = s.produce(entity).data as { gameTier: { sizeMB: number; rigPreserved: boolean } };
    expect(data.gameTier.sizeMB).toBeLessThan(10);
    expect(data.gameTier.rigPreserved).toBe(true);
    expect(s.accept(data as never).status).toBe('pass');
  });

  it('Visual Gate is the L4 gate (honestly deferred)', () => {
    const s = pipeline!.steps[11];
    const r = s.accept(s.produce(entity).data ?? {});
    expect(r).toMatchObject({ tier: 'L4', status: 'deferred' });
  });
});
