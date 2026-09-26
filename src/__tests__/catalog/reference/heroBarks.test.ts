import { describe, expect, it } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { graphValid } from '@/lib/catalog/acceptance/graphCheckers';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { heroBarkTrees, seedHeroBarkSteps } from '@/lib/catalog/reference/heroBarks';
import { D1_HERO_BARK_SPECS, type HeroBarkSpec } from '@/lib/catalog/reference/heroBarksData';
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
  file: string,
  data: Record<string, unknown>,
  raw: Record<string, string> = {},
  key = id,
): ReferenceWrapper {
  return {
    wrapperId: `test:${file}:${id}`,
    sourceId: 'test',
    file,
    technique: 'test',
    key,
    keyKind: 'column',
    raw,
    rawHash: 'raw',
    catalogId,
    mappingVersion: 'test',
    entity: {
      id,
      catalogId,
      name: 'Synthetic Hero',
      categoryPath: [],
      lifecycle: 'planned',
      tags: [],
      data,
      links: [],
      provenance: { ...provenance, sourceFile: file },
    },
  };
}

const specs: HeroBarkSpec[] = [
  {
    id: 'invented-event',
    trigger: 'An invented event occurs.',
    speechId: 'InventedSpeech',
    playback: 'Say',
    effect: 'Request the invented class sound.',
    refs: ['.reference/devilutionX/Source/player.cpp:1-2'],
  },
  {
    id: 'invented-silent-event',
    trigger: 'A second invented event occurs.',
    speechId: 'InventedSilentSpeech',
    playback: 'SaySpecific',
    effect: 'Attempt the missing invented class sound.',
    refs: ['.reference/devilutionX/Source/inv.cpp:3-4'],
  },
];

const attributes = wrapper(
  'd1-class-synthetic',
  'characters',
  'classes/synthetic/attributes.tsv',
  { derived: { expansion: 'diablo' } },
);
const sound = wrapper(
  'd1-class-synthetic-speech-invented',
  'characters',
  'classes/synthetic/sounds.tsv',
  { 'heroSpeech[].eventId': 'InventedSpeech' },
  { speech: 'InventedSpeech', sfx: 'SyntheticVoice1' },
  'InventedSpeech',
);
const line = wrapper(
  'd1-TEXT_SYNTH_HERO',
  'dialog-trees',
  'text/textdat.tsv',
  { text: 'An entirely invented bark.', voiceClip: 'SyntheticVoice1', scrolling: false },
  {},
  'TEXT_SYNTH_HERO',
);
const source = [attributes, sound, line];

describe('D1_HERO_BARK_SPECS', () => {
  it('contains the nineteen actual event-to-speech requests with pinned file lines', () => {
    expect(D1_HERO_BARK_SPECS).toHaveLength(19);
    expect(new Set(D1_HERO_BARK_SPECS.map((spec) => spec.id)).size).toBe(19);
    for (const spec of D1_HERO_BARK_SPECS) {
      expect(spec.trigger).not.toBe('');
      expect(spec.speechId).not.toBe('');
      expect(spec.refs.length).toBeGreaterThan(0);
      expect(spec.refs.every((ref) => /^\.reference\/devilutionX\/Source\/.+\.cpp:\d+-\d+$/.test(ref))).toBe(true);
    }
  });
});

describe('heroBarkTrees', () => {
  const result = heroBarkTrees(source, specs, ['TEXT_SYNTH_HERO']);
  const entity = result.wrappers[0].entity;

  it('builds one class-hosted hero tree and resolves audio/text only from wrappers', () => {
    expect(result.wrappers).toHaveLength(1);
    expect(entity.id).toBe('d1-dialog-hero-synthetic');
    expect(entity.links).toEqual([
      { catalogId: 'characters', entityId: 'd1-class-synthetic', role: 'host' },
    ]);
    expect(entity.data).toMatchObject({
      speaker: 'd1-class-synthetic',
      talker: 'hero',
      barks: [
        {
          id: 'invented-event',
          speechId: 'InventedSpeech',
          sfxId: 'SyntheticVoice1',
          lineId: 'TEXT_SYNTH_HERO',
          line: 'An entirely invented bark.',
          voiced: true,
        },
        {
          id: 'invented-silent-event',
          speechId: 'InventedSilentSpeech',
          voiced: false,
        },
      ],
    });
    expect(result.missingMappings).toEqual([
      { hero: 'd1-class-synthetic', speechId: 'InventedSilentSpeech' },
    ]);
  });

  it('does not mutate conversation inputs while deriving hero trees', () => {
    const before = JSON.stringify(source);
    heroBarkTrees(source, specs, ['TEXT_SYNTH_HERO']);
    expect(JSON.stringify(source)).toBe(before);
  });
});

describe('seedHeroBarkSteps', () => {
  const entity = heroBarkTrees(source, specs, ['TEXT_SYNTH_HERO']).wrappers[0].entity;
  const seeds = seedHeroBarkSteps(entity, specs);

  it('seeds the three requested artifacts as SOURCED', () => {
    expect(seeds.map((seed) => seed.step)).toEqual([
      'Branch Graph',
      'VO Script',
      'Conditions & Effects',
    ]);
    expect(seeds.every((seed) => seed.data.sourced !== undefined)).toBe(true);
  });

  it('keeps every seeded artifact pending rather than passing its registered checker', () => {
    const pipeline = getCatalogPipeline('dialog-trees')!;
    const context = { catalog: 'dialog-trees', siblings: {}, has: () => true, canonProfile: 'diablo1' };
    for (const seed of seeds) {
      const accept = pipeline.steps.find((step) => step.label === seed.step)!.accept;
      const verdict = accept(seed.data, context);
      expect(verdict.status).toBe('pending');
      expect(verdict.reason).toMatch(/^(SOURCED|UNGRADED):/);
    }
  });

  it('builds a game-events root with one reachable terminal per event', () => {
    const graph = seeds[0].data.graph as {
      nodes: { id: string; terminal?: boolean }[];
      edges: { from: string; to: string; label: string }[];
    };
    expect(graph.nodes[0]).toEqual({ id: 'game_events', label: 'Game events' });
    expect(graph.nodes.slice(1).every((node) => node.terminal)).toBe(true);
    expect(graph.edges).toHaveLength(specs.length);
    expect(graphValid('graph', 'valid')(seeds[0].data).status).toBe('pass');
  });

  it('uses checker-readable condition/effect entries and names VO gaps', () => {
    expect(seeds[2].data.conditionsEffects).toEqual([
      {
        node: 'bark_invented-event',
        condition: 'An invented event occurs.',
        effect: 'Request the invented class sound.',
      },
      {
        node: 'bark_invented-silent-event',
        condition: 'A second invented event occurs.',
        effect: 'Attempt the missing invented class sound.',
      },
    ]);
    expect(seeds[1].data.voLines).toEqual([
      'InventedSpeech: "An entirely invented bark." [sfxId: SyntheticVoice1; voiced: true]',
      `InventedSilentSpeech: "${REFERENCE_GAP}" [sfxId: ${REFERENCE_GAP}; voiced: false]`,
    ]);
    expect(seeds[1].gaps).toEqual([
      'InventedSilentSpeech.sfxId: this class has no sound mapping; playback is silent',
      'InventedSilentSpeech.line: no census-approved hero-speech textdat line resolves this class sound',
    ]);
  });
});
