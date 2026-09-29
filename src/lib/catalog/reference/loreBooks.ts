/** Diablo I books aggregate text-line wrappers into the title-shaped codex entries PoF authors. */
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import { LORE_BOOK_SPECS, type LoreSource } from '@/lib/catalog/reference/loreBooksData';

interface LoreVolume {
  line: string;
  text: string;
  voiceClip?: string;
  scrolling: unknown;
  where: string;
}

interface LoreBookData {
  volumes: LoreVolume[];
  source: LoreSource;
}

type LoreBookEntity = ReferenceWrapper['entity'];

export interface LoreBookWrapper { catalogId: 'codex'; entity: LoreBookEntity }
export interface UnresolvedLoreLine { entry: string; line: string }
export interface LoreBooksResult {
  wrappers: LoreBookWrapper[];
  unresolved: UnresolvedLoreLine[];
}

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sourceLineId = (value: string) => value.startsWith('d1-') ? value.slice(3) : value;
const refFile = (reference: string) => reference.slice(0, reference.lastIndexOf(':'));

/** One pseudo-wrapper per engine title, with its pages/readings in engine order. */
export function loreBooks(wrappers: readonly ReferenceWrapper[]): LoreBooksResult {
  const lines = new Map<string, ReferenceWrapper>();
  for (const wrapper of wrappers) {
    if (wrapper.catalogId !== 'dialog-trees' || typeof wrapper.entity.data.text !== 'string') continue;
    lines.set(wrapper.key, wrapper);
    lines.set(wrapper.entity.id, wrapper);
  }

  const result: LoreBookWrapper[] = [];
  const unresolved: UnresolvedLoreLine[] = [];
  for (const spec of LORE_BOOK_SPECS) {
    const read: ReferenceWrapper[] = [];
    const volumes: LoreVolume[] = [];
    for (const volume of spec.volumes) {
      const wrapper = lines.get(volume.line) ?? lines.get(`d1-${volume.line}`);
      if (!wrapper) {
        unresolved.push({ entry: spec.title, line: volume.line });
        continue;
      }
      read.push(wrapper);
      volumes.push({
        line: sourceLineId(wrapper.key),
        text: String(wrapper.entity.data.text),
        ...(typeof wrapper.entity.data.voiceClip === 'string' && wrapper.entity.data.voiceClip
          ? { voiceClip: wrapper.entity.data.voiceClip }
          : {}),
        scrolling: wrapper.entity.data.scrolling,
        where: volume.where,
      });
    }
    if (!volumes.length) continue;

    const first = read[0];
    const rowRefs = read.map((wrapper) => `${wrapper.file}:${wrapper.entity.provenance?.sourceRow ?? wrapper.key}`);
    const allRefs = [...rowRefs, ...spec.references];
    const sourceFiles = [...new Set([first.file, ...spec.references.map(refFile)])];
    result.push({
      catalogId: 'codex',
      entity: {
        ...first.entity,
        id: `d1-lore-${slug(spec.title)}`,
        catalogId: 'codex',
        name: spec.title,
        tags: ['diablo-lore'],
        links: spec.quest
          ? [{ catalogId: 'quests', entityId: `d1-${spec.quest}`, role: 'cross-reference' }]
          : [],
        data: { volumes, source: spec.source },
        provenance: {
          ...first.entity.provenance,
          sourceFile: sourceFiles.join(', '),
          sourceRow: allRefs.join('; '),
        },
      },
    });
  }
  return { wrappers: result, unresolved };
}

const stamp = (entity: LoreBookEntity, columns: string[]): SourcedStamp => ({
  sourceGame: entity.provenance?.sourceGame ?? '',
  sourceFile: entity.provenance?.sourceFile ?? '',
  sourceRow: entity.provenance?.sourceRow ?? '',
  columns,
});

/** Seed only the two codex steps for which the text table and engine reveal path are exact sources. */
export function seedLoreSteps(entity: LoreBookEntity): StepSeed[] {
  const data = entity.data as unknown as LoreBookData;
  const volumes = data.volumes ?? [];
  const quest = entity.links?.find((link) => link.catalogId === 'quests')?.entityId;
  const firstRead = volumes.map((volume) => volume.where).join('; ');
  const dependency = quest ? [`quests::${quest}`] : [];

  return [
    {
      catalogId: 'codex', entityId: entity.id, step: 'Lore Body',
      data: {
        loreBody: volumes.map((volume) => volume.text).join('\n\n'),
        [SOURCED_FIELD]: stamp(entity, ['txtstr']),
      },
      gaps: [
        'loreBodyNote: the reference stores the verbatim pages, not a PoF editorial note',
      ],
    },
    {
      catalogId: 'codex', entityId: entity.id, step: 'Unlock Rules',
      data: {
        unlockRules: {
          primary: {
            trigger: firstRead,
            tagGranted: `The engine displays the selected source line from: ${volumes.map((volume) => volume.line).join(', ')}`,
            condition: quest
              ? `${quest} availability/state and the object-specific conditions recorded by the engine path`
              : 'The corresponding object or conversation is interactable at the recorded location/state',
          },
          fallback: {
            trigger: 'No alternate reveal path exists in Diablo I',
            tagGranted: 'No fallback grant exists; the reference engine has no persistent codex unlock',
            condition: 'Not applicable in the reference engine; only the recorded primary interaction reveals the text',
          },
          wiringContract: {
            grantedBy: 'DevilutionX InitQTextMsg displays the source text selected by the recorded object or conversation path',
            activatedBy: firstRead,
            dependencies: dependency,
            verification: `L0: compare the recorded reveal path and ${volumes.map((volume) => volume.line).join(', ')} selection with the cited engine source`,
          },
        },
        [SOURCED_FIELD]: stamp(entity, ['(engine reveal path)', ...(quest ? ['(quest state)'] : [])]),
      },
      gaps: [
        'tagGranted: Diablo I displays quest text directly and has no persistent PoF codex-unlock gameplay tag',
        'ueWiring: the reference has no PoF GameplayEffect, component, or save-game wiring',
        'fallback: Diablo I has no alternate unlock path; the populated row records that absence in the codex step shape',
      ],
    },
  ];
}
