import { describe, expect, it } from 'vitest';
import { graphValid } from '@/lib/catalog/acceptance/graphCheckers';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { dialogueTrees } from '@/lib/catalog/reference/dialogueTrees';
import {
  monsterTalkTrees,
  seedMonsterTalkSteps,
  type MonsterTalkSpec,
} from '@/lib/catalog/reference/monsterTalk';
import { D1_MONSTER_TALK_SPECS } from '@/lib/catalog/reference/monsterTalkData';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

const provenance = {
  kind: 'ingest' as const,
  sourceGame: 'Synthetic',
  sourceProject: 'tests',
  sourceFile: 'synthetic.tsv',
  sourceRow: 'invented-row',
  licenceNote: 'invented test values',
  ingestedAt: 't0',
  canonProfile: 'diablo1',
};

function wrapper(
  id: string,
  catalogId: string,
  data: Record<string, unknown>,
  links: ReferenceWrapper['entity']['links'] = [],
  key = id,
): ReferenceWrapper {
  return {
    wrapperId: `test:${id}`, sourceId: 'test', file: 'synthetic.tsv', technique: 'test',
    key, keyKind: 'column', raw: {}, rawHash: 'raw', catalogId, mappingVersion: 'test',
    entity: {
      id, catalogId, name: 'Invented Speaker', categoryPath: [], lifecycle: 'planned', tags: [],
      data, links, provenance,
    },
  };
}

const syntheticSpec: MonsterTalkSpec = {
  monster: 'd1-uniq-synthetic-speaker',
  quest: 'Q_SYNTHETIC',
  terminal: 'hostility',
  states: [
    { id: 'hello', line: 'TEXT_SYNTH_HELLO', enters: 'invented entry', exits: 'invented visibility exit', effect: 'invented quest effect' },
    { id: 'threat', line: 'TEXT_SYNTH_THREAT', enters: 'invented second entry', exits: 'invented audio exit', effect: 'hostility' },
  ],
  refs: ['Source/monster.cpp:1-2'],
};

const host = wrapper(
  syntheticSpec.monster,
  'bestiary',
  {},
  [{ catalogId: 'dialog-trees', entityId: 'd1-TEXT_SYNTH_HELLO', role: 'talk-line' }],
);
const hello = wrapper(
  'd1-TEXT_SYNTH_HELLO',
  'dialog-trees',
  { text: 'An entirely invented greeting.', voiceClip: 'VOICE_SYNTH_HELLO', scrolling: false },
  [],
  'TEXT_SYNTH_HELLO',
);

describe('D1_MONSTER_TALK_SPECS', () => {
  it('covers all eight vanilla unique wrappers with source locations and no TEXT_VILE14 pseudo-line', () => {
    expect(D1_MONSTER_TALK_SPECS).toHaveLength(8);
    expect(new Set(D1_MONSTER_TALK_SPECS.map((spec) => spec.monster)).size).toBe(8);
    for (const spec of D1_MONSTER_TALK_SPECS) {
      expect(spec.monster).toMatch(/^d1-uniq-/);
      expect(spec.quest).toMatch(/^Q_/);
      expect(spec.refs.every((ref) => /^Source\/(monster|quests)\.cpp:\d+/.test(ref))).toBe(true);
      expect(spec.states.length).toBeGreaterThan(0);
      for (const state of spec.states) {
        expect(state.line).toMatch(/^TEXT_/);
        expect(state.line).not.toBe('TEXT_VILE14');
        expect([state.id, state.enters, state.exits, state.effect].every(Boolean)).toBe(true);
      }
    }
  });
});

describe('monsterTalkTrees', () => {
  const result = monsterTalkTrees([host, hello], [syntheticSpec]);

  it('builds a linked no-menu monster tree and reports every missing line wrapper', () => {
    expect(result.wrappers).toHaveLength(1);
    expect(result.unresolved).toEqual([
      { monster: 'd1-uniq-synthetic-speaker', line: 'TEXT_SYNTH_THREAT' },
    ]);
    const tree = result.wrappers[0].entity;
    expect(tree.id).toBe('d1-dialog-synthetic-speaker');
    expect(tree.links).toEqual([
      { catalogId: 'bestiary', entityId: 'd1-uniq-synthetic-speaker', role: 'host' },
      { catalogId: 'quests', entityId: 'd1-Q_SYNTHETIC', role: 'advances' },
    ]);
    expect(tree.data).toEqual({
      speaker: 'd1-uniq-synthetic-speaker',
      talker: 'monster',
      lines: [{
        line: 'TEXT_SYNTH_HELLO', text: 'An entirely invented greeting.',
        voiceClip: 'VOICE_SYNTH_HELLO', scrolling: false,
      }],
    });
  });

  it('leaves town aggregation byte-for-byte unchanged when monster wrappers are present', () => {
    const town = wrapper(
      'd1-TOWN_SYNTH', 'characters', {},
      [{ catalogId: 'dialog-trees', entityId: 'd1-TEXT_SYNTH_HELLO', role: 'gossip' }],
      'TOWN_SYNTH',
    );
    const before = dialogueTrees([town, hello]);
    const after = dialogueTrees([town, hello, host]);
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });
});

describe('seedMonsterTalkSteps', () => {
  const entity = monsterTalkTrees([host, hello], [syntheticSpec]).wrappers[0].entity;
  const seeds = seedMonsterTalkSteps(entity, [syntheticSpec]);

  it('seeds only SOURCED Branch Graph and VO Script artifacts', () => {
    expect(seeds.map((seed) => seed.step)).toEqual(['Branch Graph', 'VO Script']);
    expect(seeds.every((seed) => seed.data.sourced !== undefined)).toBe(true);
  });

  it('uses states as nodes, conditions as edge labels, and a hostility terminal', () => {
    const graph = seeds[0].data.graph as {
      nodes: { id: string; label: string; terminal?: boolean }[];
      edges: { from: string; to: string; label: string }[];
    };
    expect(graph.nodes.map((node) => node.id)).toEqual(['hello', 'threat', 'terminal_hostility']);
    expect(graph.nodes[2].terminal).toBe(true);
    expect(graph.edges).toEqual([
      { from: 'hello', to: 'threat', label: 'invented visibility exit' },
      { from: 'threat', to: 'terminal_hostility', label: 'invented audio exit' },
    ]);
    expect(graphValid('graph', 'valid')(seeds[0].data).status).toBe('pass');
  });

  it('writes exact wrapper VO metadata and a declared gap for an unresolved state line', () => {
    expect(seeds[1].data.voLines).toEqual([
      'TEXT_SYNTH_HELLO: "An entirely invented greeting." [voiceClip: VOICE_SYNTH_HELLO; scrolling: false]',
      `TEXT_SYNTH_THREAT: "${REFERENCE_GAP}" [voiceClip: ${REFERENCE_GAP}; scrolling: ${REFERENCE_GAP}]`,
    ]);
    expect(seeds[1].gaps).toContain('TEXT_SYNTH_THREAT: no dialog-trees line wrapper was available');
  });
});
