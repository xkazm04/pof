import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('materials pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "materials" with correct step labels, acceptance, wiring contracts', async () => {
    await import('@/lib/catalog/pipelines/materials');
    const p = getCatalogPipeline('materials');
    expect(p).not.toBeNull();
    expect(p!.catalogId).toBe('materials');

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Surface Type');
    expect(labels).toContain('Shader Graph');
    expect(labels).toContain('Parameters');
    expect(labels).toContain('Maps');
    expect(labels).toContain('LOD/Perf Budget');
    expect(labels).toContain('Instance Library');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    // Use the real seeded entity from seed-materials.ts
    const entity = {
      id: 'mat-weathered-stone',
      name: 'Weathered Stone',
      lifecycle: 'planned' as const,
      data: {},
    };

    // ── Concept Brief: produce → accept → pass (≥300 chars) ─────────────────
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    const briefOut = brief.produce(entity);
    expect(brief.accept(briefOut.data ?? {}).status).toBe('pass');
    expect(String(briefOut.data!.brief).length).toBeGreaterThanOrEqual(300);

    // ── Surface Type: produce → accept → pass (fieldsPopulated) ─────────────
    const surfType = p!.steps.find((s) => s.label === 'Surface Type')!;
    const surfOut = surfType.produce(entity);
    expect(surfType.accept(surfOut.data ?? {}).status).toBe('pass');
    const st = surfOut.data!.surfaceType as Record<string, unknown>;
    expect(st.class).toBe('stone');
    expect(st.physicsPreset).toBeDefined();

    // ── Shader Graph: produce → accept → pass; master path correct ───────────
    const shaderStep = p!.steps.find((s) => s.label === 'Shader Graph')!;
    const shaderOut = shaderStep.produce(entity);
    expect(shaderStep.accept(shaderOut.data ?? {}).status).toBe('pass');
    const sg = shaderOut.data!.shaderGraph as Record<string, unknown>;
    expect(sg.masterPath).toBe('/Game/Materials/M_ARPG_Surface_Master');
    // Wiring contract present and well-formed
    const sgWiring = sg.wiringContract as Record<string, unknown>;
    expect(typeof sgWiring.grantedBy).toBe('string');
    expect(typeof sgWiring.activatedBy).toBe('string');
    expect(Array.isArray(sgWiring.dependencies)).toBe(true);
    expect(typeof sgWiring.verification).toBe('string');

    // ── Parameters: produce → accept → pass; all required params present ─────
    const paramsStep = p!.steps.find((s) => s.label === 'Parameters')!;
    const paramsOut = paramsStep.produce(entity);
    expect(paramsStep.accept(paramsOut.data ?? {}).status).toBe('pass');
    const params = paramsOut.data!.params as Record<string, unknown>;
    expect(Array.isArray(params.BaseColorTint)).toBe(true);
    expect(typeof params.TilingScale).toBe('number');
    expect(typeof params.WearAmount).toBe('number');
    expect(typeof params.RoughnessMultiplier).toBe('number');
    expect(typeof params.EmissiveStrength).toBe('number');

    // ── Maps: produce → accept → pass (L1 selection); required maps defined ──
    const mapsStep = p!.steps.find((s) => s.label === 'Maps')!;
    const mapsOut = mapsStep.produce(entity);
    const mapsResult = mapsStep.accept(mapsOut.data ?? {});
    expect(mapsResult.status).toBe('pass');
    expect(mapsResult.tier).toBe('L1');
    const reqMaps = mapsOut.data!.requiredMaps as Record<string, string>;
    expect(reqMaps.albedo).toContain('albedo');
    expect(reqMaps.normal).toContain('normal');
    expect(reqMaps.orm).toContain('orm');

    // ── LOD/Perf Budget: instruction count within ±20% of 200 ───────────────
    const lodStep = p!.steps.find((s) => s.label === 'LOD/Perf Budget')!;
    const lodOut = lodStep.produce(entity);
    expect(lodStep.accept(lodOut.data ?? {}).status).toBe('pass');
    const ic = lodOut.data!.instructionCount as number;
    expect(ic).toBeGreaterThanOrEqual(160); // 200 × 0.8
    expect(ic).toBeLessThanOrEqual(240);    // 200 × 1.2

    // ── Instance Library: produce → accept → pass; master path + recipe ──────
    const libStep = p!.steps.find((s) => s.label === 'Instance Library')!;
    const libOut = libStep.produce(entity);
    expect(libStep.accept(libOut.data ?? {}).status).toBe('pass');
    const lib = libOut.data!.instanceLibrary as Record<string, unknown>;
    expect(String(lib.parentMaterial)).toBe('/Game/Materials/M_ARPG_Surface_Master');
    expect(String(lib.instancePath)).toContain('MI_');
    const libWiring = lib.wiringContract as Record<string, unknown>;
    expect(libWiring.grantedBy).toBeDefined();
    expect(libWiring.activatedBy).toBeDefined();
    expect(libWiring.dependencies).toBeDefined();
    expect(libWiring.verification).toBeDefined();

    // ── Icon 2D Art: selected L1 → pass; icon-sets link declared ─────────────
    const iconStep = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconOut = iconStep.produce(entity);
    const iconResult = iconStep.accept(iconOut.data ?? {});
    expect(iconResult.status).toBe('pass');
    expect(iconResult.tier).toBe('L1');
    // Resolvable link to icon-sets::iconset-abilities
    const iconLinks = iconOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(iconLinks).toBeDefined();
    expect(iconLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);

    // ── Test Gate: always deferred L3 (VSMasterMaterialInstanceTest) ─────────
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
    expect(gate.accept({ checks: ['done'] })).toMatchObject({ tier: 'L3', status: 'deferred' });

    // ── UE Packaging: ≥3 assets (MI + textures); wiring contract ─────────────
    const packaging = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgOut = packaging.produce(entity);
    expect(packaging.accept(pkgOut.data ?? {}).status).toBe('pass');
    const assets = pkgOut.data!.assets as string[];
    expect(assets.length).toBeGreaterThanOrEqual(3);
    expect(assets.some((a) => a.startsWith('MI_'))).toBe(true);
    expect(assets.some((a) => a.includes('albedo'))).toBe(true);
    const pkgWiring = pkgOut.data!.wiringContract as Record<string, unknown>;
    expect(pkgWiring.grantedBy).toBeDefined();
    expect(pkgWiring.activatedBy).toBeDefined();
    expect(pkgWiring.dependencies).toBeDefined();
    expect(pkgWiring.verification).toBeDefined();
  });
});
