import { describe, expect, it } from 'vitest';
import { graphValid } from '@/lib/catalog/acceptance/graphCheckers';
import { SOURCED_FIELD } from '@/lib/catalog/acceptance/sourced';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import {
  DIABLO1_STATE_GRAPH_LAWS,
  seedStateGraphSteps,
  stateGraphEntities,
  stateGraphShape,
  STATE_GRAPH_SPECS,
  type StateGraphSpec,
} from '@/lib/catalog/reference/stateGraphSpecs';

const reachableFromRoot = (spec: StateGraphSpec): Set<string> => {
  const adjacent = new Map<string, string[]>();
  for (const edge of spec.transitions) {
    adjacent.set(edge.from, [...(adjacent.get(edge.from) ?? []), edge.to]);
  }
  const seen = new Set([spec.rootState]);
  const pending = [spec.rootState];
  while (pending.length > 0) {
    const from = pending.pop()!;
    for (const to of adjacent.get(from) ?? []) {
      if (seen.has(to)) continue;
      seen.add(to);
      pending.push(to);
    }
  }
  return seen;
};

describe('Diablo I engine-derived state graphs', () => {
  it('projects the exact MonsterMode and PLR_MODE enumerators as two engine entities', () => {
    expect(stateGraphEntities().map((wrapper) => wrapper.entity.id)).toEqual([
      'd1-state-monster',
      'd1-state-player',
    ]);

    const monster = STATE_GRAPH_SPECS.find((spec) => spec.actor === 'monster')!;
    expect(monster.states.map((candidate) => candidate.id)).toEqual([
      'Stand', 'MoveNorthwards', 'MoveSouthwards', 'MoveSideways', 'MeleeAttack',
      'HitRecovery', 'Death', 'SpecialMeleeAttack', 'FadeIn', 'FadeOut', 'RangedAttack',
      'SpecialStand', 'SpecialRangedAttack', 'Delay', 'Charge', 'Petrified', 'Heal', 'Talk',
    ]);
    expect(monster.goalOverlay?.states.map((candidate) => candidate.id)).toEqual([
      'Normal', 'Retreat', 'Healing', 'Move', 'Attack', 'Inquiring', 'Talking',
    ]);

    const player = STATE_GRAPH_SPECS.find((spec) => spec.actor === 'player')!;
    expect(player.states.map((candidate) => candidate.id)).toEqual([
      'PM_STAND', 'PM_WALK_NORTHWARDS', 'PM_WALK_SOUTHWARDS', 'PM_WALK_SIDEWAYS',
      'PM_ATTACK', 'PM_RATTACK', 'PM_BLOCK', 'PM_GOTHIT', 'PM_DEATH', 'PM_SPELL',
      'PM_NEWLVL', 'PM_QUIT',
    ]);

    for (const wrapper of stateGraphEntities()) {
      expect(wrapper.entity.tags).toContain('engine-derived');
      expect(wrapper.entity.provenance.sourceFile).toContain('engine: Source/');
      expect(wrapper.entity.provenance.sourceRow).toContain('engine-derived');
    }
  });

  it('keeps every declared state reachable from its Stand root', () => {
    for (const spec of STATE_GRAPH_SPECS) {
      const reachable = reachableFromRoot(spec);
      expect([...reachable].sort(), spec.id).toEqual(spec.states.map((candidate) => candidate.id).sort());
    }
  });

  it('marks Death as terminal and gives it no outgoing transition', () => {
    for (const spec of STATE_GRAPH_SPECS) {
      const deathId = spec.actor === 'monster' ? 'Death' : 'PM_DEATH';
      expect(spec.states.find((candidate) => candidate.id === deathId)?.terminal).toBe(true);
      expect(spec.transitions.filter((candidate) => candidate.from === deathId)).toEqual([]);
    }
  });

  it('gives every transition pinned file-and-line references', () => {
    for (const spec of STATE_GRAPH_SPECS) {
      for (const edge of [
        ...spec.transitions,
        ...(spec.goalOverlay?.transitions ?? []),
      ]) {
        expect(edge.refs.length, `${spec.id} ${edge.from}->${edge.to}`).toBeGreaterThan(0);
        expect(edge.refs.every((ref) => /^\.reference\/devilutionX\/Source\/.+:\d+$/.test(ref))).toBe(true);
      }
    }
  });

  it('generates concise canon laws from the same graph specifications', () => {
    expect(DIABLO1_STATE_GRAPH_LAWS).toHaveLength(2);
    for (const law of DIABLO1_STATE_GRAPH_LAWS) {
      expect(law.body.length).toBeLessThanOrEqual(450);
      expect(law.refs?.every((ref) => ref.startsWith('https://github.com/diasurgical/devilutionX/blob/4138a82/Source/'))).toBe(true);
      expect(DIABLO1_CANON.some((candidate) => candidate.id === law.id)).toBe(true);
    }
  });
});

describe('state-graph pipeline projection and sourced seeds', () => {
  it('projects synthetic engine data into the exact graphValid node/edge shape', () => {
    const graph = stateGraphShape({
      states: [
        { id: 'Stand', meaning: 'root', durationRule: 'until action', refs: [] },
        { id: 'Act', meaning: 'finite action', durationRule: 'one update', refs: [] },
        { id: 'Death', meaning: 'terminal', durationRule: 'forever', refs: [], terminal: true },
      ],
      transitions: [
        { from: 'Stand', to: 'Act', trigger: 'command', refs: [] },
        { from: 'Act', to: 'Stand', trigger: 'complete', refs: [] },
        { from: 'Stand', to: 'Death', trigger: 'lethal event', refs: [] },
      ],
    });
    expect(graphValid('graph', 'valid')({ graph }).status).toBe('pass');
    expect(graph.nodes.find((candidate) => candidate.id === 'Death')?.terminal).toBe(true);
  });

  it('seeds only fillable checker shapes and names every generic-asset mismatch', () => {
    for (const wrapper of stateGraphEntities()) {
      const seeds = seedStateGraphSteps(wrapper.entity);
      expect(seeds.map((seed) => seed.step)).toEqual([
        'Concept Brief', 'State Graph', 'Transition Rules', 'Persistence',
      ]);
      expect(seeds.every((seed) => seed.data[SOURCED_FIELD] != null)).toBe(true);

      const graph = seeds.find((seed) => seed.step === 'State Graph')!.data.graph;
      expect(graphValid('graph', 'valid')({ graph }).status).toBe('pass');

      const transitions = seeds.find((seed) => seed.step === 'Transition Rules')!.data.transitions as Array<Record<string, unknown>>;
      expect(transitions.length).toBeGreaterThanOrEqual(6);
      expect(transitions.every((edge) => ['from', 'to', 'guard', 'priority'].every((key) => edge[key] != null))).toBe(true);

      const persistence = seeds.find((seed) => seed.step === 'Persistence')!.data.persistence as Array<Record<string, unknown>>;
      expect(persistence.some((field) => field.saved === true)).toBe(true);
      expect(persistence.some((field) => field.saved === false)).toBe(true);

      const gaps = wrapper.entity.data.stepGaps as Record<string, string>;
      expect(Object.keys(gaps).sort()).toEqual([
        'Blackboard Schema', 'Hook Points', 'Icon 2D Art', 'Test Gate', 'UE Packaging',
      ].sort());
      expect(seeds.flatMap((seed) => seed.gaps).join(' ')).toContain('wiringContract');
    }
  });
});
