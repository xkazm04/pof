import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getCatalogPipeline } from '@/lib/catalog/pipeline-registry';

describe('state-graph pipeline', () => {
  beforeEach(() => _resetRegistry());

  it('registers under "state-graph" with correct step labels, State Graph acceptance, and wiring', async () => {
    await import('@/lib/catalog/pipelines/state-graph');
    const p = getCatalogPipeline('state-graph');
    expect(p).not.toBeNull();

    const labels = p!.steps.map((s) => s.label);

    // All required steps present
    expect(labels).toContain('Concept Brief');
    expect(labels).toContain('State Graph');
    expect(labels).toContain('Blackboard Schema');
    expect(labels).toContain('Transition Rules');
    expect(labels).toContain('Hook Points');
    expect(labels).toContain('Persistence');
    expect(labels).toContain('Icon 2D Art');
    expect(labels).toContain('Test Gate');
    expect(labels).toContain('UE Packaging');

    // Synthetic entity using a REAL seeded id (ALL_MONTAGES[0].id = 'atk-combo1' → 'anim-atk-combo1')
    const entity = {
      id: 'anim-atk-combo1',
      name: 'Enemy AI State Graph',
      lifecycle: 'planned' as const,
      data: {},
    };

    // ── Concept Brief: produce → accept → pass ────────────────────────────────
    const brief = p!.steps.find((s) => s.label === 'Concept Brief')!;
    const briefResult = brief.accept(brief.produce(entity).data ?? {});
    expect(briefResult.status).toBe('pass');
    expect(briefResult.tier).toBe('L0');

    // ── State Graph: the KEY graph step ──────────────────────────────────────
    // archetype: 'graph', view: { kind: 'graph', field: 'graph' }
    // graphValid: all 6 nodes reachable from IDLE[0], 13 edges, no dangling, ≥1 terminal → pass
    const graphStep = p!.steps.find((s) => s.label === 'State Graph')!;
    const graphOutput = graphStep.produce(entity);

    // archetype and view
    expect(graphStep.archetype).toBe('graph');
    expect((graphStep.view as { kind: string }).kind).toBe('graph');

    // produced graph is structurally valid (L0 pass)
    const graphResult = graphStep.accept(graphOutput.data ?? {});
    expect(graphResult.status).toBe('pass');
    expect(graphResult.tier).toBe('L0');

    // graph has the expected node ids
    const g = (graphOutput.data ?? {}).graph as {
      nodes: Array<{ id: string; terminal?: boolean }>;
      edges: Array<{ from: string; to: string; label?: string }>;
    };
    expect(g.nodes.length).toBeGreaterThanOrEqual(6);
    expect(g.edges.length).toBeGreaterThanOrEqual(6);

    const nodeIds = g.nodes.map((n) => n.id);
    expect(nodeIds).toContain('idle');
    expect(nodeIds).toContain('patrol');
    expect(nodeIds).toContain('chase');
    expect(nodeIds).toContain('attack');
    expect(nodeIds).toContain('flee');
    expect(nodeIds).toContain('dead');

    // at least one terminal node
    const terminals = g.nodes.filter((n) => n.terminal);
    expect(terminals.length).toBeGreaterThanOrEqual(1);

    // DEAD is the hard terminal
    const terminalIds = terminals.map((n) => n.id);
    expect(terminalIds).toContain('dead');

    // no outgoing edges from the hard terminal 'dead'
    const edgesFromDead = g.edges.filter((e) => e.from === 'dead');
    expect(edgesFromDead.length).toBe(0);

    // guards are present on at least the health-critical edges
    const chaseToFlee = g.edges.find((e) => e.from === 'chase' && e.to === 'flee');
    expect(chaseToFlee).toBeDefined();
    expect(chaseToFlee!.label).toMatch(/HealthPct/i);

    // ── State Graph: no cross-catalog links (state-graph is generic) ──────────
    // Icon step carries the iconset link; the graph step itself has no cross-catalog links.
    const graphLinks = graphOutput.links;
    expect(graphLinks).toBeUndefined();

    // ── Blackboard Schema: produce → accept → pass ────────────────────────────
    // minCount('blackboard', 7) — produce returns an 8-element array → pass
    const bb = p!.steps.find((s) => s.label === 'Blackboard Schema')!;
    const bbOutput = bb.produce(entity);
    const bbResult = bb.accept(bbOutput.data ?? {});
    expect(bbResult.status).toBe('pass');
    expect(bbResult.tier).toBe('L0');
    const bbKeys = (bbOutput.data ?? {}).blackboard as unknown[];
    expect(bbKeys.length).toBeGreaterThanOrEqual(7);

    // ── Transition Rules: produce → accept → pass ─────────────────────────────
    const tr = p!.steps.find((s) => s.label === 'Transition Rules')!;
    const trOutput = tr.produce(entity);
    const trResult = tr.accept(trOutput.data ?? {});
    expect(trResult.status).toBe('pass');
    // at least 6 transition rules declared (IDLE/PATROL/CHASE/ATTACK/FLEE cover 12 guards)
    const transitions = (trOutput.data ?? {}).transitions as unknown[];
    expect(transitions.length).toBeGreaterThanOrEqual(6);

    // ── Hook Points: produce → accept → pass ──────────────────────────────────
    const hooks = p!.steps.find((s) => s.label === 'Hook Points')!;
    const hooksOutput = hooks.produce(entity);
    const hooksResult = hooks.accept(hooksOutput.data ?? {});
    expect(hooksResult.status).toBe('pass');
    // DEAD hook should mention loot
    const hooksArr = (hooksOutput.data ?? {}).hooks as Array<{ state: string; event: string; binding: string }>;
    const deadHook = hooksArr.find((h) => h.state === 'dead');
    expect(deadHook).toBeDefined();
    expect(deadHook!.binding).toMatch(/loot/i);

    // ── Persistence: produce → accept → pass ──────────────────────────────────
    const persist = p!.steps.find((s) => s.label === 'Persistence')!;
    const persistResult = persist.accept(persist.produce(entity).data ?? {});
    expect(persistResult.status).toBe('pass');

    // ── Icon 2D Art: links iconset-abilities ──────────────────────────────────
    const icon = p!.steps.find((s) => s.label === 'Icon 2D Art')!;
    const iconOutput = icon.produce(entity);
    const iconLinks = iconOutput.links as Array<{ catalogId: string; entityId: string; role: string }>;
    expect(iconLinks).toBeDefined();
    expect(iconLinks.some((l) => l.catalogId === 'icon-sets' && l.entityId === 'iconset-abilities')).toBe(true);

    // ── UE Packaging: produce → accept → pass ─────────────────────────────────
    const pkg = p!.steps.find((s) => s.label === 'UE Packaging')!;
    const pkgResult = pkg.accept(pkg.produce(entity).data ?? {});
    expect(pkgResult.status).toBe('pass');

    // ── Test Gate: deferred L3 ────────────────────────────────────────────────
    const gate = p!.steps.find((s) => s.label === 'Test Gate')!;
    expect(gate.accept({})).toMatchObject({ tier: 'L3', status: 'deferred' });

    // ── UE Packaging has a staticCheck for UStateTreeComponent ────────────────
    const pkgStep = p!.steps.find((s) => s.label === 'UE Packaging')!;
    expect(pkgStep.staticChecks).toBeDefined();
    const staticCheckers = pkgStep.staticChecks!(entity);
    expect(staticCheckers.length).toBeGreaterThanOrEqual(1);
    // Running against null UE root → deferred (not fail)
    const staticResult = staticCheckers[0](null);
    expect(staticResult.tier).toBe('L2');
    expect(staticResult.status).toBe('deferred');
  });
});
