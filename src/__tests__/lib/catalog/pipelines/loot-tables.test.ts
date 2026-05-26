import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('loot-tables pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "loot-tables" with correct step labels, acceptance, wiring contracts, and cross-catalog links', async () => {
    await import('@/lib/catalog/pipelines/loot-tables');
    const p = getCatalogPipeline('loot-tables');
    expect(p).not.toBeNull();
    expect(p!.catalogId).toBe('loot-tables');

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Drop Generation');
    expect(labels).toContain('Rarity Odds');
    expect(labels).toContain('Magic Find & Smart Loot');
    expect(labels).toContain('Currency & Unique Pools');
    expect(labels).toContain('Item Base Links');
    expect(labels).toContain('Balance / Drop Sim');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    const entity = {
      id: 'loot-goblin-pack',
      name: 'Goblin Pack Drops',
      lifecycle: 'planned' as const,
      data: {},
    };

    // ── Concept Brief: produce → accept → pass (≥300 chars) ─────────────────
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    const briefOut = brief.produce(entity);
    expect(brief.accept(briefOut.data ?? {}).status).toBe('pass');

    // ── Drop Generation: produce → accept → pass (fieldsPopulated) ───────────
    const dropGen = p!.steps.find((s) => s.label === 'Drop Generation')!;
    const dropGenOut = dropGen.produce(entity);
    expect(dropGen.accept(dropGenOut.data ?? {}).status).toBe('pass');
    // Confirm real data per ARPG-LAWS §7: ilvlSource is area-derived
    const dg = dropGenOut.data!.dropGen as Record<string, unknown>;
    expect(dg.ilvlSource).toBe('monsterLevel = areaLevel');
    expect(dg.itemClassWeights).toBeDefined();

    // ── Rarity Odds: produce → accept → pass (in-envelope numbers) ───────────
    const rarityOdds = p!.steps.find((s) => s.label === 'Rarity Odds')!;
    const rarityOut = rarityOdds.produce(entity);
    expect(rarityOdds.accept(rarityOut.data ?? {}).status).toBe('pass');
    // Baseline per ARPG-LAWS §7b
    const ro = rarityOut.data!.rarityOdds as Record<string, unknown>;
    expect(ro.normal).toBe(75.0);
    expect(ro.magic).toBe(20.0);
    expect(ro.rare).toBe(4.5);
    expect(ro.unique).toBe(0.5);

    // ── Magic Find & Smart Loot: produce → accept → pass ─────────────────────
    const mf = p!.steps.find((s) => s.label === 'Magic Find & Smart Loot')!;
    expect(mf.accept(mf.produce(entity).data ?? {}).status).toBe('pass');

    // ── Currency & Unique Pools: typed top-level links, accept → pass ─────────
    const pools = p!.steps.find((s) => s.label === 'Currency & Unique Pools')!;
    const poolsOut = pools.produce(entity);
    expect(pools.accept(poolsOut.data ?? {}).status).toBe('pass');
    // Top-level typed links declared (currencies + items)
    expect(poolsOut.links).toBeDefined();
    const poolLinks = poolsOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(poolLinks.some((l) => l.catalogId === 'currencies')).toBe(true);
    expect(poolLinks.some((l) => l.catalogId === 'items')).toBe(true);
    expect(poolLinks.some((l) => l.role === 'unique-pool')).toBe(true);
    // Wiring contract on the Currency & Unique Pools step
    const poolsData = poolsOut.data!.pools as Record<string, unknown>;
    const poolsWiring = poolsData.wiringContract as Record<string, unknown>;
    expect(poolsWiring).toBeDefined();
    expect(typeof poolsWiring.grantedBy).toBe('string');
    expect(typeof poolsWiring.activatedBy).toBe('string');
    expect(Array.isArray(poolsWiring.dependencies)).toBe(true);
    expect(typeof poolsWiring.verification).toBe('string');

    // ── Item Base Links: typed top-level links to items, accept → pass ────────
    const basesStep = p!.steps.find((s) => s.label === 'Item Base Links')!;
    const basesOut = basesStep.produce(entity);
    expect(basesStep.accept(basesOut.data ?? {}).status).toBe('pass');
    expect(basesOut.links).toBeDefined();
    const baseLinks = basesOut.links as Array<{ catalogId: string; role: string }>;
    expect(baseLinks.every((l) => l.catalogId === 'items')).toBe(true);
    expect(baseLinks.every((l) => l.role === 'drop-base')).toBe(true);
    expect(baseLinks.length).toBeGreaterThanOrEqual(1);
    // Wiring contract on the Item Base Links step
    const basesWiring = basesOut.data!.wiringContract as Record<string, unknown>;
    expect(basesWiring).toBeDefined();
    expect(basesWiring.grantedBy).toBeDefined();
    expect(basesWiring.activatedBy).toBeDefined();
    expect(basesWiring.dependencies).toBeDefined();
    expect(basesWiring.verification).toBeDefined();

    // ── Balance / Drop Sim: raresPerHour in ±20% band around 12 ─────────────
    const balance = p!.steps.find((s) => s.label === 'Balance / Drop Sim')!;
    const balOut = balance.produce(entity);
    expect(balance.accept(balOut.data ?? {}).status).toBe('pass');
    const raresPerHour = balOut.data!.raresPerHour as number;
    // Must sit within 9.6–14.4 (12 ±20%)
    expect(raresPerHour).toBeGreaterThanOrEqual(9.6);
    expect(raresPerHour).toBeLessThanOrEqual(14.4);

    // ── Icon 2D Art: selected L1 → pass; rarity-colored beam ueAssets ─────────
    const iconStep = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconOut = iconStep.produce(entity);
    expect(iconStep.accept(iconOut.data ?? {}).status).toBe('pass');
    expect(iconOut.ueAssets).toBeDefined();
    expect(iconOut.ueAssets!.some((a) => a.includes('LootBeam'))).toBe(true);

    // ── Test Gate: always deferred L3 (VSLootDistributionTest in UE) ──────────
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
    expect(gate.accept({ checks: ['done'] })).toMatchObject({ tier: 'L3', status: 'deferred' });

    // ── UE Packaging: ≥2 assets, DT_LootTables present, wiring contract ───────
    const packaging = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgOut = packaging.produce(entity);
    expect(packaging.accept(pkgOut.data ?? {}).status).toBe('pass');
    const assets = pkgOut.data!.assets as string[];
    expect(assets.length).toBeGreaterThanOrEqual(2);
    expect(assets.some((a) => a.includes('DT_LootTables'))).toBe(true);
    // Wiring contract on UE Packaging step
    const pkgWiring = pkgOut.data!.wiringContract as Record<string, unknown>;
    expect(pkgWiring.grantedBy).toBeDefined();
    expect(pkgWiring.activatedBy).toBeDefined();
    expect(pkgWiring.dependencies).toBeDefined();
    expect(pkgWiring.verification).toBeDefined();
  });
});
