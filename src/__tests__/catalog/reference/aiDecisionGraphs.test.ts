import { describe, expect, it } from 'vitest';
import { graphValid } from '@/lib/catalog/acceptance/graphCheckers';
import { SOURCED_FIELD } from '@/lib/catalog/acceptance/sourced';
import {
  D1_AI_DECISION_GRAPH_FINDINGS,
  D1_AI_DECISION_GRAPHS,
  aiDecisionGraphEntities,
  aiPersonality,
  evaluateAiDecisionGraph,
  seedAiDecisionGraphSteps,
  type AiDecisionGraph,
} from '@/lib/catalog/reference/aiDecisionGraphs';
import { D1_AI_ROUTINES } from '@/lib/catalog/reference/aiRoutines';
import { collectLinkedReferences, linkedReferencesBlock } from '@/lib/catalog/reference/linkedReferences';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const monster = (id: string, file: string, ai: string): ReferenceWrapper => ({
  wrapperId: `synthetic:${id}`,
  sourceId: 'synthetic',
  file,
  technique: 'synthetic',
  key: id,
  keyKind: 'column',
  raw: { ai },
  rawHash: 'synthetic',
  catalogId: 'bestiary',
  entity: {
    id,
    catalogId: 'bestiary',
    name: id,
    categoryPath: [],
    tags: [],
    lifecycle: 'planned',
    data: {},
    provenance: {
      kind: 'ingest', sourceGame: 'Synthetic', sourceProject: 'Synthetic', sourceFile: file,
      sourceRow: id, licenceNote: 'test fixture', ingestedAt: 'test-time',
    },
  },
  mappingVersion: 'synthetic',
});

