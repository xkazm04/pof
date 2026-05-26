import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('zone-map pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "zone-map" with correct step labels, acceptance, and static checks', async () => {
    await import('@/lib/catalog/pipelines/zone-map');
    const p = getCatalogPipeline('zone-map');
    expect(p).not.toBeNull();
    expect(p!.catalogId).toBe('zone-map');

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Macro Layout & POIs');
    expect(labels).toContain('Area Level & Density');
    expect(labels).toContain('Encounter Placement');
    expect(labels).toContain('Streaming / LOD');
    expect(labels).toContain('3D / Biome');
    expect(labels).toContain('Material');
    expect(labels).toContain('Ambient & Music');
    expect(labels).toContain('Minimap UI');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    // Synthetic entity using the REAL seeded zone id.
    // seed-zone-map.ts::zoneToEntry prefixes 'zone-' to zone.id, so 'z-ashen' → 'zone-z-ashen'.
    const entity = {
      id: 'zone-z-ashen',
      name: 'Ashen Forest',
      lifecycle: 'planned' as const,
      data: {},
    };

    // ── Concept Brief: produce + accept → pass (≥300 chars) ─────────────────
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    const briefOut = brief.produce(entity);
    expect(brief.accept(briefOut.data ?? {}).status).toBe('pass');
    expect((briefOut.data!.brief as string).length).toBeGreaterThanOrEqual(300);

    // ── Macro Layout & POIs: produce + accept → pass ───────────────────────
    const layout = p!.steps.find((s) => s.label === 'Macro Layout & POIs')!;
    const layoutOut = layout.produce(entity);
    expect(layout.accept(layoutOut.data ?? {}).status).toBe('pass');
    const lo = layoutOut.data!.layout as Record<string, unknown>;
    expect(lo.sectors).toBeDefined();
    expect(lo.pois).toBeDefined();

    // ── Area Level & Density: produce + accept → pass; areaLevel=5 ────────
    const density = p!.steps.find((s) => s.label === 'Area Level & Density')!;
    const densityOut = density.produce(entity);
    expect(density.accept(densityOut.data ?? {}).status).toBe('pass');
    const dens = densityOut.data!.density as Record<string, unknown>;
    // areaLevel is the master scalar per ARPG-LAWS §11
    expect(dens.areaLevel).toBe(5);
    // monsterLevel = areaLevel (1:1)
    expect(dens.monsterLevel).toBe(5);
    // loot ilvl = areaLevel
    expect(dens.lootIlvl).toBe(5);
    // ~38 enemies across 5 sectors (ENEMY_DENSITY_CONFIG row 11)
    expect(dens.totalEnemies).toBe(38);

    // ── Area Level L2 static check: AARPGEncounterVolume ────────────────────
    const ueRoot = join(process.cwd(), 'src/__tests__/fixtures/ue');
    const densityChecks = density.staticChecks!(entity);
    expect(densityChecks).toHaveLength(1);
    // Result is either pass (symbol found in fixture) or deferred (UE root not available) — never fail.
    const densL2 = densityChecks[0](ueRoot);
    expect(densL2.tier).toBe('L2');
    expect(['pass', 'deferred']).toContain(densL2.status);

    // ── Encounter Placement: cross-catalog links present ─────────────────────
    const encounters = p!.steps.find((s) => s.label === 'Encounter Placement')!;
    const encOut = encounters.produce(entity);
    expect(encounters.accept(encOut.data ?? {}).status).toBe('pass');
    // Top-level typed links: combat-map::arena-ravaged-courtyard + bestiary::bestiary-brute
    const encLinks = encOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(encLinks).toBeDefined();
    expect(encLinks.some((l) => l.catalogId === 'combat-map' && l.entityId === 'arena-ravaged-courtyard')).toBe(true);
    expect(encLinks.some((l) => l.catalogId === 'bestiary' && l.entityId === 'bestiary-brute')).toBe(true);
    // Wiring contract declared
    const encData = encOut.data!.encounters as Record<string, unknown>;
    const encWiring = encData.wiringContract as Record<string, unknown>;
    expect(typeof encWiring.grantedBy).toBe('string');
    expect(typeof encWiring.activatedBy).toBe('string');
    expect(Array.isArray(encWiring.dependencies)).toBe(true);
    expect(typeof encWiring.verification).toBe('string');

    // ── Material: mat-weathered-stone link present ────────────────────────────
    const materialStep = p!.steps.find((s) => s.label === 'Material')!;
    const matOut = materialStep.produce(entity);
    expect(materialStep.accept(matOut.data ?? {}).status).toBe('pass');
    const matLinks = matOut.links as Array<{ catalogId: string; entityId: string }>;
    expect(matLinks.some((l) => l.catalogId === 'materials' && l.entityId === 'mat-weathered-stone')).toBe(true);

    // ── Ambient & Music: ambient-forest-day + music-combat-a links ────────────
    const audioStep = p!.steps.find((s) => s.label === 'Ambient & Music')!;
    const audioOut = audioStep.produce(entity);
    expect(audioStep.accept(audioOut.data ?? {}).status).toBe('pass');
    const audioLinks = audioOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(audioLinks.some((l) => l.catalogId === 'ambient' && l.entityId === 'ambient-forest-day')).toBe(true);
    expect(audioLinks.some((l) => l.catalogId === 'music' && l.entityId === 'music-combat-a')).toBe(true);

    // ── Icon 2D Art: produce + accept → pass (selected=0 is a valid L1) ───────
    const iconStep = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconOut = iconStep.produce(entity);
    expect(iconStep.accept(iconOut.data ?? {}).status).toBe('pass');
    expect(iconOut.ueAssets).toBeDefined();
    expect(iconOut.ueAssets!.some((a) => a.includes('ZoneIcon'))).toBe(true);

    // ── Test Gate: always deferred L3 (VSZoneTest in UE) ─────────────────────
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
    expect(gate.accept({ checks: ['done'] })).toMatchObject({ tier: 'L3', status: 'deferred' });

    // ── UE Packaging: ≥3 assets, .umap present, full link set, wiring ──────────
    const packaging = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgOut = packaging.produce(entity);
    expect(packaging.accept(pkgOut.data ?? {}).status).toBe('pass');
    const assets = pkgOut.data!.assets as string[];
    expect(assets.length).toBeGreaterThanOrEqual(3);
    expect(assets.some((a) => a.includes('AshenForest.umap'))).toBe(true);
    // All 6 cross-catalog links in top-level links array
    const pkgLinks = pkgOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(pkgLinks.some((l) => l.catalogId === 'combat-map'  && l.entityId === 'arena-ravaged-courtyard')).toBe(true);
    expect(pkgLinks.some((l) => l.catalogId === 'bestiary'    && l.entityId === 'bestiary-brute'         )).toBe(true);
    expect(pkgLinks.some((l) => l.catalogId === 'materials'   && l.entityId === 'mat-weathered-stone'    )).toBe(true);
    expect(pkgLinks.some((l) => l.catalogId === 'ambient'     && l.entityId === 'ambient-forest-day'     )).toBe(true);
    expect(pkgLinks.some((l) => l.catalogId === 'music'       && l.entityId === 'music-combat-a'         )).toBe(true);
    expect(pkgLinks.some((l) => l.catalogId === 'icon-sets'   && l.entityId === 'iconset-abilities'      )).toBe(true);
    // Wiring contract on UE Packaging step
    const pkgWiring = pkgOut.data!.wiringContract as Record<string, unknown>;
    expect(typeof pkgWiring.grantedBy).toBe('string');
    expect(typeof pkgWiring.activatedBy).toBe('string');
    expect(Array.isArray(pkgWiring.dependencies)).toBe(true);
    expect(typeof pkgWiring.verification).toBe('string');
    // L2 static checks: AARPGEncounterVolume + ASpawnVolume
    const pkgChecks = packaging.staticChecks!(entity);
    expect(pkgChecks).toHaveLength(2);
    for (const check of pkgChecks) {
      const result = check(ueRoot);
      expect(result.tier).toBe('L2');
      expect(['pass', 'deferred']).toContain(result.status);
    }
  });
});
