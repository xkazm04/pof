import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('spellbook pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "spellbook" with correct step labels, acceptance, wiring contracts, and cross-catalog links', async () => {
    await import('@/lib/catalog/pipelines/spellbook');
    const p = getCatalogPipeline('spellbook');
    expect(p).not.toBeNull();
    expect(p!.catalogId).toBe('spellbook');

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Effect Logic');
    expect(labels).toContain('Targeting');
    expect(labels).toContain('Balance');
    expect(labels).toContain('Combo / Synergy');
    expect(labels).toContain('Animation');
    expect(labels).toContain('VFX');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Applies Status');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    const entity = {
      id: 'off-fire-01',
      name: 'Fireball',
      lifecycle: 'planned' as const,
      data: {},
    };

    // ── Concept Brief: produce → accept → pass (≥300 chars) ──────────────────
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    const briefOut = brief.produce(entity);
    expect(brief.accept(briefOut.data ?? {}).status).toBe('pass');
    expect((briefOut.data!.brief as string).length).toBeGreaterThanOrEqual(300);

    // ── Effect Logic: correct ARPG-LAWS §3 damage model, wiring contract, links
    const logic = p!.steps.find((s) => s.label === 'Effect Logic')!;
    const logicOut = logic.produce(entity);
    expect(logic.accept(logicOut.data ?? {}).status).toBe('pass');

    const effect = logicOut.data!.effect as Record<string, unknown>;
    // Damage type must be one of the code enum values (Fire/Ice/Lightning/Physical/Chaos)
    expect(effect.damageType).toBe('Fire');
    // Concrete in-envelope numbers per plan.md entity data
    expect(effect.baseDamage).toBe(35);
    expect(effect.manaCost).toBe(20);
    expect(effect.cooldown).toBe(3.0);
    // Crit: base 5% + ×2.5 multiplier per ARPG-LAWS §3
    expect(effect.critChancePct).toBe(5);
    expect(effect.critMulti).toBe(2.5);
    // On-hit ignite declared
    const ignite = effect.onHitIgnite as Record<string, unknown>;
    expect(ignite.linkedEffect).toBe('status-effects::status-burning');
    expect(ignite.state_tag).toBe('State.Burning');
    expect(ignite.stacking).toBe('highest');

    // Wiring contract declared on Effect Logic
    const logicWiring = effect.wiringContract as Record<string, unknown>;
    expect(logicWiring).toBeDefined();
    expect(typeof logicWiring.grantedBy).toBe('string');
    expect((logicWiring.grantedBy as string)).toContain('GiveAbility');
    expect(typeof logicWiring.activatedBy).toBe('string');
    expect(Array.isArray(logicWiring.dependencies)).toBe(true);
    const deps = logicWiring.dependencies as string[];
    expect(deps.some((d) => d.includes('UARPGAttributeSet'))).toBe(true);
    expect(deps.some((d) => d.includes('ARPGDamageExecution'))).toBe(true);
    expect(deps.some((d) => d.includes('status-burning'))).toBe(true);
    expect(typeof logicWiring.verification).toBe('string');

    // Top-level links: status-burning + vfx-fire-impact (real seeded ids)
    expect(logicOut.links).toBeDefined();
    const logicLinks = logicOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(logicLinks.some((l) => l.catalogId === 'status-effects' && l.entityId === 'status-burning')).toBe(true);
    expect(logicLinks.some((l) => l.catalogId === 'vfx' && l.entityId === 'vfx-fire-impact')).toBe(true);

    // L2 static checks (Effect Logic) — resolve against fixture UE tree
    const ueRoot = join(process.cwd(), 'src/__tests__/fixtures/ue');
    const logicChecks = logic.staticChecks!(entity);
    expect(logicChecks.length).toBeGreaterThanOrEqual(1);
    for (const check of logicChecks) {
      const result = check(ueRoot);
      expect(result.tier).toBe('L2');
      expect(['pass', 'deferred']).toContain(result.status);
    }

    // ── Targeting: produce → accept → pass ────────────────────────────────────
    const targeting = p!.steps.find((s) => s.label === 'Targeting')!;
    const targetingOut = targeting.produce(entity);
    expect(targeting.accept(targetingOut.data ?? {}).status).toBe('pass');
    const tgt = targetingOut.data!.targeting as Record<string, unknown>;
    expect(tgt.shape).toBe('single-target-projectile');
    expect(tgt.requiresLoS).toBe(true);

    // ── Balance: sustainedDPS within ±20% of tier target 19.5 ────────────────
    const balance = p!.steps.find((s) => s.label === 'Balance')!;
    const balOut = balance.produce(entity);
    expect(balance.accept(balOut.data ?? {}).status).toBe('pass');
    const dps = balOut.data!.sustainedDPS as number;
    // Must sit within 15.6–23.4 (19.5 ±20%)
    expect(dps).toBeGreaterThanOrEqual(15.6);
    expect(dps).toBeLessThanOrEqual(23.4);

    // ── Combo / Synergy: ≥2 entries ───────────────────────────────────────────
    const combo = p!.steps.find((s) => s.label === 'Combo / Synergy')!;
    const comboOut = combo.produce(entity);
    expect(combo.accept(comboOut.data ?? {}).status).toBe('pass');
    const combos = comboOut.data!.combos as unknown[];
    expect(combos.length).toBeGreaterThanOrEqual(2);

    // ── Animation: ≥6 checklist items ─────────────────────────────────────────
    const anim = p!.steps.find((s) => s.label === 'Animation')!;
    const animOut = anim.produce(entity);
    expect(anim.accept(animOut.data ?? {}).status).toBe('pass');
    const checks = animOut.data!.checks as string[];
    expect(checks.length).toBeGreaterThanOrEqual(6);

    // ── VFX: populated + top-level link to vfx-fire-impact ────────────────────
    const vfxStep = p!.steps.find((s) => s.label === 'VFX')!;
    const vfxOut = vfxStep.produce(entity);
    expect(vfxStep.accept(vfxOut.data ?? {}).status).toBe('pass');
    expect(vfxOut.links).toBeDefined();
    const vfxLinks = vfxOut.links as Array<{ catalogId: string; entityId: string }>;
    expect(vfxLinks.some((l) => l.catalogId === 'vfx' && l.entityId === 'vfx-fire-impact')).toBe(true);

    // ── Icon 2D Art: L1 selected pass + link to iconset-abilities ─────────────
    const iconStep = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconOut = iconStep.produce(entity);
    expect(iconStep.accept(iconOut.data ?? {}).status).toBe('pass');
    expect(iconOut.links).toBeDefined();
    const iconLinks = iconOut.links as Array<{ catalogId: string; entityId: string }>;
    expect(iconLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);
    expect(iconOut.ueAssets).toBeDefined();
    expect(iconOut.ueAssets!.some((a) => a.includes('T_Fireball_Icon'))).toBe(true);

    // ── Applies Status: status-burning link + role 'applies' ──────────────────
    const statusStep = p!.steps.find((s) => s.label === 'Applies Status')!;
    const statusOut = statusStep.produce(entity);
    expect(statusStep.accept(statusOut.data ?? {}).status).toBe('pass');
    expect(statusOut.links).toBeDefined();
    const statusLinks = statusOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(statusLinks.some((l) =>
      l.catalogId === 'status-effects' && l.entityId === 'status-burning' && l.role === 'applies',
    )).toBe(true);

    // ── Test Gate: always deferred L3 (VSGenFireballEffectTest in UE) ─────────
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
    expect(gate.accept({ checks: ['done'] })).toMatchObject({ tier: 'L3', status: 'deferred' });

    // ── UE Packaging: ≥4 assets, GA + GE + DT row + wiring contract ───────────
    const packaging = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgOut = packaging.produce(entity);
    expect(packaging.accept(pkgOut.data ?? {}).status).toBe('pass');
    const assets = pkgOut.data!.assets as string[];
    expect(assets.length).toBeGreaterThanOrEqual(4);
    expect(assets.some((a) => a.startsWith('GA_'))).toBe(true);
    expect(assets.some((a) => a.includes('DT_GeneratedAbilities'))).toBe(true);
    // Wiring contract on UE Packaging
    const pkgWiring = pkgOut.data!.wiringContract as Record<string, unknown>;
    expect(pkgWiring.grantedBy).toBeDefined();
    expect((pkgWiring.grantedBy as string)).toContain('GiveAbility');
    expect(pkgWiring.activatedBy).toBeDefined();
    expect(Array.isArray(pkgWiring.dependencies)).toBe(true);
    expect((pkgWiring.dependencies as string[]).some((d) => d.includes('status-burning'))).toBe(true);
    expect(typeof pkgWiring.verification).toBe('string');
    expect((pkgWiring.verification as string)).toContain('VSGenFireballEffectTest');

    // L2 static checks on UE Packaging (UARPGGameplayAbility + FARPGAbilityCatalogRow)
    const pkgChecks = packaging.staticChecks!(entity);
    expect(pkgChecks.length).toBeGreaterThanOrEqual(1);
    for (const check of pkgChecks) {
      const result = check(ueRoot);
      expect(result.tier).toBe('L2');
      expect(['pass', 'deferred']).toContain(result.status);
    }
  });
});
