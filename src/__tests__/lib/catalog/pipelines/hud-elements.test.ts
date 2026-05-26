import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('hud-elements pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "hud-elements" with correct step labels, acceptance, wiring contracts, and cross-catalog links', async () => {
    await import('@/lib/catalog/pipelines/hud-elements');
    const p = getCatalogPipeline('hud-elements');
    expect(p).not.toBeNull();
    expect(p!.catalogId).toBe('hud-elements');

    const labels = p!.steps.map((s) => s.label);
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Data Binding');
    expect(labels).toContain('State Logic');
    expect(labels).toContain('Wireframe');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Animation');
    expect(labels).toContain('Accessibility');
    expect(labels).toContain('Localization');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    const entity = {
      id: 'hud-health-bar',
      name: 'Health Bar',
      lifecycle: 'planned' as const,
      data: {},
    };

    // ── Concept Brief: produce → accept → pass (≥300 chars) ─────────────────
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    const briefOut = brief.produce(entity);
    expect(brief.accept(briefOut.data ?? {}).status).toBe('pass');
    expect(String(briefOut.data!.brief).length).toBeGreaterThanOrEqual(300);

    // ── Data Binding: produce → accept → pass; source/format/anchor correct ──
    const dataBinding = p!.steps.find((s) => s.label === 'Data Binding')!;
    const dbOut = dataBinding.produce(entity);
    expect(dataBinding.accept(dbOut.data ?? {}).status).toBe('pass');
    const db = dbOut.data!.dataBinding as Record<string, unknown>;
    expect(db.source).toBe('UARPGAttributeSet.Health / MaxHealth');
    expect(db.format).toBe('{cur}/{max}');
    expect(db.anchor).toBe('bottom-left');
    // Wiring contract declared on Data Binding
    const dbWiring = db.wiringContract as Record<string, unknown>;
    expect(dbWiring).toBeDefined();
    expect(typeof dbWiring.grantedBy).toBe('string');
    expect(typeof dbWiring.activatedBy).toBe('string');
    expect(Array.isArray(dbWiring.dependencies)).toBe(true);
    expect(typeof dbWiring.verification).toBe('string');
    // Top-level typed link to icon-sets
    expect(dbOut.links).toBeDefined();
    const dbLinks = dbOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(dbLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);

    // ── State Logic: produce → accept → pass; thresholds correct ─────────────
    const stateLogic = p!.steps.find((s) => s.label === 'State Logic')!;
    const slOut = stateLogic.produce(entity);
    expect(stateLogic.accept(slOut.data ?? {}).status).toBe('pass');
    const sl = slOut.data!.stateLogic as Record<string, unknown>;
    expect(sl.lowHealthThreshold).toBe(0.25);
    expect(sl.criticalThreshold).toBe(0.10);

    // ── Wireframe: selected L1 → pass ─────────────────────────────────────────
    const wireframe = p!.steps.find((s) => s.label === 'Wireframe')!;
    const wfOut = wireframe.produce(entity);
    expect(wireframe.accept(wfOut.data ?? {}).status).toBe('pass');
    expect(wireframe.accept(wfOut.data ?? {}).tier).toBe('L1');

    // ── Icon 2D Art: selected L1 → pass; link to icon-sets::iconset-abilities ─
    const iconStep = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconOut = iconStep.produce(entity);
    expect(iconStep.accept(iconOut.data ?? {}).status).toBe('pass');
    expect(iconStep.accept(iconOut.data ?? {}).tier).toBe('L1');
    expect(iconOut.ueAssets).toBeDefined();
    // Icon assets carry the slug
    expect(iconOut.ueAssets!.some((a) => a.includes('HealthBar') || a.includes('Icon'))).toBe(true);
    // Link to icon-sets declared
    const iconLinks = iconOut.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(iconLinks).toBeDefined();
    expect(iconLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);

    // ── Animation: produce → accept → pass (≥4 checks) ───────────────────────
    const animStep = p!.steps.find((s) => s.label === 'Animation')!;
    const animOut = animStep.produce(entity);
    expect(animStep.accept(animOut.data ?? {}).status).toBe('pass');
    const animChecks = animOut.data!.animChecks as string[];
    expect(animChecks.length).toBeGreaterThanOrEqual(4);

    // ── Accessibility: produce → accept → pass (≥4 checks, art-icon-a11y) ────
    const a11yStep = p!.steps.find((s) => s.label === 'Accessibility')!;
    const a11yOut = a11yStep.produce(entity);
    expect(a11yStep.accept(a11yOut.data ?? {}).status).toBe('pass');
    const a11yChecks = a11yOut.data!.a11yChecks as string[];
    expect(a11yChecks.length).toBeGreaterThanOrEqual(4);
    // Must mention AA contrast (art-icon-a11y)
    expect(a11yChecks.some((c) => c.toLowerCase().includes('aa contrast') || c.toLowerCase().includes('contrast'))).toBe(true);
    // Must mention colorblind
    expect(a11yChecks.some((c) => c.toLowerCase().includes('colorblind'))).toBe(true);

    // ── Localization: produce → accept → pass (≥3 checks) ────────────────────
    const l10nStep = p!.steps.find((s) => s.label === 'Localization')!;
    const l10nOut = l10nStep.produce(entity);
    expect(l10nStep.accept(l10nOut.data ?? {}).status).toBe('pass');
    const l10nChecks = l10nOut.data!.l10nChecks as string[];
    expect(l10nChecks.length).toBeGreaterThanOrEqual(3);

    // ── Test Gate: always deferred L3 (VSHUDElementTest in UE) ──────────────
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });
    expect(gate.accept({ testChecks: ['done'] })).toMatchObject({ tier: 'L3', status: 'deferred' });

    // ── UE Packaging: ≥2 assets, WBP present, wiring contract declared ────────
    const packaging = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgOut = packaging.produce(entity);
    expect(packaging.accept(pkgOut.data ?? {}).status).toBe('pass');
    const assets = pkgOut.data!.assets as string[];
    expect(assets.length).toBeGreaterThanOrEqual(2);
    expect(assets.some((a) => a.startsWith('WBP_'))).toBe(true);
    // Wiring contract on UE Packaging
    const pkgWiring = pkgOut.data!.wiringContract as Record<string, unknown>;
    expect(pkgWiring.grantedBy).toBeDefined();
    expect(pkgWiring.activatedBy).toBeDefined();
    expect(Array.isArray(pkgWiring.dependencies)).toBe(true);
    expect(pkgWiring.verification).toBeDefined();
    // Link to icon-sets on packaging
    const pkgLinks = pkgOut.links as Array<{ catalogId: string; entityId: string }>;
    expect(pkgLinks).toBeDefined();
    expect(pkgLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);
  });
});
