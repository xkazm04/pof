/** Data-free projection of external lore-graph factions into promotion candidates. */
import { DIABLO1_SOURCE } from '@/lib/catalog/ingest/diablo1';
import type { IngestedEntity } from '@/lib/catalog/ingest/run';
import {
  loreFactsFor,
  type EntityLoreFacts,
  type LoreGraph,
  type LoreGraphEntity,
} from '@/lib/catalog/reference/loreFacts';

export interface LoreFactionData {
  aliases: string[];
  kind: string;
  loreFacts: EntityLoreFacts;
}

export interface LoreFactionWrapper {
  catalogId: 'factions';
  entity: IngestedEntity & { catalogId: 'factions'; data: LoreFactionData };
}

const factionKindTokens = new Set(['faction', 'order', 'brotherhood', 'knights']);

const normalizedKind = (kind: string): string => kind
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

/** Only explicit faction-like graph classifications are promoted; generic groups stay unmatched. */
export function isLoreFaction(entity: LoreGraphEntity): boolean {
  return normalizedKind(entity.kind).split(' ').some((token) => factionKindTokens.has(token));
}

const textIdsFor = (loreFacts: EntityLoreFacts): string[] => [...new Set([
  ...loreFacts.facts.flatMap((fact) => fact.textIds),
  ...loreFacts.timeline.flatMap((event) => event.textIds),
  ...loreFacts.consistency.flatMap((note) => note.textIds),
])];

/** Build promotion-only pseudo-wrappers whose values remain entirely external at runtime. */
export function loreFactionEntities(
  graph: LoreGraph,
  graphPath: string,
  now = new Date().toISOString(),
): LoreFactionWrapper[] {
  return graph.entities.filter(isLoreFaction).map((subject) => {
    const base: IngestedEntity & { catalogId: 'factions' } = {
      id: `d1-${subject.id}`,
      catalogId: 'factions',
      name: subject.name,
      categoryPath: [],
      lifecycle: 'planned',
      tags: ['external-lore', 'lore-faction'],
      links: [],
      data: {
        aliases: [...subject.aliases],
        kind: subject.kind,
      },
      provenance: {
        kind: 'ingest',
        sourceGame: DIABLO1_SOURCE.sourceGame,
        sourceProject: DIABLO1_SOURCE.sourceProject,
        sourceFile: `${graphPath}; text/textdat.tsv`,
        sourceRow: subject.id,
        licenceNote: DIABLO1_SOURCE.licenceNote,
        ingestedAt: now,
        canonProfile: 'diablo1',
      },
    };
    const loreFacts = loreFactsFor(base, graph);
    if (!loreFacts) return null;
    const textIds = textIdsFor(loreFacts);
    return {
      catalogId: 'factions' as const,
      entity: {
        ...base,
        data: { ...base.data, loreFacts } as LoreFactionData,
        provenance: {
          ...base.provenance,
          sourceRow: textIds.length ? textIds.join(', ') : subject.id,
        },
      },
    };
  }).filter((wrapper): wrapper is LoreFactionWrapper => wrapper !== null);
}