describe('Diablo I per-routine AI decision graphs', () => {
  it('defines one Stand-rooted graph for every routine and terminal action/attempt leaves', () => {
    expect(Object.keys(D1_AI_DECISION_GRAPHS)).toEqual(Object.keys(D1_AI_ROUTINES));
    expect(Object.keys(D1_AI_DECISION_GRAPHS)).toHaveLength(33);

    for (const graph of Object.values(D1_AI_DECISION_GRAPHS)) {
      expect(graph.root).toBe('Stand');
      expect(graph.nodes.find((node) => node.id === graph.root)?.kind).toBe('decision');
      const actionIds = new Set(graph.nodes.filter((node) => node.kind === 'action').map((node) => node.id));
      const attemptIds = new Set(graph.nodes.filter((node) => node.kind === 'walk-attempt').map((node) => node.id));
      expect(actionIds.size + attemptIds.size, graph.routine).toBeGreaterThan(0);
      expect(graph.edges.some((edge) => actionIds.has(edge.from) || attemptIds.has(edge.from)), graph.routine).toBe(false);

      for (const node of graph.nodes) {
        if (node.kind !== 'walk-attempt') continue;
        expect(node.action, `${graph.routine} ${node.id}`).toBe('Walk');
        expect(node.walkAttempt?.directionOrder.length, `${graph.routine} ${node.id}`).toBeGreaterThan(0);
        expect(node.walkAttempt?.sourceRefs.every((source) => /monster\.cpp:\d+/.test(source)), `${graph.routine} ${node.id}`).toBe(true);
      }
      expect(graph.nodes.some((node) => node.kind === 'action' && node.action === 'Walk'), graph.routine).toBe(false);

      for (const node of graph.nodes) {
        if (node.kind !== 'action' || node.action !== 'Delay' || node.pause?.base !== 0) continue;
        expect(node.immediateReturn, `${graph.routine} ${node.id}`).toMatchObject({
          condition: 'the generated delay is zero ticks',
        });
      }
    }
  });

  it('keeps every machine-readable roll chance attached to its source table object', () => {
    for (const graph of Object.values(D1_AI_DECISION_GRAPHS)) {
      for (const edge of graph.edges.filter((candidate) => candidate.rollSource)) {
        const source = edge.rollSource!;
        expect(edge.chance, `${graph.routine} ${edge.from}->${edge.to}`).toBe(D1_AI_ROUTINES[source.routine].rolls[source.rollIndex].chance);
      }
    }
  });

  it('records shared-ranged blocked retreats and zero delays as same-call continuations', () => {
    for (const routine of ['GoatRanged', 'LazarusSuccubus'] as const) {
      const graph = D1_AI_DECISION_GRAPHS[routine];
      const retreat = graph.nodes.find((node) => node.kind === 'walk-attempt'
        && node.walkAttempt?.failure.outcome === 'fall-through');
      const zeroDelay = graph.nodes.find((node) => node.kind === 'action' && node.immediateReturn);

      expect(retreat?.kind === 'walk-attempt' ? retreat.walkAttempt?.failure.detail : undefined, routine)
        .toContain('may fire in the same AI call');
      expect(zeroDelay?.kind === 'action' ? zeroDelay.immediateReturn?.outcome : undefined, routine)
        .toContain('same AI call');
    }
  });

  it('has no table/source disagreements after the routine-table audit', () => {
    expect(D1_AI_DECISION_GRAPH_FINDINGS).toEqual([]);
  });

  it('builds 33 state-graph entities with graphValid SOURCED seeds and named generic gaps', () => {
    const wrappers = aiDecisionGraphEntities();
    expect(wrappers).toHaveLength(33);
    expect(new Set(wrappers.map((wrapper) => wrapper.entity.id)).size).toBe(33);
    for (const wrapper of wrappers) {
      const seeds = seedAiDecisionGraphSteps(wrapper.entity);
      expect(seeds.map((seed) => seed.step)).toEqual(['Concept Brief', 'State Graph', 'Transition Rules']);
      expect(seeds.every((seed) => seed.data[SOURCED_FIELD] != null)).toBe(true);
      const stateGraph = seeds.find((seed) => seed.step === 'State Graph')!.data.graph;
      expect(graphValid('graph', 'valid')({ graph: stateGraph }).status, wrapper.entity.id).toBe('pass');
      expect(Object.keys(wrapper.entity.data.stepGaps as object).sort()).toEqual([
        'Blackboard Schema', 'Hook Points', 'Icon 2D Art', 'Persistence', 'Test Gate', 'UE Packaging',
      ].sort());
    }
  });

  it('links ordinary and unique monsters to the graph for their resolved routine', () => {
    const ordinary = monster('d1-MT_COUNSLR', 'monsters/monstdat.tsv', 'Counselor');
    const unique = monster('d1-uniq-counselor', 'monsters/unique_monstdat.tsv', 'Counselor');
    const other = monster('d1-MT_ZOMBIE', 'monsters/monstdat.tsv', 'Zombie');
    const graphs = aiDecisionGraphEntities([ordinary, unique, other]);
    const counselor = graphs.find((wrapper) => wrapper.entity.id === 'd1-ai-counselor')!.entity;

    expect(counselor.links).toEqual([
      { catalogId: 'bestiary', entityId: ordinary.entity.id, role: 'host' },
      { catalogId: 'bestiary', entityId: unique.entity.id, role: 'host' },
    ]);
    expect(counselor.data).not.toHaveProperty('monsters');
  });

  it('puts the Counselor graph in d1-MT_COUNSLR linked references within the character budget', () => {
    const counselor = monster('d1-MT_COUNSLR', 'monsters/monstdat.tsv', 'Counselor').entity;
    const graph = aiDecisionGraphEntities([
      monster('d1-MT_COUNSLR', 'monsters/monstdat.tsv', 'Counselor'),
    ]).find((wrapper) => wrapper.entity.id === 'd1-ai-counselor')!.entity;
    const linked = collectLinkedReferences(counselor, [counselor, graph]);
    const block = linkedReferencesBlock(counselor, [counselor, graph]);

    expect(linked.map((entity) => entity.id)).toEqual(['d1-ai-counselor']);
    expect(block).toContain('## Linked reference: state-graph d1-ai-counselor');
    expect(block).toContain('"routine":"Counselor"');
    expect(block).not.toContain('TRUNCATED');
  });
});

