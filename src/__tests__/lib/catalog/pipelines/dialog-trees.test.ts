import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('dialog-trees pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "dialog-trees" with correct step labels, Branch Graph acceptance, and wiring', async () => {
    await import('@/lib/catalog/pipelines/dialog-trees');
    const p = getCatalogPipeline('dialog-trees');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);

    // All required steps present
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Branch Graph');
    expect(labels).toContain('Conditions & Effects');
    expect(labels).toContain('Skill Checks');
    expect(labels).toContain('VO Script');
    expect(labels).toContain('Camera');
    expect(labels).toContain('Subtitles & Choices UI');
    expect(labels).toContain('Localization');
    expect(labels).toContain('Accessibility');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    const entity = { id: 'dialog-gatekeeper', name: 'Gatekeeper Greeting', lifecycle: 'planned' as const, data: {} };

    // ── Concept Brief: produce → accept → pass ────────────────────────────────
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    expect(brief.accept(brief.produce(entity).data ?? {}).status).toBe('pass');

    // ── Branch Graph: the KEY graph step ─────────────────────────────────────
    // graphValid: all nodes reachable from [0], no dangling edges, ≥1 terminal → pass
    const graph = p!.steps.find((s) => s.label === 'Branch Graph')!;
    const graphOutput = graph.produce(entity);

    // archetype and view
    expect(graph.archetype).toBe('graph');
    expect((graph.view as { kind: string }).kind).toBe('graph');

    // produced graph is structurally valid
    const graphResult = graph.accept(graphOutput.data ?? {});
    expect(graphResult.status).toBe('pass');
    expect(graphResult.tier).toBe('L0');

    // graph has at least one terminal
    const g = (graphOutput.data ?? {}).graph as { nodes: Array<{ id: string; terminal?: boolean }> };
    const terminals = g.nodes.filter((n) => n.terminal);
    expect(terminals.length).toBeGreaterThanOrEqual(1);

    // expected specific terminal ids
    const terminalIds = terminals.map((n) => n.id);
    expect(terminalIds).toContain('dismissed');
    expect(terminalIds).toContain('hostile');
    expect(terminalIds).toContain('ember_pact_unlocked');

    // cross-catalog links on Branch Graph (characters + quests)
    const links = graphOutput.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(links).toBeDefined();
    expect(links.some((l) => l.catalogId === 'characters' && l.entityId === 'char-captain-vael')).toBe(true);
    expect(links.some((l) => l.catalogId === 'quests'     && l.entityId === 'quest-ember-pact')).toBe(true);

    // ── Conditions & Effects: produce → accept → pass ─────────────────────────
    const cond = p!.steps.find((s) => s.label === 'Conditions & Effects')!;
    expect(cond.accept(cond.produce(entity).data ?? {}).status).toBe('pass');

    // ── Skill Checks: produce → accept → pass ─────────────────────────────────
    const skill = p!.steps.find((s) => s.label === 'Skill Checks')!;
    const skillOutput = skill.produce(entity);
    expect(skill.accept(skillOutput.data ?? {}).status).toBe('pass');
    // the skill-check rule references Intelligence ≥ 14
    const checks = (skillOutput.data ?? {}).skillChecks as Array<{ attribute: string; threshold: number }>;
    expect(checks[0].attribute).toBe('Intelligence');
    expect(checks[0].threshold).toBe(14);

    // ── VO Script: produce → accept → pass ────────────────────────────────────
    const vo = p!.steps.find((s) => s.label === 'VO Script')!;
    expect(vo.accept(vo.produce(entity).data ?? {}).status).toBe('pass');

    // ── Camera: produce → accept → pass ───────────────────────────────────────
    const cam = p!.steps.find((s) => s.label === 'Camera')!;
    expect(cam.accept(cam.produce(entity).data ?? {}).status).toBe('pass');

    // ── Subtitles & Choices UI: produce → accept → pass ───────────────────────
    const ui = p!.steps.find((s) => s.label === 'Subtitles & Choices UI')!;
    expect(ui.accept(ui.produce(entity).data ?? {}).status).toBe('pass');

    // ── Localization: produce → accept → pass ─────────────────────────────────
    const loc = p!.steps.find((s) => s.label === 'Localization')!;
    expect(loc.accept(loc.produce(entity).data ?? {}).status).toBe('pass');

    // ── Accessibility: produce → accept → pass ────────────────────────────────
    const a11y = p!.steps.find((s) => s.label === 'Accessibility')!;
    expect(a11y.accept(a11y.produce(entity).data ?? {}).status).toBe('pass');

    // ── UE Packaging: produce → accept → pass ─────────────────────────────────
    const pkg = p!.steps.find((s) => s.label === 'UE Packaging')!;
    expect(pkg.accept(pkg.produce(entity).data ?? {}).status).toBe('pass');

    // ── Test Gate: deferred L3 ────────────────────────────────────────────────
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });

    // ── Icon 2D Art: links iconset-abilities ──────────────────────────────────
    const icon = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconOutput = icon.produce(entity);
    const iconLinks = iconOutput.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(iconLinks).toBeDefined();
    expect(iconLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);

    // ── No staticChecks on any step (no C++ symbol needed for dialog-trees) ───
    p!.steps.forEach((s) => {
      expect(s.staticChecks).toBeUndefined();
    });
  });
});
