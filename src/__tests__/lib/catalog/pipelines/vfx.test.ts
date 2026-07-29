import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('vfx pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "vfx" with correct step labels and acceptance', async () => {
    await import('@/lib/catalog/pipelines/vfx');
    const p = getCatalogPipeline('vfx');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('GPU / LOD Budget');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Sound Hook');
    expect(labels).toContain('UE Packaging');

    const entity = { id: 'vfx-fire-impact', name: 'Fire Impact', lifecycle: 'planned' as const, data: {} };

    // Concept Brief: produce populates brief ≥ 300 chars → pass L0
    const briefStep = p!.steps.find((s) => s.label === 'Concept Brief')!;
    const briefResult = briefStep.accept(briefStep.produce(entity).data ?? {});
    expect(briefResult.status).toBe('pass');
    expect(briefResult.tier).toBe('L0');

    // Icon 2D Art: gallery step → tier L1, pass after produce
    const iconStep = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconResult = iconStep.accept(iconStep.produce(entity).data ?? {});
    expect(iconResult.status).toBe('deferred'); // a swatch placeholder is not a generated asset — the gallery gate now defers with a reason
    expect(iconResult.tier).toBe('L4'); // a missing VISUAL asset, reported at the tier the walker expects for a deferral

    // Mesh / Sprite: gallery step → tier L1, pass after produce
    const meshStep = p!.steps.find((s) => s.label === 'Mesh / Sprite')!;
    const meshResult = meshStep.accept(meshStep.produce(entity).data ?? {});
    expect(meshResult.status).toBe('deferred'); // a swatch placeholder is not a generated asset — the gallery gate defers with a reason
    expect(meshResult.tier).toBe('L4'); // a missing VISUAL asset

    // GPU / LOD Budget: balance step → pass with produced value at target
    const gpuStep = p!.steps.find((s) => s.label === 'GPU / LOD Budget')!;
    const gpuResult = gpuStep.accept(gpuStep.produce(entity).data ?? {});
    expect(gpuResult.status).toBe('pass');
    expect(gpuResult.tier).toBe('L0');

    // Test Gate: L3 deferred
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
  });
});
