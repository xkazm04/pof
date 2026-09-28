/** Data-free loading, matching, and selection for an operator-supplied lore fact graph. */
import { readFileSync } from 'node:fs';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

export interface LoreGraphEntity {
  id: string;
  name: string;
  aliases: string[];
  kind: string;
}

export interface LoreGraphFact {
  subject: string;
  relation: string;
  object: string;
  qualifier: string;
  textIds: string[];
  speakers: string[];
  status: string;
  optional: boolean;
}

export interface LoreTimelineEvent {
  event: string;
  order: number;
  textIds: string[];
}

export interface LoreConsistencyNote {
  kind: string;
  detail: string;
  textIds: string[];
}

export interface LoreGraph {
  entities: LoreGraphEntity[];
  facts: LoreGraphFact[];
  timeline: LoreTimelineEvent[];
  consistency: LoreConsistencyNote[];
}

export interface EntityLoreFacts {
  subjectId: string;
  facts: LoreGraphFact[];
  timeline: LoreTimelineEvent[];
  consistency: LoreConsistencyNote[];
}

const emptyGraph = (): LoreGraph => ({ entities: [], facts: [], timeline: [], consistency: [] });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

function invalid(path: string): never {
  throw new Error(`Invalid lore graph at ${path}`);
}

function validateGraph(value: unknown): LoreGraph {
  if (!isRecord(value)) invalid('$');
  const { entities, facts, timeline, consistency } = value;
  if (!Array.isArray(entities) || !Array.isArray(facts)
    || !Array.isArray(timeline) || !Array.isArray(consistency)) invalid('$');

  for (const [index, item] of entities.entries()) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string'
      || !isStringArray(item.aliases) || typeof item.kind !== 'string') {
      invalid(`$.entities[${index}]`);
    }
  }
  for (const [index, item] of facts.entries()) {
    if (!isRecord(item) || typeof item.subject !== 'string' || typeof item.relation !== 'string'
      || typeof item.object !== 'string' || typeof item.qualifier !== 'string'
      || !isStringArray(item.textIds) || !isStringArray(item.speakers)
      || typeof item.status !== 'string' || typeof item.optional !== 'boolean') {
      invalid(`$.facts[${index}]`);
    }
  }
  for (const [index, item] of timeline.entries()) {
    if (!isRecord(item) || typeof item.event !== 'string' || typeof item.order !== 'number'
      || !Number.isFinite(item.order) || !isStringArray(item.textIds)) {
      invalid(`$.timeline[${index}]`);
    }
  }
  for (const [index, item] of consistency.entries()) {
    if (!isRecord(item) || typeof item.kind !== 'string' || typeof item.detail !== 'string'
      || !isStringArray(item.textIds)) {
      invalid(`$.consistency[${index}]`);
    }
  }

  return {
    entities: entities as unknown as LoreGraphEntity[],
    facts: facts as unknown as LoreGraphFact[],
    timeline: timeline as unknown as LoreTimelineEvent[],
    consistency: consistency as unknown as LoreConsistencyNote[],
  };
}

/** Load and validate an external graph. A missing file is deliberately the empty graph. */
export function loadLoreGraph(path: string): LoreGraph {
  try {
    return validateGraph(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return emptyGraph();
    throw error;
  }
}

const words = (value: string): string => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const compact = (value: string): string => words(value).replace(/ /g, '');

const withoutLeadingArticle = (value: string): string => words(value).replace(/^(?:a|an|the) /, '');

const exactLabelKeys = (value: string): string[] => [compact(value), compact(withoutLeadingArticle(value))];

const ID_PREFIXES = new Set(['d1', 'dialog', 'lore', 'uniq', 'class']);

function idCandidates(id: string): string[] {
  const parts = words(id).split(' ').filter(Boolean);
  const values = [id];
  while (parts.length > 1 && ID_PREFIXES.has(parts[0])) {
    parts.shift();
    values.push(parts.join(' '));
  }
  return values;
}

function entityCandidates(entity: StoredCatalogEntity): { ids: string[]; labels: string[] } {
  const data = isRecord(entity.data) ? entity.data : {};
  const aliases = isStringArray(data.aliases) ? data.aliases : [];
  const speaker = typeof data.speaker === 'string' ? idCandidates(data.speaker) : [];
  return {
    ids: [...idCandidates(entity.id), ...speaker],
    labels: [entity.name, ...aliases],
  };
}

const labelsOf = (entity: LoreGraphEntity): string[] => [entity.name, ...entity.aliases];

function uniqueMatch(matches: LoreGraphEntity[]): LoreGraphEntity | undefined {
  const unique = [...new Map(matches.map((entity) => [entity.id, entity])).values()];
  return unique.length === 1 ? unique[0] : undefined;
}

const atPhraseEdge = (candidate: string, label: string): boolean =>
  candidate === label || candidate.startsWith(`${label} `) || candidate.endsWith(` ${label}`);

/** Resolve by exact normalized identity, then by one unambiguous whole phrase at a name edge. */
export function resolveLoreSubject(
  entity: StoredCatalogEntity,
  graph: LoreGraph,
): LoreGraphEntity | undefined {
  const candidates = entityCandidates(entity);
  const idKeys = new Set(candidates.ids.map(compact).filter(Boolean));
  const byId = graph.entities.filter((subject) => idKeys.has(compact(subject.id)));
  if (byId.length) return uniqueMatch(byId);

  const labelKeys = new Set(candidates.labels.flatMap(exactLabelKeys).filter(Boolean));
  const exact = graph.entities.filter((subject) =>
    labelsOf(subject).some((label) => exactLabelKeys(label).some((key) => labelKeys.has(key))));
  if (exact.length) return uniqueMatch(exact);

  const candidatePhrases = candidates.labels.map(words).filter(Boolean);
  return uniqueMatch(graph.entities.filter((subject) => labelsOf(subject).some((label) => {
    const phrase = words(label);
    return phrase.length >= 3 && candidatePhrases.some((candidate) => atPhraseEdge(candidate, phrase));
  })));
}

function mentions(subject: LoreGraphEntity, value: string): boolean {
  const haystack = ` ${words(value)} `;
  return labelsOf(subject).some((label) => {
    const needle = words(label);
    return needle.length >= 3 && haystack.includes(` ${needle} `);
  });
}

/** Select every structured or prose graph record that involves the resolved subject. */
export function loreFactsFor(entity: StoredCatalogEntity, graph: LoreGraph): EntityLoreFacts | undefined {
  const subject = resolveLoreSubject(entity, graph);
  if (!subject) return undefined;
  return {
    subjectId: subject.id,
    facts: graph.facts.filter((fact) => fact.subject === subject.id || fact.object === subject.id),
    timeline: graph.timeline.filter((event) => mentions(subject, event.event)),
    consistency: graph.consistency.filter((note) => mentions(subject, note.detail)),
  };
}

/** Attach data.loreFacts without mutating the promotion candidate. */
export function withLoreFacts<T extends StoredCatalogEntity>(entity: T, graph: LoreGraph): T {
  const loreFacts = loreFactsFor(entity, graph);
  if (!loreFacts) return entity;
  const data = isRecord(entity.data) ? entity.data : {};
  return { ...entity, data: { ...data, loreFacts } };
}
