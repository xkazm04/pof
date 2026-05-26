import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('ambient pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "ambient" with correct step labels and acceptance', async () => {
    await import('@/lib/catalog/pipelines/ambient');
    const p = getCatalogPipeline('ambient');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);

    // Required step presence
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Layers');
    expect(labels).toContain('Spatialization');
    expect(labels).toContain('Variants & Randomization');
    expect(labels).toContain('Occlusion');
    expect(labels).toContain('Memory Budget');
    expect(labels).toContain('Zone Binding');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    const entity = {
      id: 'ambient-forest-day',
      name: 'Forest Day',
      lifecycle: 'planned' as const,
      data: {},
    };

    // ── Concept Brief: L0 minLength — real content ≥300 chars
    const briefStep = p!.steps.find((s) => s.label === 'Concept Brief')!;
    const briefResult = briefStep.accept(briefStep.produce(entity).data ?? {});
    expect(briefResult.status).toBe('pass');
    expect(briefResult.tier).toBe('L0');

    // ── Layers: L0 fieldsPopulated — bed + detailLoops + oneShots present
    const layersStep = p!.steps.find((s) => s.label === 'Layers')!;
    const layersData = layersStep.produce(entity).data ?? {};
    expect(layersData.layers).toBeDefined();
    const layersResult = layersStep.accept(layersData);
    expect(layersResult.status).toBe('pass');
    expect(layersResult.tier).toBe('L0');

    // ── Spatialization: L0 fieldsPopulated
    const spatStep = p!.steps.find((s) => s.label === 'Spatialization')!;
    const spatData = spatStep.produce(entity).data ?? {};
    const spatResult = spatStep.accept(spatData);
    expect(spatResult.status).toBe('pass');
    expect(spatResult.tier).toBe('L0');

    // ── Memory Budget: L0 withinPercent — 5.8 MB within ±33% of 6 MB target (4.02–7.98 MB)
    const budgetStep = p!.steps.find((s) => s.label === 'Memory Budget')!;
    const budgetData = budgetStep.produce(entity).data ?? {};
    expect(budgetData.totalDecodedMb).toBeDefined();
    const budgetResult = budgetStep.accept(budgetData);
    expect(budgetResult.status).toBe('pass');
    expect(budgetResult.tier).toBe('L0');

    // ── Zone Binding: L0 fieldsPopulated — primary zone link to z-ashen
    const zoneStep = p!.steps.find((s) => s.label === 'Zone Binding')!;
    const zoneOutput = zoneStep.produce(entity);
    const zoneData = zoneOutput.data ?? {};
    const zoneBinding = zoneData.zoneBinding as { primaryZone?: { catalogRef?: string } } | undefined;
    expect(zoneBinding?.primaryZone?.catalogRef).toBe('zone-map::zone-z-ashen');
    const zoneResult = zoneStep.accept(zoneData);
    expect(zoneResult.status).toBe('pass');
    expect(zoneResult.tier).toBe('L0');

    // ── Layers step top-level links include zone-map::zone-z-ashen
    const layersOutput = layersStep.produce(entity);
    const topLinks = layersOutput.links ?? [];
    expect(topLinks.some((l) => l.catalogId === 'zone-map' && l.entityId === 'zone-z-ashen')).toBe(true);

    // ── Icon 2D Art: L1 selection — selected:0 passes
    const iconStep = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconResult = iconStep.accept(iconStep.produce(entity).data ?? {});
    expect(iconResult.status).toBe('pass');
    expect(iconResult.tier).toBe('L1');

    // ── Icon step top-level links include icon-sets::iconset-abilities
    const iconOutput = iconStep.produce(entity);
    const iconLinks = (iconOutput as { links?: { catalogId: string; entityId: string }[] }).links ?? [];
    expect(iconLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);

    // ── Test Gate: deferred L3 (VSAmbientTest)
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });

    // ── UE Packaging: L0 minCount — ≥3 assets
    const pkgStep = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgData = pkgStep.produce(entity).data ?? {};
    expect(Array.isArray(pkgData.assets)).toBe(true);
    const pkgResult = pkgStep.accept(pkgData);
    expect(pkgResult.status).toBe('pass');
    expect(pkgResult.tier).toBe('L0');
  });
});
