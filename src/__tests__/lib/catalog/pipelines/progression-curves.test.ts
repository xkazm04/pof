import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('progression-curves pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "progression-curves" with correct step labels, acceptance, wiring contracts, and cross-catalog links', async () => {
    await import('@/lib/catalog/pipelines/progression-curves');
    const p = getCatalogPipeline('progression-curves');
    expect(p).not.toBeNull();
    expect(p!.catalogId).toBe('progression-curves');

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Curve Formula');
    expect(labels).toContain('XP Sources');
    expect(labels).toContain('Reward Schedule');
    expect(labels).toContain('Caps & Catch-up');
    expect(labels).toContain('Death Penalty');
    expect(labels).toContain('Balance');
    expect(labels).toContain('Telemetry');
    expect(labels).toContain('XP Bar UI');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    const entity = {
      id: 'curve-hero-level',
      name: 'Hero Level Curve',
      lifecycle: 'planned' as const,
      data: {},
    };

    // ── Concept Brief: produce → accept → pass (≥300 chars) ──────────────────
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    const briefOut = brief.produce(entity);
    expect(brief.accept(briefOut.data ?? {}).status).toBe('pass');

    // ── Curve Formula: produce → accept → pass; real formula values ───────────
    const curveFormula = p!.steps.find((s) => s.label === 'Curve Formula')!;
    const curveOut = curveFormula.produce(entity);
    expect(curveFormula.accept(curveOut.data ?? {}).status).toBe('pass');
    const cf = curveOut.data!.curveFormula as Record<string, unknown>;
    // Formula string present
    expect(typeof cf.formula).toBe('string');
    // base = 100, exponent (growth) = 1.08, soft cap = 90
    expect(cf.base).toBe(100);
    expect(cf.exponent).toBe(1.08);
    expect(cf.softCap).toBe(90);
    // Sample values: xpToNext(L) = 100 × 1.08^L
    const samples = cf.sampleValues as Record<string, unknown>;
    expect(samples.L1).toBe(Math.round(100 * Math.pow(1.08, 1)));   // 108
    expect(samples.L10).toBe(Math.round(100 * Math.pow(1.08, 10)));  // 216
    expect(samples.L50).toBe(Math.round(100 * Math.pow(1.08, 50)));  // ~4 690
    expect(samples.L90).toBe(Math.round(100 * Math.pow(1.08, 90)));  // ~101 890
    // Monotonically increasing: L1 < L10 < L50 < L90
    expect(samples.L1 as number).toBeLessThan(samples.L10 as number);
    expect(samples.L10 as number).toBeLessThan(samples.L50 as number);
    expect(samples.L50 as number).toBeLessThan(samples.L90 as number);
    // Wiring contract declared
    const cfWiring = cf.wiringContract as Record<string, unknown>;
    expect(typeof cfWiring.grantedBy).toBe('string');
    expect(cfWiring.grantedBy).toContain('GE_AwardXP');
    expect(typeof cfWiring.activatedBy).toBe('string');
    expect(Array.isArray(cfWiring.dependencies)).toBe(true);
    expect(typeof cfWiring.verification).toBe('string');

    // ── XP Sources: produce → accept → pass ───────────────────────────────────
    const xpSources = p!.steps.find((s) => s.label === 'XP Sources')!;
    const xpOut = xpSources.produce(entity);
    expect(xpSources.accept(xpOut.data ?? {}).status).toBe('pass');
    const xs = xpOut.data!.xpSources as Record<string, unknown>;
    // Wiring contract present
    const xsWiring = xs.wiringContract as Record<string, unknown>;
    expect(xsWiring).toBeDefined();
    expect(typeof xsWiring.grantedBy).toBe('string');

    // ── Reward Schedule: produce → accept → pass ──────────────────────────────
    const rewards = p!.steps.find((s) => s.label === 'Reward Schedule')!;
    const rewardsOut = rewards.produce(entity);
    expect(rewards.accept(rewardsOut.data ?? {}).status).toBe('pass');

    // ── Caps & Catch-up: produce → accept → pass ──────────────────────────────
    const caps = p!.steps.find((s) => s.label === 'Caps & Catch-up')!;
    const capsOut = caps.produce(entity);
    expect(caps.accept(capsOut.data ?? {}).status).toBe('pass');
    const cac = capsOut.data!.capsAndCatchup as Record<string, unknown>;
    const sc = cac.softCap as Record<string, unknown>;
    expect(sc.level).toBe(90);
    const hc = cac.hardCap as Record<string, unknown>;
    expect(hc.level).toBe(100);

    // ── Death Penalty: produce → accept → pass ────────────────────────────────
    const death = p!.steps.find((s) => s.label === 'Death Penalty')!;
    const deathOut = death.produce(entity);
    expect(death.accept(deathOut.data ?? {}).status).toBe('pass');
    const dp = deathOut.data!.deathPenalty as Record<string, unknown>;
    expect(typeof dp.sinkRationale).toBe('string');
    // Wiring contract
    const dpWiring = dp.wiringContract as Record<string, unknown>;
    expect(dpWiring).toBeDefined();
    expect(typeof dpWiring.grantedBy).toBe('string');
    expect(dpWiring.grantedBy).toContain('GE_DeathPenaltyXP');

    // ── Balance: minutesToNextLevel within ±20% of 45 ────────────────────────
    const balance = p!.steps.find((s) => s.label === 'Balance')!;
    const balOut = balance.produce(entity);
    expect(balance.accept(balOut.data ?? {}).status).toBe('pass');
    const minutesToNextLevel = balOut.data!.minutesToNextLevel as number;
    // Must sit within 36–54 (45 ±20%)
    expect(minutesToNextLevel).toBeGreaterThanOrEqual(36);
    expect(minutesToNextLevel).toBeLessThanOrEqual(54);

    // ── Icon 2D Art: selected L1 → pass; typed link to icon-sets ─────────────
    const icon = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconOut = icon.produce(entity);
    expect(icon.accept(iconOut.data ?? {}).status).toBe('pass');
    expect(iconOut.links).toBeDefined();
    const iconLinks = iconOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(iconLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);
    expect(iconOut.ueAssets).toBeDefined();
    expect(iconOut.ueAssets!.some((a) => a.includes('LevelUpIcon'))).toBe(true);

    // ── Test Gate: always deferred L3 ────────────────────────────────────────
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
    expect(gate.accept({ checks: ['done'] })).toMatchObject({ tier: 'L3', status: 'deferred' });

    // ── UE Packaging: ≥4 assets, CT_XPRequirements present, wiring contract ──
    const packaging = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgOut = packaging.produce(entity);
    expect(packaging.accept(pkgOut.data ?? {}).status).toBe('pass');
    const assets = pkgOut.data!.assets as string[];
    expect(assets.length).toBeGreaterThanOrEqual(4);
    expect(assets.some((a) => a.includes('CT_XPRequirements'))).toBe(true);
    expect(assets.some((a) => a.includes('GE_AwardXP'))).toBe(true);
    expect(assets.some((a) => a.includes('GE_DeathPenaltyXP'))).toBe(true);
    // Typed top-level link to icon-sets
    const pkgLinks = pkgOut.links as Array<{ catalogId: string; entityId: string }>;
    expect(pkgLinks).toBeDefined();
    expect(pkgLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);
    // Wiring contract
    const pkgWiring = pkgOut.data!.wiringContract as Record<string, unknown>;
    expect(pkgWiring).toBeDefined();
    expect(typeof pkgWiring.grantedBy).toBe('string');
    expect(pkgWiring.grantedBy).toContain('GE_AwardXP');
    expect(typeof pkgWiring.activatedBy).toBe('string');
    expect(Array.isArray(pkgWiring.dependencies)).toBe(true);
    expect(typeof pkgWiring.verification).toBe('string');
  });
});
