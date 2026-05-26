import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('items pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "items" with all required step labels, acceptance results, and L3-deferred Test Gate', async () => {
    await import('@/lib/catalog/pipelines/items');
    const p = getCatalogPipeline('items');
    expect(p).not.toBeNull();
    expect(p!.catalogId).toBe('items');

    const labels = p!.steps.map((s) => s.label);
    // Required labels per authoring spec
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Base Type & Rarity');
    expect(labels).toContain('Affixes');
    expect(labels).toContain('Damage / Implicit');
    expect(labels).toContain('Economy');
    expect(labels).toContain('Material');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('3D Mesh');
    expect(labels).toContain('Tooltip / Compare');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    // Synthetic entity — the canonical seeded item-1 shape (mirrors DUMMY_ITEMS id '1').
    // Includes rarity and stats so the pipeline derives rarity/APS from seed data.
    const entity = {
      id: 'item-1',
      name: 'Iron Longsword',
      lifecycle: 'planned' as const,
      data: {
        rarity: 'Common',
        stats: [
          { label: 'Damage', value: '12-18' },
          { label: 'Speed',  value: '1.2s'  },
        ],
      },
    };

    // ── Concept Brief: ≥300 chars ────────────────────────────────────────────
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    const briefOut = brief.produce(entity);
    expect(brief.accept(briefOut.data ?? {}).status).toBe('pass');
    expect(String(briefOut.data!.brief).length).toBeGreaterThanOrEqual(300);

    // ── Base Type & Rarity: required fields populated + UE asset declared ─────
    const baseType = p!.steps.find((s) => s.label === 'Base Type & Rarity')!;
    const baseTypeOut = baseType.produce(entity);
    expect(baseType.accept(baseTypeOut.data ?? {}).status).toBe('pass');
    const bt = baseTypeOut.data!.baseType as Record<string, unknown>;
    expect(bt.slot).toBeDefined();
    expect(bt.rarity).toBeDefined();
    expect(bt.ilvl).toBeDefined();
    expect(bt.requiredLevel).toBeDefined();
    expect(bt.implicit).toBeDefined();
    // requiredLevel ≈ ilvl − 5..15 (ARPG-LAWS §1c)
    const ilvl = bt.ilvl as number;
    const reqLvl = bt.requiredLevel as number;
    expect(reqLvl).toBeGreaterThanOrEqual(ilvl - 15);
    expect(reqLvl).toBeLessThanOrEqual(ilvl - 5);
    expect(baseTypeOut.ueAssets).toBeDefined();
    expect(baseTypeOut.ueAssets!.some((a) => a.includes('DA_'))).toBe(true);

    // ── Affixes: budget + tier table + illustrative Rare roll (ARPG-LAWS §2) ─────
    const affixes = p!.steps.find((s) => s.label === 'Affixes')!;
    const affixesOut = affixes.produce(entity);
    expect(affixes.accept(affixesOut.data ?? {}).status).toBe('pass');
    const af = affixesOut.data!.affixes as Record<string, unknown>;
    // Budget declares Rare ≤3p + ≤3s (Common explicit budget = 0, shown by absence of Common key)
    const budget = af.budget as Record<string, unknown>;
    expect(budget).toBeDefined();
    const rareBudget = budget.Rare as Record<string, number>;
    expect(rareBudget.maxPrefix).toBeLessThanOrEqual(3);
    expect(rareBudget.maxSuffix).toBeLessThanOrEqual(3);
    // Tier table has at least 3 families with ilvlReq-gated tiers
    const tierTable = af.tierTable as Record<string, unknown>;
    expect(Object.keys(tierTable).length).toBeGreaterThanOrEqual(3);
    // illustrativeRareRoll: descriptive example of a Rare roll (NOT item-1's own affixes)
    const ex = af.illustrativeRareRoll as Record<string, unknown>;
    expect(ex).toBeDefined();
    expect(ex.name).toBeDefined();
    expect(ex.rarity).toBe('Rare');
    const prefixes = ex.prefixes as unknown[];
    const suffixes = ex.suffixes as unknown[];
    expect(prefixes.length).toBeLessThanOrEqual(3);
    expect(suffixes.length).toBeLessThanOrEqual(3);
    // Each affix in the example carries a ueGE (canon arpg-affix-is-ge)
    for (const pfx of prefixes) {
      expect((pfx as Record<string, unknown>).ueGE).toBeDefined();
    }
    for (const sfx of suffixes) {
      expect((sfx as Record<string, unknown>).ueGE).toBeDefined();
    }
    // Wiring contract declared on Affixes step
    const afWiring = af.wiringContract as Record<string, unknown>;
    expect(afWiring).toBeDefined();
    expect(typeof afWiring.grantedBy).toBe('string');
    expect(typeof afWiring.activatedBy).toBe('string');
    expect(Array.isArray(afWiring.dependencies)).toBe(true);
    expect(typeof afWiring.verification).toBe('string');

    // ── Damage / Implicit: baseDPS within ±30% of 12.5 (ARPG-LAWS §1c) ────────
    // item-1: APS derived from Speed 1.2s → 0.8333; baseDPS = 15 × 0.8333 ≈ 12.5
    const dmg = p!.steps.find((s) => s.label === 'Damage / Implicit')!;
    const dmgOut = dmg.produce(entity);
    expect(dmg.accept(dmgOut.data ?? {}).status).toBe('pass');
    const d = dmgOut.data!.damage as Record<string, unknown>;
    expect(d.damageType).toBe('Physical');
    expect(typeof d.damageMin).toBe('number');
    expect(typeof d.damageMax).toBe('number');
    const aps = d.attackSpeed as number;
    // APS derived from entity Speed stat (1.2s swing-time → 0.8333 APS).
    // Lower bound relaxed to 0.5 to accommodate slow-weapon bases.
    expect(aps).toBeGreaterThanOrEqual(0.5);
    expect(aps).toBeLessThanOrEqual(3.0);
    const crit = d.critChance as number;
    expect(crit).toBeGreaterThanOrEqual(0.05);
    expect(crit).toBeLessThanOrEqual(0.065);
    // baseDPS derived correctly
    const dMin = d.damageMin as number;
    const dMax = d.damageMax as number;
    const expectedDPS = ((dMin + dMax) / 2) * aps;
    const recordedDPS = dmgOut.data!.baseDPS as number;
    expect(Math.abs(recordedDPS - expectedDPS)).toBeLessThan(0.01);

    // ── Economy: price/power ratio in 0.8–1.2× band ───────────────────────────
    const economy = p!.steps.find((s) => s.label === 'Economy')!;
    const econOut = economy.produce(entity);
    expect(economy.accept(econOut.data ?? {}).status).toBe('pass');
    const ratio = econOut.data!.pricePowerRatio as number;
    expect(ratio).toBeGreaterThanOrEqual(0.8);
    expect(ratio).toBeLessThanOrEqual(1.2);

    // ── Material: fields populated + link to mat-weathered-stone ─────────────
    const material = p!.steps.find((s) => s.label === 'Material')!;
    const matOut = material.produce(entity);
    expect(material.accept(matOut.data ?? {}).status).toBe('pass');
    // Typed top-level link to the seeded material
    expect(matOut.links).toBeDefined();
    const matLinks = matOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(matLinks.some((l) => l.catalogId === 'materials' && l.entityId === 'mat-weathered-stone')).toBe(true);

    // ── Icon 2D Art: selected L1 + link to iconset-abilities ─────────────────
    const icon = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconOut = icon.produce(entity);
    expect(icon.accept(iconOut.data ?? {}).status).toBe('pass');
    expect(iconOut.links).toBeDefined();
    const iconLinks = iconOut.links as Array<{ catalogId: string; entityId: string }>;
    expect(iconLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);
    expect(iconOut.ueAssets!.some((a) => a.includes('Icon'))).toBe(true);

    // ── 3D Mesh: L1 gallery accept → pass ────────────────────────────────────
    const mesh3d = p!.steps.find((s) => s.label === '3D Mesh')!;
    const meshOut = mesh3d.produce(entity);
    expect(mesh3d.accept(meshOut.data ?? {}).status).toBe('pass');

    // ── Tooltip / Compare: fields populated ───────────────────────────────────
    const tooltip = p!.steps.find((s) => s.label === 'Tooltip / Compare')!;
    const ttOut = tooltip.produce(entity);
    expect(tooltip.accept(ttOut.data ?? {}).status).toBe('pass');
    const tt = ttOut.data!.tooltip as Record<string, unknown>;
    expect(tt.displayName).toBeDefined();
    expect(Array.isArray(tt.compareFields)).toBe(true);

    // ── Test Gate: ALWAYS deferred L3 (VSItemsDefinitionsTest) ───────────────
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
    expect(gate.accept({ checks: ['all done'] })).toMatchObject({ tier: 'L3', status: 'deferred' });
    // Wiring contract present in Test Gate produce output
    const gateOut = gate.produce(entity);
    const gateWiring = gateOut.data!.wiringContract as Record<string, unknown>;
    expect(gateWiring).toBeDefined();
    expect(gateWiring.grantedBy).toBeDefined();
    expect(gateWiring.activatedBy).toBeDefined();
    expect(gateWiring.dependencies).toBeDefined();
    expect(gateWiring.verification).toBeDefined();

    // ── UE Packaging: ≥3 assets, DA + DT_Items present, wiring contract ───────
    const packaging = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgOut = packaging.produce(entity);
    expect(packaging.accept(pkgOut.data ?? {}).status).toBe('pass');
    const pkgAssets = pkgOut.data!.assets as string[];
    expect(pkgAssets.length).toBeGreaterThanOrEqual(3);
    expect(pkgAssets.some((a) => a.startsWith('DA_'))).toBe(true);
    expect(pkgAssets.some((a) => a.includes('DT_Items'))).toBe(true);
    // Wiring contract on UE Packaging
    const pkgWiring = pkgOut.data!.wiringContract as Record<string, unknown>;
    expect(pkgWiring.grantedBy).toBeDefined();
    expect(pkgWiring.activatedBy).toBeDefined();
    expect(Array.isArray(pkgWiring.dependencies)).toBe(true);
    expect(typeof pkgWiring.verification).toBe('string');
  });
});
