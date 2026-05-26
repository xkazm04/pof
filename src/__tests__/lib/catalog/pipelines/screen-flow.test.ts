import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('screen-flow pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "screen-flow" with correct step labels, Navigation Graph acceptance, and wiring', async () => {
    await import('@/lib/catalog/pipelines/screen-flow');
    const p = getCatalogPipeline('screen-flow');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);

    // All required steps present
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Navigation Graph');
    expect(labels).toContain('Input Mapping');
    expect(labels).toContain('Component Inventory');
    expect(labels).toContain('Transitions / Animation');
    expect(labels).toContain('VFX / SFX Juice');
    expect(labels).toContain('Accessibility');
    expect(labels).toContain('Localization');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    // Use a REAL seeded screen entity id (seed-screen-flow.ts generates 'screen-HUD' from FLOW_NODES[0])
    const entity = { id: 'screen-HUD', name: 'HUD', lifecycle: 'planned' as const, data: {} };

    // ── Concept Brief: produce → accept → pass ────────────────────────────────
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    expect(brief.accept(brief.produce(entity).data ?? {}).status).toBe('pass');

    // ── Navigation Graph: the KEY graph step ──────────────────────────────────
    // graphValid: all nodes reachable from [0], no dangling edges, ≥1 terminal → pass
    const nav = p!.steps.find((s) => s.label === 'Navigation Graph')!;
    const navOutput = nav.produce(entity);

    // archetype and view
    expect(nav.archetype).toBe('graph');
    expect((nav.view as { kind: string }).kind).toBe('graph');

    // produced graph is structurally valid
    const navResult = nav.accept(navOutput.data ?? {});
    expect(navResult.status).toBe('pass');
    expect(navResult.tier).toBe('L0');

    // graph has at least one terminal
    const g = (navOutput.data ?? {}).graph as {
      nodes: Array<{ id: string; terminal?: boolean }>;
      edges: Array<{ from: string; to: string }>;
    };
    const terminals = g.nodes.filter((n) => n.terminal);
    expect(terminals.length).toBeGreaterThanOrEqual(1);

    // expected specific terminal ids
    const terminalIds = terminals.map((n) => n.id);
    expect(terminalIds).toContain('quit_to_desktop');
    expect(terminalIds).toContain('in_game');

    // all core screens are represented as nodes
    const nodeIds = g.nodes.map((n) => n.id);
    expect(nodeIds).toContain('main_menu');
    expect(nodeIds).toContain('ingame_hud');
    expect(nodeIds).toContain('inventory_overlay');
    expect(nodeIds).toContain('pause_menu');
    expect(nodeIds).toContain('death_screen');

    // cross-catalog links: hud-health-bar and iconset-abilities
    const links = navOutput.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(links).toBeDefined();
    expect(links.some((l) => l.catalogId === 'hud-elements' && l.entityId === 'hud-health-bar')).toBe(true);
    expect(links.some((l) => l.catalogId === 'icon-sets'    && l.entityId === 'iconset-abilities')).toBe(true);

    // ── Input Mapping: produce → accept → pass ────────────────────────────────
    const input = p!.steps.find((s) => s.label === 'Input Mapping')!;
    const inputOutput = input.produce(entity);
    expect(input.accept(inputOutput.data ?? {}).status).toBe('pass');
    const inputRules = (inputOutput.data ?? {}).inputMapping as Array<{ action: string }>;
    expect(inputRules.length).toBeGreaterThanOrEqual(1);
    // IA_Pause must be declared
    expect(inputRules.some((r) => r.action === 'IA_Pause')).toBe(true);

    // ── Component Inventory: produce → accept → pass ──────────────────────────
    const comp = p!.steps.find((s) => s.label === 'Component Inventory')!;
    expect(comp.accept(comp.produce(entity).data ?? {}).status).toBe('pass');

    // ── Transitions / Animation: produce → accept → pass ─────────────────────
    const trans = p!.steps.find((s) => s.label === 'Transitions / Animation')!;
    expect(trans.accept(trans.produce(entity).data ?? {}).status).toBe('pass');

    // ── VFX / SFX Juice: produce → accept → pass ──────────────────────────────
    const juice = p!.steps.find((s) => s.label === 'VFX / SFX Juice')!;
    expect(juice.accept(juice.produce(entity).data ?? {}).status).toBe('pass');

    // ── Accessibility: produce → accept → pass ────────────────────────────────
    const a11y = p!.steps.find((s) => s.label === 'Accessibility')!;
    expect(a11y.accept(a11y.produce(entity).data ?? {}).status).toBe('pass');

    // ── Localization: produce → accept → pass ─────────────────────────────────
    const loc = p!.steps.find((s) => s.label === 'Localization')!;
    const locOutput = loc.produce(entity);
    expect(loc.accept(locOutput.data ?? {}).status).toBe('pass');
    const locKeys = (locOutput.data ?? {}).locChecks as string[];
    // localization keys use the entity slug
    expect(locKeys.some((k) => k.startsWith('UI_'))).toBe(true);

    // ── UE Packaging: produce → accept → pass ─────────────────────────────────
    const pkg = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgOutput = pkg.produce(entity);
    expect(pkg.accept(pkgOutput.data ?? {}).status).toBe('pass');
    const assets = (pkgOutput.data ?? {}).assets as string[];
    // Must include the core WBP_ screen assets
    expect(assets.some((a) => a.includes('WBP_MainMenu'))).toBe(true);
    expect(assets.some((a) => a.includes('WBP_InGameHUD'))).toBe(true);
    expect(assets.some((a) => a.includes('WBP_PauseMenu'))).toBe(true);

    // ── Test Gate: deferred L3 ────────────────────────────────────────────────
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });

    // ── Icon 2D Art: links iconset-abilities ──────────────────────────────────
    const icon = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconOutput = icon.produce(entity);
    const iconLinks = iconOutput.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(iconLinks).toBeDefined();
    expect(iconLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);

    // ── No staticChecks on any step (no C++ symbol gate required for screen-flow) ──
    p!.steps.forEach((s) => {
      expect(s.staticChecks).toBeUndefined();
    });
  });
});
