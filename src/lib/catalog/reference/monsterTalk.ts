/** Diablo I unique-monster conversations and their engine-derived state graphs. */
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import { D1_MONSTER_TALK_SPECS } from '@/lib/catalog/reference/monsterTalkData';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

type DialogueEntity = ReferenceWrapper['entity'];

export interface MonsterTalkState {
  id: string;
  line: string;
  enters: string;
  exits: string;
  effect: string;
}

export interface MonsterTalkSpec {
  monster: string;
  quest: `Q_${string}`;
  terminal: string;
  states: MonsterTalkState[];
  refs: string[];
}

interface MonsterDialogueLine {
  line: string;
  text: string;
  voiceClip?: string;
  scrolling: unknown;
}

export interface MonsterTalkTreeWrapper { catalogId: 'dialog-trees'; entity: DialogueEntity }
export interface UnresolvedMonsterTalkLine { monster: string; line: string }
export interface SkippedMonsterTalker { monster: string; reason: string }
export interface MonsterTalkTreesResult {
  wrappers: MonsterTalkTreeWrapper[];
  unresolved: UnresolvedMonsterTalkLine[];
  skipped: SkippedMonsterTalker[];
}

const lineFrom = (wrapper: ReferenceWrapper): MonsterDialogueLine => ({
  line: wrapper.key,
  text: String(wrapper.entity.data.text ?? ''),
  ...(typeof wrapper.entity.data.voiceClip === 'string' && wrapper.entity.data.voiceClip
    ? { voiceClip: wrapper.entity.data.voiceClip }
    : {}),
  scrolling: wrapper.entity.data.scrolling,
});

/** Build one no-menu dialog tree for every vanilla unique whose engine machine is specified. */
export function monsterTalkTrees(
  wrappers: readonly ReferenceWrapper[],
  specs?: readonly MonsterTalkSpec[],
): MonsterTalkTreesResult {
  const machines = specs ?? D1_MONSTER_TALK_SPECS;
  const bestiary = new Map(wrappers
    .filter((wrapper) => wrapper.catalogId === 'bestiary')
    .map((wrapper) => [wrapper.entity.id, wrapper]));
  const lines = new Map<string, ReferenceWrapper>();
  for (const wrapper of wrappers) {
    if (wrapper.catalogId !== 'dialog-trees' || typeof wrapper.entity.data.text !== 'string') continue;
    lines.set(wrapper.key, wrapper);
    lines.set(wrapper.entity.id, wrapper);
  }

  const result: MonsterTalkTreesResult = { wrappers: [], unresolved: [], skipped: [] };
  for (const spec of machines) {
    const host = bestiary.get(spec.monster);
    if (!host) continue;
    const talkLink = host.entity.links?.find((link) => link.role === 'talk-line');
    if (!talkLink) {
      result.skipped.push({ monster: spec.monster, reason: 'unique wrapper has no talk-line link' });
      continue;
    }

    const read = new Set<ReferenceWrapper>([host]);
    const resolvedLines = spec.states.flatMap((state) => {
      const wrapper = lines.get(state.line) ?? lines.get(`d1-${state.line}`);
      if (!wrapper) {
        result.unresolved.push({ monster: spec.monster, line: state.line });
        return [];
      }
      read.add(wrapper);
      return [lineFrom(wrapper)];
    });
    const sources = [...read];
    result.wrappers.push({
      catalogId: 'dialog-trees',
      entity: {
        ...host.entity,
        id: `d1-dialog-${spec.monster.slice('d1-uniq-'.length)}`,
        catalogId: 'dialog-trees',
        name: `${host.entity.name} — conversation`,
        tags: ['diablo-monster-talk'],
        links: [
          { catalogId: 'bestiary', entityId: spec.monster, role: 'host' },
          { catalogId: 'quests', entityId: `d1-${spec.quest}`, role: 'advances' },
        ],
        data: { speaker: spec.monster, talker: 'monster', lines: resolvedLines },
        provenance: {
          ...host.entity.provenance,
          sourceFile: [...new Set([
            ...sources.map((wrapper) => wrapper.file),
            ...spec.refs,
          ])].join(', '),
          sourceRow: sources.map((wrapper) => wrapper.entity.provenance?.sourceRow ?? wrapper.key).join('; '),
        },
      },
    });
  }
  return result;
}

function stamp(entity: DialogueEntity, spec: MonsterTalkSpec, columns: string[]): SourcedStamp {
  return {
    sourceGame: entity.provenance?.sourceGame ?? 'Diablo I (1996)',
    sourceFile: spec.refs.join(', '),
    sourceRow: entity.id,
    columns,
  };
}

/** Seed the two Diablo-profile dialog steps that the engine and speech table can source. */
export function seedMonsterTalkSteps(
  entity: DialogueEntity,
  specs?: readonly MonsterTalkSpec[],
): StepSeed[] {
  const lawId = 'd1-dialogue-monster-talk-law';
  if (!DIABLO1_CANON.some((rule) => rule.id === lawId)) {
    throw new Error(`canon rule ${lawId} is missing — the monster dialogue graph seed has no law to read`);
  }
  const machines = specs ?? D1_MONSTER_TALK_SPECS;
  const speaker = String(entity.data.speaker ?? '');
  const spec = machines.find((item) => item.monster === speaker);
  if (!spec) throw new Error(`no Diablo I monster talk specification for ${speaker || entity.id}`);
  const data = entity.data as { lines?: MonsterDialogueLine[] };
  const lineById = new Map((data.lines ?? []).map((line) => [line.line, line]));
  const terminalId = `terminal_${spec.terminal.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase()}`;
  const graph = {
    nodes: [
      ...spec.states.map((state) => ({
        id: state.id,
        label: `${state.line} — enters: ${state.enters}; effect: ${state.effect}`,
      })),
      { id: terminalId, label: spec.terminal, terminal: true },
    ],
    edges: spec.states.map((state, index) => ({
      from: state.id,
      to: spec.states[index + 1]?.id ?? terminalId,
      label: state.exits,
    })),
  };
  const voLines = spec.states.map((state) => {
    const line = lineById.get(state.line);
    return `${state.line}: "${line?.text ?? REFERENCE_GAP}" [voiceClip: ${line?.voiceClip ?? REFERENCE_GAP}; scrolling: ${String(line?.scrolling ?? REFERENCE_GAP)}]`;
  });
  const gaps = spec.states.flatMap((state) => {
    const line = lineById.get(state.line);
    if (!line) return [`${state.line}: no dialog-trees line wrapper was available`];
    return line.voiceClip ? [] : [`${state.line}.voiceClip: this reference line is unvoiced; no clip name was invented`];
  });

  return [
    {
      catalogId: 'dialog-trees', entityId: entity.id, step: 'Branch Graph',
      data: { graph, [SOURCED_FIELD]: stamp(entity, spec, [`(law ${lawId})`, 'states', 'transitions']) },
      gaps: [],
    },
    {
      catalogId: 'dialog-trees', entityId: entity.id, step: 'VO Script',
      data: { voLines, [SOURCED_FIELD]: stamp(entity, spec, ['txtstrid', 'txtstr', 'sfxnr', 'scrlltxt']) },
      gaps,
    },
  ];
}
