import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('codex pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "codex" with correct step labels, Cross-References acceptance, and wiring', async () => {
    await import('@/lib/catalog/pipelines/codex');
    const p = getCatalogPipeline('codex');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);

    // All required steps present
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('Lore Body');
    expect(labels).toContain('Cross-References');
    expect(labels).toContain('Unlock Rules');
    expect(labels).toContain('Spoiler Tagging');
    expect(labels).toContain('Illustration');
    expect(labels).toContain('Audio Sting');
    expect(labels).toContain('Accessibility');
    expect(labels).toContain('Localization');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    const entity = { id: 'codex-sundering', name: 'The Sundering', lifecycle: 'planned' as const, data: {} };

    // ── Concept Brief: produce → accept → pass ────────────────────────────────
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    expect(brief.accept(brief.produce(entity).data ?? {}).status).toBe('pass');

    // ── Lore Body: produce → accept → pass ────────────────────────────────────
    const loreBody = p!.steps.find((s) => s.label === 'Lore Body')!;
    const loreResult = loreBody.accept(loreBody.produce(entity).data ?? {});
    expect(loreResult.status).toBe('pass');

    // ── Cross-References: the KEY graph step ──────────────────────────────────
    // graphValid: all nodes reachable from [0], no dangling edges, ≥1 terminal → pass
    const xref = p!.steps.find((s) => s.label === 'Cross-References')!;
    const xrefOutput = xref.produce(entity);

    // archetype and view
    expect(xref.archetype).toBe('graph');
    expect((xref.view as { kind: string }).kind).toBe('graph');

    // produced graph is structurally valid
    const xrefResult = xref.accept(xrefOutput.data ?? {});
    expect(xrefResult.status).toBe('pass');
    expect(xrefResult.tier).toBe('L0');

    // graph has at least one terminal
    const g = (xrefOutput.data ?? {}).graph as {
      nodes: Array<{ id: string; terminal?: boolean }>;
      edges: Array<{ from: string; to: string }>;
    };
    const terminals = g.nodes.filter((n) => n.terminal);
    expect(terminals.length).toBeGreaterThanOrEqual(1);

    // expected terminal ids (leaf concepts)
    const terminalIds = terminals.map((n) => n.id);
    expect(terminalIds).toContain('concept-classified-testimony');
    expect(terminalIds).toContain('concept-magical-use-prohibition');

    // root node is codex-sundering
    expect(g.nodes[0].id).toBe('codex-sundering');

    // all three catalog entity nodes present
    const nodeIds = g.nodes.map((n) => n.id);
    expect(nodeIds).toContain('faction-ashen-order');
    expect(nodeIds).toContain('zone-z-ashen');
    expect(nodeIds).toContain('char-captain-vael');

    // cross-catalog links on Cross-References step
    const xrefLinks = xrefOutput.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(xrefLinks).toBeDefined();
    expect(xrefLinks.some((l) => l.catalogId === 'factions'   && l.entityId === 'faction-ashen-order')).toBe(true);
    expect(xrefLinks.some((l) => l.catalogId === 'zone-map'   && l.entityId === 'zone-z-ashen')).toBe(true);
    expect(xrefLinks.some((l) => l.catalogId === 'characters' && l.entityId === 'char-captain-vael')).toBe(true);

    // ── Unlock Rules: produce → accept → pass ────────────────────────────────
    const unlock = p!.steps.find((s) => s.label === 'Unlock Rules')!;
    expect(unlock.accept(unlock.produce(entity).data ?? {}).status).toBe('pass');

    // ── Spoiler Tagging: produce → accept → pass ──────────────────────────────
    const spoiler = p!.steps.find((s) => s.label === 'Spoiler Tagging')!;
    expect(spoiler.accept(spoiler.produce(entity).data ?? {}).status).toBe('pass');

    // ── Illustration: universal icon step, links iconset-abilities ────────────
    const illus = p!.steps.find((s) => s.label === 'Illustration')!;
    expect(illus.archetype).toBe('gallery');
    const illusOutput = illus.produce(entity);
    const illusLinks = illusOutput.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(illusLinks).toBeDefined();
    expect(illusLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);

    // ── Audio Sting: produce → accept → pass ──────────────────────────────────
    const audio = p!.steps.find((s) => s.label === 'Audio Sting')!;
    expect(audio.accept(audio.produce(entity).data ?? {}).status).toBe('pass');

    // ── Accessibility: produce → accept → pass ────────────────────────────────
    const a11y = p!.steps.find((s) => s.label === 'Accessibility')!;
    expect(a11y.accept(a11y.produce(entity).data ?? {}).status).toBe('pass');

    // ── Localization: produce → accept → pass ─────────────────────────────────
    const loc = p!.steps.find((s) => s.label === 'Localization')!;
    expect(loc.accept(loc.produce(entity).data ?? {}).status).toBe('pass');

    // ── UE Packaging: produce → accept → pass ─────────────────────────────────
    const pkg = p!.steps.find((s) => s.label === 'UE Packaging')!;
    expect(pkg.accept(pkg.produce(entity).data ?? {}).status).toBe('pass');

    // ── Test Gate: deferred L3 ────────────────────────────────────────────────
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });

    // ── No staticChecks on any step (codex is pure content — no C++ symbol gates) ─
    p!.steps.forEach((s) => {
      expect(s.staticChecks).toBeUndefined();
    });
  });
});