describe('AI personality arithmetic', () => {
  const synthetic: AiDecisionGraph = {
    id: 'synthetic',
    routine: 'Zombie',
    lawId: 'synthetic-law',
    root: 'Stand',
    nodes: [
      { id: 'Stand', kind: 'decision', decision: 'distance', label: 'Stand' },
      { id: 'roll', kind: 'decision', decision: 'roll', label: 'synthetic roll' },
      { id: 'attack', kind: 'action', label: 'MeleeAttack', action: 'MeleeAttack', category: 'attack', terminal: true },
      {
        id: 'delay', kind: 'action', label: 'Delay', action: 'Delay', category: 'wait', terminal: true,
        pause: { base: 10, perIntelligence: 2, randomMax: 4 },
      },
    ],
    edges: [
      { from: 'Stand', to: 'roll', label: 'adjacent', condition: 'adjacent' },
      {
        from: 'roll', to: 'attack', label: 'success', condition: 'success',
        chance: { linear: { perIntelligence: 10, base: 20 } }, chanceOutcome: 'success',
      },
      {
        from: 'roll', to: 'delay', label: 'failure', condition: 'failure',
        chance: { linear: { perIntelligence: 10, base: 20 } }, chanceOutcome: 'failure',
      },
    ],
    profileEntrypoints: [{ nodeId: 'roll', band: 'adjacent', context: 'ordinary', role: 'adjacent', primary: true }],
    sourceRefs: [],
    findings: [],
  };

  it('computes a hand-checked linear action mix and weighted pause', () => {
    const [band] = evaluateAiDecisionGraph(synthetic, 2);
    expect(band.actionMix).toEqual({
      status: 'evaluated',
      value: { attack: 0.4, approach: 0, wait: 0.6, special: 0 },
    });
    // Failure probability 0.6 times mean pause ((10 - 2*2) + mean[0..4]) = 8.
    expect(band.expectedPauseTicks).toEqual({ status: 'evaluated', value: 4.8 });
  });

  it('reports expression chances as unevaluated instead of assigning a probability', () => {
    const expressionGraph: AiDecisionGraph = {
      ...synthetic,
      edges: synthetic.edges.map((edge) => edge.chance
        ? { ...edge, chance: { expression: 'external state distribution' } }
        : edge),
    };
    const [band] = evaluateAiDecisionGraph(expressionGraph, 2);
    expect(band.actionMix).toEqual({ status: 'unevaluated', expressions: ['external state distribution'] });
    expect(band.expectedPauseTicks).toEqual({ status: 'unevaluated', expressions: ['external state distribution'] });
  });

  it('keeps a failed walk and zero-delay continuation as attempt outcomes in a synthetic routine', () => {
    const attemptGraph: AiDecisionGraph = {
      ...synthetic,
      nodes: [
        { id: 'Stand', kind: 'decision', decision: 'distance', label: 'Stand' },
        { id: 'roll', kind: 'decision', decision: 'roll', label: 'synthetic attempt roll' },
        {
          id: 'walk',
          kind: 'walk-attempt',
          label: 'Walk attempt (Walk)',
          action: 'Walk',
          category: 'approach',
          terminal: true,
          walkAttempt: {
            helper: 'Walk',
            directionOrder: ['directly away'],
            failure: { outcome: 'fall-through', detail: 'Blocked: continue to the attack gate.' },
            sourceRefs: ['.reference/devilutionX/Source/monster.cpp:4144-4154'],
          },
        },
        {
          id: 'delay',
          kind: 'action',
          label: 'Delay',
          action: 'Delay',
          category: 'wait',
          terminal: true,
          pause: { base: 0, perIntelligence: 0, randomMax: 1 },
          immediateReturn: {
            condition: 'the generated delay is zero ticks',
            outcome: 'Continue to the attack gate in the same AI call.',
            sourceRefs: ['.reference/devilutionX/Source/monster.cpp:755-758'],
          },
        },
      ],
      edges: [
        { from: 'Stand', to: 'roll', label: 'range', condition: 'range' },
        {
          from: 'roll', to: 'walk', label: 'walk branch', condition: 'walk branch',
          chance: { linear: { perIntelligence: 0, base: 50 } }, chanceOutcome: 'success',
        },
        {
          from: 'roll', to: 'delay', label: 'delay branch', condition: 'delay branch',
          chance: { linear: { perIntelligence: 0, base: 50 } }, chanceOutcome: 'failure',
        },
      ],
      profileEntrypoints: [{ nodeId: 'roll', band: 'range', context: 'synthetic', role: 'range', primary: true }],
    };

    const [band] = evaluateAiDecisionGraph(attemptGraph, 0);
    expect(band.actionMix).toEqual({
      status: 'evaluated',
      value: { attack: 0, approach: 0.5, wait: 0.5, special: 0 },
    });
    expect(band.expectedPauseTicks).toEqual({ status: 'evaluated', value: 0.25 });
    expect(attemptGraph.nodes.find((node) => node.id === 'walk')).toMatchObject({
      walkAttempt: { failure: { outcome: 'fall-through' } },
    });
    expect(attemptGraph.nodes.find((node) => node.id === 'delay')).toMatchObject({
      immediateReturn: { condition: 'the generated delay is zero ticks' },
    });
  });

  it('exposes the expected adjacent Zombie aggression from the generated graph', () => {
    const profile = aiPersonality('Zombie', 0);
    expect(profile.aggression).toEqual({ status: 'evaluated', value: 0.1 });
    expect(profile.attackAttemptRate).toBe(profile.aggression);
    expect(profile.approachAttemptRate).toBe(profile.approachRate);
    expect(profile.rateBasis).toContain('attempts per Stand decision');
    expect(() => aiPersonality('Zombie', 4)).toThrow('integer from 0 through 3');
  });
});
