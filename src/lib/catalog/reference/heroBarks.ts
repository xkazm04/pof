/** Diablo I hero event barks as class-hosted dialog trees. */
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import { aggregateClassWrappers } from '@/lib/catalog/reference/classHeroes';
import {
  D1_HERO_BARK_SPECS,
  D1_HERO_SOUND_RESOLUTION_REFS,
  D1_HERO_SPEECH_LINE_IDS,
  type HeroBarkSpec,
} from '@/lib/catalog/reference/heroBarksData';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

type DialogueEntity = ReferenceWrapper['entity'];

export interface HeroBark {
  id: string;
  trigger: string;
  speechId: string;
  sfxId?: string;
  lineId?: string;
  line?: string;
  voiced: boolean;
  playback: HeroBarkSpec['playback'];
  classDifference: string;
  refs: string[];
}

export interface HeroBarkTreeWrapper { catalogId: 'dialog-trees'; entity: DialogueEntity }
export interface MissingHeroBarkMapping { hero: string; speechId: string }
export interface HeroBarkTreesResult {
  wrappers: HeroBarkTreeWrapper[];
  missingMappings: MissingHeroBarkMapping[];
}

const SOUND_FILE = /^classes\/([^/]+)\/sounds\.tsv$/;

function valueAt(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === 'string' && value ? value : undefined;
}

function classFolder(wrapper: ReferenceWrapper): string | undefined {
  const files = wrapper.entity.provenance?.sourceFile.split(', ') ?? [];
  return files.map((file) => /^classes\/([^/]+)\/attributes\.tsv$/.exec(file)?.[1]).find(Boolean);
}

function isVanillaClass(wrapper: ReferenceWrapper): boolean {
  const derived = wrapper.entity.data.derived as { expansion?: unknown } | undefined;
  return derived?.expansion === 'diablo';
}

/** Build one bark tree for each vanilla class, resolving class audio and approved text rows at runtime. */
export function heroBarkTrees(
  wrappers: readonly ReferenceWrapper[],
  specs: readonly HeroBarkSpec[] = D1_HERO_BARK_SPECS,
  heroSpeechLineIds: readonly string[] = D1_HERO_SPEECH_LINE_IDS,
): HeroBarkTreesResult {
  const classes = aggregateClassWrappers(wrappers.filter((wrapper) => wrapper.catalogId === 'characters'))
    .filter((wrapper) => wrapper.file.startsWith('classes/') && isVanillaClass(wrapper));
  const approvedLines = new Set(heroSpeechLineIds);
  const lineBySfx = new Map<string, ReferenceWrapper>();
  for (const wrapper of wrappers) {
    const sfxId = valueAt(wrapper.entity.data, 'voiceClip');
    if (wrapper.catalogId === 'dialog-trees' && approvedLines.has(wrapper.key) && sfxId) {
      lineBySfx.set(sfxId, wrapper);
    }
  }

  const soundsByClass = new Map<string, Map<string, ReferenceWrapper>>();
  for (const wrapper of wrappers) {
    const match = SOUND_FILE.exec(wrapper.file);
    if (!match) continue;
    const speechId = valueAt(wrapper.entity.data, 'heroSpeech[].eventId');
    if (!speechId) continue;
    const sounds = soundsByClass.get(match[1]) ?? new Map<string, ReferenceWrapper>();
    sounds.set(speechId, wrapper);
    soundsByClass.set(match[1], sounds);
  }

  const result: HeroBarkTreesResult = { wrappers: [], missingMappings: [] };
  for (const hero of classes) {
    const folder = classFolder(hero);
    if (!folder) continue;
    const classSounds = soundsByClass.get(folder) ?? new Map<string, ReferenceWrapper>();
    const read = new Set<ReferenceWrapper>([hero]);
    const barks = specs.map((spec): HeroBark => {
      const sound = classSounds.get(spec.speechId);
      if (sound) read.add(sound);
      const sfxId = sound?.raw.sfx?.trim() || undefined;
      const line = sfxId ? lineBySfx.get(sfxId) : undefined;
      if (line) read.add(line);
      if (!sfxId) result.missingMappings.push({ hero: hero.entity.id, speechId: spec.speechId });
      return {
        id: spec.id,
        trigger: spec.trigger,
        speechId: spec.speechId,
        ...(sfxId ? { sfxId } : {}),
        ...(line ? {
          lineId: line.key,
          line: String(line.entity.data.text ?? ''),
        } : {}),
        voiced: sfxId !== undefined,
        playback: spec.playback,
        classDifference: sfxId
          ? `${hero.entity.name} resolves ${spec.speechId} to ${sfxId}.`
          : `${hero.entity.name} has no mapping for ${spec.speechId}; playback is silent.`,
        refs: spec.refs,
      };
    });
    const sources = [...read];
    result.wrappers.push({
      catalogId: 'dialog-trees',
      entity: {
        ...hero.entity,
        id: `d1-dialog-hero-${folder}`,
        catalogId: 'dialog-trees',
        name: `${hero.entity.name} — hero barks`,
        tags: ['diablo-hero-barks'],
        links: [{ catalogId: 'characters', entityId: hero.entity.id, role: 'host' }],
        data: {
          speaker: hero.entity.id,
          talker: 'hero',
          barks,
          perClass: {
            classId: hero.entity.id,
            resolution: 'GetHeroSound resolves each HeroSpeech ID through this class sounds table.',
            missingMapping: 'A missing class mapping is silent.',
            specificPlayback: 'SaySpecific suppresses a resolved effect that is already playing.',
          },
        },
        provenance: {
          ...hero.entity.provenance,
          sourceFile: [...new Set([
            ...sources.flatMap((wrapper) => wrapper.entity.provenance?.sourceFile.split(', ') ?? [wrapper.file]),
            ...specs.flatMap((spec) => spec.refs),
            ...D1_HERO_SOUND_RESOLUTION_REFS,
          ])].join(', '),
          sourceRow: [
            ...sources.map((wrapper) => wrapper.entity.provenance?.sourceRow ?? wrapper.key),
            ...specs.map((spec) => spec.speechId),
          ].join('; '),
        },
      },
    });
  }
  return result;
}

