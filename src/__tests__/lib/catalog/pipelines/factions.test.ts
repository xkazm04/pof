import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('factions pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "factions" with required step labels, acceptance, and Test Gate deferred', async () => {
    await import('@/lib/catalog/pipelines/factions');
    const p = getCatalogPipeline('factions');
    expect(p).not.toBeNull();
    expect(p!.catalogId).toBe('factions');

    const labels = p!.steps.map((s) => s.label);

    // Required steps per spec
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Standing & Rep Tiers');
    expect(labels).toContain('Action → Reputation');
    expect(labels).toContain('Tier Rewards');
    expect(labels).toContain('NPC Members');
    expect(labels).toContain('Greeting & Disposition Hooks');
    expect(labels).toContain('Standing UI');
    expect(labels).toContain('Heraldry Icon');
    expect(labels).toContain('Localization');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    // Synthetic starter entity (matches new-catalogs.ts seeded starter)
    const entity = {
      id: 'faction-ashen-order',
      name: 'The Ashen Order',
      lifecycle: 'planned' as const,
      data: {},
    };

    // ── Concept Brief: ≥300 chars → pass ────────────────────────────────────
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    const briefOut = brief.produce(entity);
    expect(brief.accept(briefOut.data ?? {}).status).toBe('pass');

    // ── Standing & Rep Tiers: ≥6 tiers → pass; tier data is law-faithful ─────
    const tiersStep = p!.steps.find((s) => s.label === 'Standing & Rep Tiers')!;
    const tiersOut = tiersStep.produce(entity);
    expect(tiersStep.accept(tiersOut.data ?? {}).status).toBe('pass');

    const tiers = tiersOut.data!.tiers as Array<{
      tier: string;
      minPoints: number;
      maxPoints: number;
    }>;
    expect(tiers.length).toBeGreaterThanOrEqual(6);
    // Neutral must start at 0
    const neutral = tiers.find((t) => t.tier === 'Neutral');
    expect(neutral).toBeDefined();
    expect(neutral!.minPoints).toBe(0);
    // Exalted must be the highest positive tier
    const exalted = tiers.find((t) => t.tier === 'Exalted');
    expect(exalted).toBeDefined();
    expect(exalted!.minPoints).toBeGreaterThan(6000);
    // Hated must be negative
    const hated = tiers.find((t) => t.tier === 'Hated');
    expect(hated).toBeDefined();
    expect(hated!.minPoints).toBeLessThan(0);

    // ── Action → Reputation: ≥8 deltas → pass ───────────────────────────────
    const actionStep = p!.steps.find((s) => s.label === 'Action → Reputation')!;
    const actionOut = actionStep.produce(entity);
    expect(actionStep.accept(actionOut.data ?? {}).status).toBe('pass');

    const deltas = actionOut.data!.actionDeltas as Array<{
      action: string;
      delta: number;
    }>;
    expect(deltas.length).toBeGreaterThanOrEqual(8);
    // Must have both positive gains and negative losses
    expect(deltas.some((d) => d.delta > 0)).toBe(true);
    expect(deltas.some((d) => d.delta < 0)).toBe(true);
    // Quest completion should be the largest positive delta (≥250)
    const questDelta = deltas.find((d) => /quest/i.test(d.action) && d.delta > 0);
    expect(questDelta).toBeDefined();
    expect(questDelta!.delta).toBeGreaterThanOrEqual(250);

    // ── Tier Rewards: ≥4 rows → pass; cross-catalog links declared ────────────
    const rewardsStep = p!.steps.find((s) => s.label === 'Tier Rewards')!;
    const rewardsOut = rewardsStep.produce(entity);
    expect(rewardsStep.accept(rewardsOut.data ?? {}).status).toBe('pass');

    // Top-level typed links: currency-gold, item-6, vendor-wandering-merchant
    expect(rewardsOut.links).toBeDefined();
    const rewardLinks = rewardsOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(rewardLinks.some((l) => l.catalogId === 'currencies' && l.entityId === 'currency-gold')).toBe(true);
    expect(rewardLinks.some((l) => l.catalogId === 'items' && l.entityId === 'item-6')).toBe(true);
    expect(rewardLinks.some((l) => l.catalogId === 'vendors' && l.entityId === 'vendor-wandering-merchant')).toBe(true);

    // Discount formula is linear 0→20% (vendor-laws canon)
    const tierRewards = rewardsOut.data!.tierRewards as Array<{ tier: string; discount: number }>;
    const neutralReward = tierRewards.find((r) => r.tier === 'Neutral');
    const exaltedReward = tierRewards.find((r) => r.tier === 'Exalted');
    expect(neutralReward!.discount).toBe(0);
    expect(exaltedReward!.discount).toBe(20);

    // ── NPC Members: ≥1 member → pass; char-captain-vael linked ────────────
    const membersStep = p!.steps.find((s) => s.label === 'NPC Members')!;
    const membersOut = membersStep.produce(entity);
    expect(membersStep.accept(membersOut.data ?? {}).status).toBe('pass');

    // Top-level typed link to char-captain-vael
    expect(membersOut.links).toBeDefined();
    const memberLinks = membersOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(memberLinks.some((l) => l.catalogId === 'characters' && l.entityId === 'char-captain-vael')).toBe(true);

    // Wiring contract is fully declared on NPC Members
    const membersWiring = membersOut.data!.wiringContract as Record<string, unknown>;
    expect(membersWiring).toBeDefined();
    expect(typeof membersWiring.grantedBy).toBe('string');
    expect(typeof membersWiring.activatedBy).toBe('string');
    expect(typeof membersWiring.verification).toBe('string');

    // ── Standing UI: widget + format + anchor → pass (proj-hud-binding) ─────
    const uiStep = p!.steps.find((s) => s.label === 'Standing UI')!;
    const uiOut = uiStep.produce(entity);
    expect(uiStep.accept(uiOut.data ?? {}).status).toBe('pass');
    const ui = uiOut.data!.standingUi as Record<string, unknown>;
    expect(typeof ui.widget).toBe('string');
    expect(typeof ui.format).toBe('string');
    expect(typeof ui.anchor).toBe('string');

    // ── Heraldry Icon: gallery selected=0 → pass (L1) ────────────────────────
    const iconStep = p!.steps.find((s) => s.label === 'Heraldry Icon')!;
    const iconOut = iconStep.produce(entity);
    expect(iconStep.accept(iconOut.data ?? {}).status).toBe('pass');
    expect(iconOut.ueAssets).toBeDefined();
    expect(iconOut.ueAssets!.some((a) => a.includes('Sigil'))).toBe(true);

    // ── Localization: ≥1 key → pass ──────────────────────────────────────────
    const l10nStep = p!.steps.find((s) => s.label === 'Localization')!;
    const l10nOut = l10nStep.produce(entity);
    expect(l10nStep.accept(l10nOut.data ?? {}).status).toBe('pass');
    const keys = l10nOut.data!.keys as string[];
    expect(keys.length).toBeGreaterThanOrEqual(7); // one per tier at minimum
    expect(keys).toContain('FACTION_GREET_NEUTRAL');
    expect(keys).toContain('FACTION_GREET_EXALTED');

    // ── Test Gate: always deferred L3 (VSFactionRepTest) ─────────────────────
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
    expect(gate.accept({ checks: ['all done'] })).toMatchObject({ tier: 'L3', status: 'deferred' });

    // ── UE Packaging: ≥5 assets, wiring contract, iconset-abilities link ─────
    const pkgStep = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgOut = pkgStep.produce(entity);
    expect(pkgStep.accept(pkgOut.data ?? {}).status).toBe('pass');
    const assets = pkgOut.data!.assets as string[];
    expect(assets.length).toBeGreaterThanOrEqual(5);
    expect(assets.some((a) => a.includes('DT_Factions'))).toBe(true);

    // Top-level links on Packaging include iconset-abilities
    const pkgLinks = pkgOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(pkgLinks).toBeDefined();
    expect(pkgLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);

    // Wiring contract is fully declared on Packaging
    const pkgWiring = pkgOut.data!.wiringContract as Record<string, unknown>;
    expect(pkgWiring.grantedBy).toBeDefined();
    expect(pkgWiring.activatedBy).toBeDefined();
    expect(Array.isArray(pkgWiring.dependencies)).toBe(true);
    expect(typeof pkgWiring.verification).toBe('string');
  });
});
