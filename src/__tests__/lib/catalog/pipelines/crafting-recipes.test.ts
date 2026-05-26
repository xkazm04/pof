import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('crafting-recipes pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "crafting-recipes" with correct step labels, acceptance, and Test Gate deferred', async () => {
    await import('@/lib/catalog/pipelines/crafting-recipes');
    const p = getCatalogPipeline('crafting-recipes');
    expect(p).not.toBeNull();
    expect(p!.catalogId).toBe('crafting-recipes');

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Inputs & Output');
    expect(labels).toContain('Station & Skill');
    expect(labels).toContain('Cost & Yield');
    expect(labels).toContain('Discovery / Unlock');
    expect(labels).toContain('Craft FX / Audio');
    expect(labels).toContain('Recipe UI');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Localization');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    const entity = {
      id: 'recipe-health-potion',
      name: 'Health Potion',
      lifecycle: 'planned' as const,
      data: {},
    };

    // ── Concept Brief: produce → accept → pass (≥300 chars) ──────────────────
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    const briefOut = brief.produce(entity);
    expect(brief.accept(briefOut.data ?? {}).status).toBe('pass');

    // ── Inputs & Output: produce → accept → pass (fieldsPopulated) ────────────
    const io = p!.steps.find((s) => s.label === 'Inputs & Output')!;
    const ioOut = io.produce(entity);
    expect(io.accept(ioOut.data ?? {}).status).toBe('pass');
    // Resolvable links: output is items::item-7; reagent inputs are descriptive (pending seed).
    // Weapon ids (item-1, item-2) must NOT appear as recipe-input links.
    expect(ioOut.links).toBeDefined();
    const ioLinks = ioOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(ioLinks.some((l) => l.catalogId === 'items' && l.entityId === 'item-7' && l.role === 'recipe-output')).toBe(true);
    expect(ioLinks.some((l) => l.entityId === 'item-1' || l.entityId === 'item-2')).toBe(false);
    expect(ioLinks.some((l) => l.catalogId === 'currencies' && l.entityId === 'currency-gold')).toBe(true);
    // Wiring contract declared on Inputs & Output step
    const ioData = ioOut.data!.io as Record<string, unknown>;
    const ioWiring = ioData.wiringContract as Record<string, unknown>;
    expect(ioWiring).toBeDefined();
    expect(typeof ioWiring.grantedBy).toBe('string');
    expect(typeof ioWiring.activatedBy).toBe('string');
    expect(Array.isArray(ioWiring.dependencies)).toBe(true);
    expect(typeof ioWiring.verification).toBe('string');
    // Inputs are consumed; output is deterministic
    const ioDataObj = ioOut.data!.io as Record<string, unknown>;
    expect(ioDataObj.deterministic).toBe(true);
    expect(Array.isArray(ioDataObj.inputs)).toBe(true);
    expect((ioDataObj.inputs as unknown[]).length).toBeGreaterThanOrEqual(1);

    // ── Station & Skill: produce → accept → pass ──────────────────────────────
    const station = p!.steps.find((s) => s.label === 'Station & Skill')!;
    const stationOut = station.produce(entity);
    expect(station.accept(stationOut.data ?? {}).status).toBe('pass');
    const ss = stationOut.data!.stationSkill as Record<string, unknown>;
    expect(ss.skillLevel).toBe(1);
    expect(ss.station).toBe('BP_AlchemistBench');

    // ── Cost & Yield: goldCost/outputValue ratio within ±20% of target 0.8 ────
    const cost = p!.steps.find((s) => s.label === 'Cost & Yield')!;
    const costOut = cost.produce(entity);
    expect(cost.accept(costOut.data ?? {}).status).toBe('pass');
    // costRatio = 20/24 = 0.833 → within ±20% of 0.8 (band: 0.64–0.96)
    const costRatio = costOut.data!.costRatio as number;
    expect(costRatio).toBeGreaterThanOrEqual(0.64);
    expect(costRatio).toBeLessThanOrEqual(0.96);
    // Top-level link to currencies::currency-gold declared
    expect(costOut.links).toBeDefined();
    const costLinks = costOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(costLinks.some((l) => l.catalogId === 'currencies' && l.entityId === 'currency-gold')).toBe(true);
    // Wiring contract on Cost & Yield
    const cy = costOut.data!.costYield as Record<string, unknown>;
    const cyWiring = cy.wiringContract as Record<string, unknown>;
    expect(cyWiring).toBeDefined();
    expect(typeof cyWiring.grantedBy).toBe('string');
    expect(typeof cyWiring.activatedBy).toBe('string');
    expect(Array.isArray(cyWiring.dependencies)).toBe(true);
    expect(typeof cyWiring.verification).toBe('string');

    // ── Discovery / Unlock: produce → accept → pass ────────────────────────────
    const discovery = p!.steps.find((s) => s.label === 'Discovery / Unlock')!;
    const discoveryOut = discovery.produce(entity);
    expect(discovery.accept(discoveryOut.data ?? {}).status).toBe('pass');

    // ── Icon 2D Art: selected L1 → pass; iconset-abilities link declared ───────
    const iconStep = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconOut = iconStep.produce(entity);
    expect(iconStep.accept(iconOut.data ?? {}).status).toBe('pass');
    expect(iconOut.ueAssets).toBeDefined();
    expect(iconOut.ueAssets!.some((a) => a.includes('Icon'))).toBe(true);
    // Icon step links to icon-sets catalog (universal icon step)
    const iconLinks = iconOut.links as Array<{ catalogId: string; entityId: string }> | undefined;
    expect(iconLinks).toBeDefined();
    expect(iconLinks!.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);

    // ── Localization: produce → accept → pass (≥1 key) ─────────────────────────
    const loc = p!.steps.find((s) => s.label === 'Localization')!;
    const locOut = loc.produce(entity);
    expect(loc.accept(locOut.data ?? {}).status).toBe('pass');
    const keys = locOut.data!.keys as string[];
    expect(keys.length).toBeGreaterThanOrEqual(1);

    // ── Test Gate: always deferred L3 (VSCraftingTest in UE) ───────────────────
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
    expect(gate.accept({ checks: ['done'] })).toMatchObject({ tier: 'L3', status: 'deferred' });

    // ── UE Packaging: ≥2 assets, DT_Recipes present, wiring contract ───────────
    const packaging = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgOut = packaging.produce(entity);
    expect(packaging.accept(pkgOut.data ?? {}).status).toBe('pass');
    const assets = pkgOut.data!.assets as string[];
    expect(assets.length).toBeGreaterThanOrEqual(2);
    expect(assets.some((a) => a.includes('DT_Recipes'))).toBe(true);
    // Wiring contract on UE Packaging step
    const pkgWiring = pkgOut.data!.wiringContract as Record<string, unknown>;
    expect(pkgWiring.grantedBy).toBeDefined();
    expect(pkgWiring.activatedBy).toBeDefined();
    expect(pkgWiring.dependencies).toBeDefined();
    expect(pkgWiring.verification).toBeDefined();
  });
});