function specStamp(entity: DialogueEntity, specs: readonly HeroBarkSpec[], columns: string[]): SourcedStamp {
  return {
    sourceGame: entity.provenance?.sourceGame ?? 'Diablo I (1996)',
    sourceFile: [...new Set([
      ...specs.flatMap((spec) => spec.refs),
      ...D1_HERO_SOUND_RESOLUTION_REFS,
    ])].join(', '),
    sourceRow: entity.id,
    columns,
  };
}

/** Seed every hero-bark artifact the engine calls and source tables can establish. */
export function seedHeroBarkSteps(
  entity: DialogueEntity,
  specs: readonly HeroBarkSpec[] = D1_HERO_BARK_SPECS,
): StepSeed[] {
  const lawId = 'd1-hero-speech-trigger-law';
  if (!DIABLO1_CANON.some((rule) => rule.id === lawId)) {
    throw new Error(`canon rule ${lawId} is missing — the hero bark seeds have no law to read`);
  }
  const data = entity.data as { barks?: HeroBark[] };
  const barks = data.barks ?? [];
  const specById = new Map(specs.map((spec) => [spec.id, spec]));
  const graph = {
    nodes: [
      { id: 'game_events', label: 'Game events' },
      ...barks.map((bark) => ({
        id: `bark_${bark.id}`,
        label: `${bark.trigger} → HeroSpeech::${bark.speechId}`,
        terminal: true,
      })),
    ],
    edges: barks.map((bark) => ({
      from: 'game_events',
      to: `bark_${bark.id}`,
      label: bark.trigger,
    })),
  };
  const conditionsEffects = barks.map((bark) => ({
    node: `bark_${bark.id}`,
    condition: bark.trigger,
    effect: specById.get(bark.id)?.effect ?? `Request HeroSpeech::${bark.speechId} through ${bark.playback}.`,
  }));
  const voLines = barks.map((bark) =>
    `${bark.speechId}: "${bark.line ?? REFERENCE_GAP}" [sfxId: ${bark.sfxId ?? REFERENCE_GAP}; voiced: ${String(bark.voiced)}]`);
  const voGaps = barks.flatMap((bark) => [
    ...(!bark.sfxId
      ? [`${bark.speechId}.sfxId: this class has no sound mapping; playback is silent`]
      : []),
    ...(!bark.line
      ? [`${bark.speechId}.line: no census-approved hero-speech textdat line resolves this class sound`]
      : []),
  ]);

  return [
    {
      catalogId: 'dialog-trees', entityId: entity.id, step: 'Branch Graph',
      data: {
        graph,
        [SOURCED_FIELD]: specStamp(entity, specs, [`(law ${lawId})`, 'HeroSpeech call sites']),
      },
      gaps: [],
    },
    {
      catalogId: 'dialog-trees', entityId: entity.id, step: 'VO Script',
      data: {
        voLines,
        [SOURCED_FIELD]: specStamp(entity, specs, ['speech', 'sfx', 'txtstrid', 'txtstr', 'sfxnr']),
      },
      gaps: voGaps,
    },
    {
      catalogId: 'dialog-trees', entityId: entity.id, step: 'Conditions & Effects',
      data: {
        conditionsEffects,
        [SOURCED_FIELD]: specStamp(entity, specs, [`(law ${lawId})`, 'trigger conditions', 'playback effects']),
      },
      gaps: [],
    },
  ];
}
