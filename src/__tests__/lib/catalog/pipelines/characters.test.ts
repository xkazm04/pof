import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('characters pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "characters" with correct step labels, acceptance, and deferred gate', async () => {
    await import('@/lib/catalog/pipelines/characters');
    const p = getCatalogPipeline('characters');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Stat Block');
    expect(labels).toContain('3D & Rig');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('Behavior (NPC)');
    expect(labels).toContain('Icon 2D Art (portrait)');
    expect(labels).toContain('UE Packaging');

    const entity = {
      id: 'char-captain-vael',
      name: 'Captain Vael',
      lifecycle: 'planned' as const,
      data: {},
    };

    // Stat Block: produce + accept → pass (L0 fieldsPopulated)
    const statBlock = p!.steps.find((s) => s.label === 'Stat Block')!;
    const statData = statBlock.produce(entity).data ?? {};
    expect(statBlock.accept(statData).status).toBe('pass');
    // FIX 2: ARPG-grade Str/Dex/Int attributes (§9c) + resistance profile (§4) present
    const stats = (statData as Record<string, unknown>).stats as Record<string, unknown>;
    expect(stats).toHaveProperty('strength');
    expect(stats).toHaveProperty('dexterity');
    expect(stats).toHaveProperty('intelligence');
    expect(stats).toHaveProperty('fireResistance');
    expect(stats).toHaveProperty('chaosResistance');
    expect(stats).toHaveProperty('damageType');
    // wiringContract present on stat block data
    expect(statData).toHaveProperty('wiringContract');

    // Stat Block static checks: 2 checks (cppSymbolExists + seedRowPresent), both L2
    const statChecks = statBlock.staticChecks!(entity);
    expect(statChecks).toHaveLength(2);
    const l2stat = statChecks[0](null);
    expect(l2stat.tier).toBe('L2');
    const l2statSeed = statChecks[1](null);
    expect(l2statSeed.tier).toBe('L2');

    // Behavior (NPC): produce + accept → pass (L0 fieldsPopulated)
    const behavior = p!.steps.find((s) => s.label === 'Behavior (NPC)')!;
    expect(behavior.accept(behavior.produce(entity).data ?? {}).status).toBe('pass');

    // Behavior produces cross-catalog links to dialog-trees + quests (real seeded ids only)
    const behaviorData = behavior.produce(entity).data ?? {};
    const links = (behaviorData as Record<string, unknown>).links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(links.some((l) => l.catalogId === 'dialog-trees')).toBe(true);
    expect(links.some((l) => l.catalogId === 'quests')).toBe(true);
    // FIX 1: dangling ids replaced with real seeded ids (new-catalogs.ts starters)
    const dialogLink = links.find((l) => l.catalogId === 'dialog-trees')!;
    expect(dialogLink.entityId).toBe('dialog-gatekeeper');
    const questLink = links.find((l) => l.catalogId === 'quests')!;
    expect(questLink.entityId).toBe('quest-ember-pact');
    // FIX 2: spellbook ability grants are linked (real seeded off-phy-01 / off-phy-02)
    expect(links.some((l) => l.catalogId === 'spellbook' && l.entityId === 'off-phy-01')).toBe(true);
    expect(links.some((l) => l.catalogId === 'spellbook' && l.entityId === 'off-phy-02')).toBe(true);

    // Test Gate: deferred L3
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });

    // UE Packaging static checks: 2 checks (cppSymbolExists + seedRowPresent), both L2
    const packaging = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgChecks = packaging.staticChecks!(entity);
    expect(pkgChecks).toHaveLength(2);
    const l2pkg = pkgChecks[0](null);
    expect(l2pkg.tier).toBe('L2');
    const l2pkgSeed = pkgChecks[1](null);
    expect(l2pkgSeed.tier).toBe('L2');
  });
});
