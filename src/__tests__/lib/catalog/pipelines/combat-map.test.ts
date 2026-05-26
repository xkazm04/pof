import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

/**
 * Combat Map pipeline tests.
 *
 * Test entity uses the REAL seeded combat-map entity id:
 *   'arena-ravaged-courtyard'
 * (confirmed via seed-combat-map.ts arenaSliceToEntry: id = `arena-${spec.id}` where
 *  spec.id = 'ravaged-courtyard' → entity id = 'arena-ravaged-courtyard').
 *
 * The synthetic entity here mirrors a LabEntity-like shape passed to `produce(entity)`.
 */
describe('combat-map pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "combat-map" with correct step labels, acceptance, wiring contracts, and cross-catalog links', async () => {
    await import('@/lib/catalog/pipelines/combat-map');
    const p = getCatalogPipeline('combat-map');
    expect(p).not.toBeNull();
    expect(p!.catalogId).toBe('combat-map');

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Encounter Layout');
    expect(labels).toContain('Waves & Spawns');
    expect(labels).toContain('Win/Loss Rules');
    expect(labels).toContain('Hazards');
    expect(labels).toContain('Balance');
    expect(labels).toContain('3D / Terrain');
    expect(labels).toContain('Material');
    expect(labels).toContain('Ambient / Audio');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    // Synthetic entity using the REAL seeded combat-map entity id.
    const entity = {
      id: 'arena-ravaged-courtyard',
      name: 'Ravaged Courtyard',
      lifecycle: 'planned' as const,
      data: {},
    };

    // ── Concept Brief: produce → accept → pass (≥300 chars) ─────────────────
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    const briefOut = brief.produce(entity);
    expect(brief.accept(briefOut.data ?? {}).status).toBe('pass');
    expect(typeof briefOut.data!.brief).toBe('string');
    expect((briefOut.data!.brief as string).length).toBeGreaterThanOrEqual(300);

    // ── Encounter Layout: produce → accept → pass; wiring contract present ───
    const layout = p!.steps.find((s) => s.label === 'Encounter Layout')!;
    const layoutOut = layout.produce(entity);
    expect(layout.accept(layoutOut.data ?? {}).status).toBe('pass');
    const ly = layoutOut.data!.layout as Record<string, unknown>;
    expect(ly.extentCm).toBe(1000); // 20 m arena per build_arena.py
    expect(ly.elevatedThresholdCm).toBe(150);
    expect(ly.highGroundThresholdCm).toBe(300);
    expect(Array.isArray(ly.tacticalPoints)).toBe(true);
    expect((ly.tacticalPoints as unknown[]).length).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(ly.coverPoints)).toBe(true);
    expect((ly.coverPoints as unknown[]).length).toBe(4); // four corner pillars
    const layoutWiring = ly.wiringContract as Record<string, unknown>;
    expect(layoutWiring).toBeDefined();
    expect(typeof layoutWiring.grantedBy).toBe('string');
    expect(typeof layoutWiring.activatedBy).toBe('string');
    expect(Array.isArray(layoutWiring.dependencies)).toBe(true);
    expect(typeof layoutWiring.verification).toBe('string');

    // ── Waves & Spawns: areaLevel as master scalar + real bestiary links ─────
    const wavesStep = p!.steps.find((s) => s.label === 'Waves & Spawns')!;
    const wavesOut = wavesStep.produce(entity);
    expect(wavesStep.accept(wavesOut.data ?? {}).status).toBe('pass');
    const ws = wavesOut.data!.waves as Record<string, unknown>;
    // areaLevel is the master scalar (ARPG-LAWS §11, canon arpg-area-level)
    expect(ws.areaLevel).toBeDefined();
    expect(typeof ws.areaLevel).toBe('number');
    expect(ws.waveCount).toBe(2);
    const waveDetails = ws.waveDetails as Array<Record<string, unknown>>;
    expect(waveDetails.length).toBe(2);
    // Wave 1: kath-hound (seeded in KOTOR_ARCHETYPES, id 'kath-hound')
    expect(waveDetails[0].enemyArchetype).toBe('kath-hound');
    expect(waveDetails[0].count).toBe(4);
    // Wave 2: mandalorian-warrior (seeded in KOTOR_ARCHETYPES, id 'mandalorian-warrior')
    expect(waveDetails[1].enemyArchetype).toBe('mandalorian-warrior');
    expect(waveDetails[1].count).toBe(3);
    // monsterLevel derived from areaLevel (1:1, §11)
    expect(ws.monsterLevel).toBe(ws.areaLevel);
    // Top-level typed links: bestiary + loot-tables (real seeded ids)
    expect(wavesOut.links).toBeDefined();
    const waveLinks = wavesOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(waveLinks.some((l) => l.catalogId === 'bestiary' && l.entityId === 'bestiary-kath-hound' && l.role === 'spawn')).toBe(true);
    expect(waveLinks.some((l) => l.catalogId === 'bestiary' && l.entityId === 'bestiary-mandalorian-warrior' && l.role === 'spawn')).toBe(true);
    expect(waveLinks.some((l) => l.catalogId === 'loot-tables' && l.entityId === 'lt-Brute' && l.role === 'encounter-loot')).toBe(true);
    // Wiring contract on Waves & Spawns
    const wavesWiring = ws.wiringContract as Record<string, unknown>;
    expect(wavesWiring).toBeDefined();
    expect(typeof wavesWiring.grantedBy).toBe('string');
    expect(typeof wavesWiring.activatedBy).toBe('string');
    expect(Array.isArray(wavesWiring.dependencies)).toBe(true);
    expect(typeof wavesWiring.verification).toBe('string');

    // ── Win/Loss Rules: produce → accept → pass; winCondition + lossCondition ─
    const winLossStep = p!.steps.find((s) => s.label === 'Win/Loss Rules')!;
    const winLossOut = winLossStep.produce(entity);
    expect(winLossStep.accept(winLossOut.data ?? {}).status).toBe('pass');
    const wl = winLossOut.data!.winLoss as Record<string, unknown>;
    expect(wl.winCondition).toBe('clear-all-waves');
    expect(wl.lossCondition).toBe('player-death');
    expect(typeof wl.failSafe).toBe('string');

    // ── Hazards: fire-floor GE + wiring contract ─────────────────────────────
    const hazardsStep = p!.steps.find((s) => s.label === 'Hazards')!;
    const hazardsOut = hazardsStep.produce(entity);
    expect(hazardsStep.accept(hazardsOut.data ?? {}).status).toBe('pass');
    const hz = hazardsOut.data!.hazards as Record<string, unknown>;
    const hazardList = hz.hazardList as Array<Record<string, unknown>>;
    expect(hazardList.length).toBeGreaterThanOrEqual(1);
    const fireFloor = hazardList[0];
    expect(fireFloor.kind).toBe('fire-floor');
    expect(fireFloor.ge).toBe('GE_Hazard_FireFloor');
    expect(fireFloor.damageType).toBe('Fire');
    expect(typeof fireFloor.damagePerTick).toBe('number');
    expect(fireFloor.damageIntervalSec).toBeGreaterThanOrEqual(0.1);
    const hzWiring = hz.wiringContract as Record<string, unknown>;
    expect(hzWiring).toBeDefined();
    expect(typeof hzWiring.grantedBy).toBe('string');
    expect(typeof hzWiring.activatedBy).toBe('string');

    // ── Balance: derivedThreatScore within ±10% of 100 ───────────────────────
    const balanceStep = p!.steps.find((s) => s.label === 'Balance')!;
    const balOut = balanceStep.produce(entity);
    expect(balanceStep.accept(balOut.data ?? {}).status).toBe('pass');
    const derivedThreatScore = balOut.data!.derivedThreatScore as number;
    // Must sit within 90–110 (100 ±10%, proj-balance envelope)
    expect(derivedThreatScore).toBeGreaterThanOrEqual(90);
    expect(derivedThreatScore).toBeLessThanOrEqual(110);
    const bal = balOut.data!.balance as Record<string, unknown>;
    // monsterLevel = areaLevel (master scalar law, §11)
    expect(bal.monsterLevel).toBe(bal.areaLevel);

    // ── Material: link to mat-weathered-stone (real seeded entity) ───────────
    const materialStep = p!.steps.find((s) => s.label === 'Material')!;
    const matOut = materialStep.produce(entity);
    expect(materialStep.accept(matOut.data ?? {}).status).toBe('pass');
    expect(matOut.links).toBeDefined();
    const matLinks = matOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(matLinks.some((l) => l.catalogId === 'materials' && l.entityId === 'mat-weathered-stone')).toBe(true);

    // ── Icon 2D Art: L1 selected pass + link to icon-sets::iconset-abilities ──
    const iconStep = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconOut = iconStep.produce(entity);
    expect(iconStep.accept(iconOut.data ?? {}).status).toBe('pass');
    expect(iconOut.ueAssets).toBeDefined();
    expect(iconOut.links).toBeDefined();
    const iconLinks = iconOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(iconLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);

    // ── Test Gate: always deferred L3 (VSArenaSliceRulesTest in UE) ──────────
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
    expect(gate.accept({ checks: ['done'] })).toMatchObject({ tier: 'L3', status: 'deferred' });

    // ── UE Packaging: ≥3 assets, AARPGEncounterArena present, wiring contract ─
    const packaging = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgOut = packaging.produce(entity);
    expect(packaging.accept(pkgOut.data ?? {}).status).toBe('pass');
    const assets = pkgOut.data!.assets as string[];
    expect(assets.length).toBeGreaterThanOrEqual(3);
    expect(assets.some((a) => a.includes('AARPGEncounterArena'))).toBe(true);
    // Links: bestiary + loot-tables + materials
    expect(pkgOut.links).toBeDefined();
    const pkgLinks = pkgOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(pkgLinks.some((l) => l.catalogId === 'bestiary' && l.entityId === 'bestiary-kath-hound')).toBe(true);
    expect(pkgLinks.some((l) => l.catalogId === 'bestiary' && l.entityId === 'bestiary-mandalorian-warrior')).toBe(true);
    expect(pkgLinks.some((l) => l.catalogId === 'loot-tables' && l.entityId === 'lt-Brute')).toBe(true);
    expect(pkgLinks.some((l) => l.catalogId === 'materials' && l.entityId === 'mat-weathered-stone')).toBe(true);
    // Wiring contract on UE Packaging step
    const pkgWiring = pkgOut.data!.wiringContract as Record<string, unknown>;
    expect(pkgWiring).toBeDefined();
    expect(typeof pkgWiring.grantedBy).toBe('string');
    expect(typeof pkgWiring.activatedBy).toBe('string');
    expect(Array.isArray(pkgWiring.dependencies)).toBe(true);
    expect(typeof pkgWiring.verification).toBe('string');
  });
});
