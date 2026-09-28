/* eslint-disable no-console -- CLI report; stdout and stderr are its interfaces. */
import { listEntities } from '@/lib/catalog-db';
import { loreFactsFor, resolveLoreSubject } from '@/lib/catalog/reference/loreFacts';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { loreGraphPath, promotionLoreGraph } from './catalogs/loreFacts';

const CATALOGS = ['characters', 'codex', 'quests', 'dialog-trees'] as const;

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const graph = promotionLoreGraph();
const records = CATALOGS.flatMap((catalogId) => listEntities(catalogId)
  .filter((record) => record.source === 'ingest')
  .map((record) => ({ catalogId, entity: record.entity })));
const matchedSubjectIds = new Set<string>();

const catalogs = CATALOGS.map((catalogId) => {
  const entities = records.filter((record) => record.catalogId === catalogId);
  const matchedEntityIds = new Set<string>();
  const matched = entities.flatMap(({ entity }) => {
    const subject = resolveLoreSubject(entity, graph);
    const loreFacts = loreFactsFor(entity, graph);
    if (!subject || !loreFacts) return [];
    matchedEntityIds.add(entity.id);
    matchedSubjectIds.add(subject.id);
    return [{
      id: entity.id,
      name: entity.name,
      subjectId: subject.id,
      factCount: loreFacts.facts.length,
      timelineCount: loreFacts.timeline.length,
      consistencyCount: loreFacts.consistency.length,
    }];
  });
  return {
    catalogId,
    total: entities.length,
    matchedCount: matched.length,
    matched,
    unmatched: entities
      .filter(({ entity }) => !matchedEntityIds.has(entity.id))
      .map(({ entity }) => ({ id: entity.id, name: entity.name })),
  };
});

const requested = valueAfter('--entity');
let selected: { entity: StoredCatalogEntity; loreFacts: ReturnType<typeof loreFactsFor> } | undefined;
if (requested) {
  const record = records.find(({ entity }) => entity.id === requested)
    ?? records.find(({ entity }) => resolveLoreSubject(entity, graph)?.id === requested);
  if (!record) {
    console.error(`No promoted catalog entity or matched lore subject found for ${requested}`);
    process.exitCode = 1;
  } else {
    selected = { entity: record.entity, loreFacts: loreFactsFor(record.entity, graph) };
  }
}

console.log(JSON.stringify({
  graphPath: loreGraphPath(),
  graphEntities: graph.entities.length,
  catalogs,
  unmatchedLoreEntities: graph.entities
    .filter((entity) => !matchedSubjectIds.has(entity.id))
    .map(({ id, name }) => ({ id, name })),
  ...(selected ? {
    selected: {
      id: selected.entity.id,
      name: selected.entity.name,
      loreFacts: selected.loreFacts,
    },
  } : {}),
}, null, 2));
