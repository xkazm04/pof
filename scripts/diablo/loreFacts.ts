/* eslint-disable no-console -- CLI report; stdout and stderr are its interfaces. */
import { listEntities } from '@/lib/catalog-db';
import { getDb } from '@/lib/db';
import { loreFactionEntities } from '@/lib/catalog/reference/loreFactions';
import { loreFactsFor, resolveLoreSubject } from '@/lib/catalog/reference/loreFacts';
import { locationEntities } from '@/lib/catalog/reference/locationSpecs';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { loreGraphPath, promotionLoreGraph } from './catalogs/loreFacts';

const BASELINE_CATALOGS = ['characters', 'codex', 'quests', 'dialog-trees'] as const;
const EXPANDED_CATALOGS = [...BASELINE_CATALOGS, 'factions', 'zone-map'] as const;

interface ReportRecord {
  catalogId: string;
  entity: StoredCatalogEntity;
}

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const graph = promotionLoreGraph();
const records: ReportRecord[] = EXPANDED_CATALOGS.flatMap((catalogId) => listEntities(catalogId)
  .filter((record) => record.source === 'ingest')
  .map((record) => ({ catalogId, entity: record.entity })));
const sourceId = valueAfter('--source') ?? 'diablo1';
const candidateRecords: ReportRecord[] = [
  ...loreFactionEntities(graph, loreGraphPath())
    .map((wrapper) => ({ catalogId: wrapper.catalogId, entity: wrapper.entity })),
  ...locationEntities(listWrappers(getDb(), { sourceId }))
    .map((wrapper) => ({ catalogId: wrapper.catalogId, entity: wrapper.entity })),
];

function catalogReport(catalogId: string, source: ReportRecord[]) {
  const entities = source.filter((record) => record.catalogId === catalogId);
  const matchedEntityIds = new Set<string>();
  const matched = entities.flatMap(({ entity }) => {
    const subject = resolveLoreSubject(entity, graph);
    const loreFacts = loreFactsFor(entity, graph);
    if (!subject || !loreFacts) return [];
    matchedEntityIds.add(entity.id);
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
}

function matchedSubjects(source: ReportRecord[]): Set<string> {
  return new Set(source.flatMap(({ entity }) => {
    const subject = resolveLoreSubject(entity, graph);
    return subject ? [subject.id] : [];
  }));
}

const catalogs = EXPANDED_CATALOGS.map((catalogId) => catalogReport(catalogId, records));
const promotionCandidates = ['factions', 'zone-map']
  .map((catalogId) => catalogReport(catalogId, candidateRecords));
const baselineSubjectIds = matchedSubjects(records.filter((record) =>
  BASELINE_CATALOGS.some((catalogId) => catalogId === record.catalogId)));
const expandedSubjectIds = matchedSubjects([...records, ...candidateRecords]);
const newlyMatchedIds = new Set([...expandedSubjectIds].filter((id) => !baselineSubjectIds.has(id)));
const entitySummary = ({ id, name, kind }: (typeof graph.entities)[number]) => ({ id, name, kind });

const requested = valueAfter('--entity');
let selected: { entity: StoredCatalogEntity; loreFacts: ReturnType<typeof loreFactsFor> } | undefined;
if (requested) {
  const reportRecords = [...records, ...candidateRecords];
  const record = reportRecords.find(({ entity }) => entity.id === requested)
    ?? reportRecords.find(({ entity }) => resolveLoreSubject(entity, graph)?.id === requested);
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
  promotionCandidates,
  coverage: {
    baselineMatched: baselineSubjectIds.size,
    baselineUnmatched: graph.entities.length - baselineSubjectIds.size,
    newlyMatchedCount: newlyMatchedIds.size,
    newlyMatched: graph.entities.filter((entity) => newlyMatchedIds.has(entity.id)).map(entitySummary),
    expandedMatched: expandedSubjectIds.size,
    expandedUnmatched: graph.entities.length - expandedSubjectIds.size,
  },
  unmatchedLoreEntities: graph.entities
    .filter((entity) => !expandedSubjectIds.has(entity.id))
    .map(entitySummary),
  ...(selected ? {
    selected: {
      id: selected.entity.id,
      name: selected.entity.name,
      loreFacts: selected.loreFacts,
    },
  } : {}),
}, null, 2));
