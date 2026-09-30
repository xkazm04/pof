import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import { labIdentityOf } from '@/lib/catalog/canon/profiles';
import { entityValueLines } from '@/lib/catalog/referenceValues';
import type { CatalogLink, StoredCatalogEntity } from '@/lib/catalog/types';

/** Hard ceiling for the complete linked-reference section. */
export const LINKED_REFERENCES_MAX_CHARS = 16000;

/** Two edges cover entity -> behavior/ledger -> the records that behavior names. */
export const LINKED_REFERENCES_MAX_DEPTH = 2;

type LinkableEntity = Pick<StoredCatalogEntity, 'id' | 'catalogId' | 'name' | 'data' | 'links' | 'provenance'>;

const entityKey = (catalogId: string, entityId: string): string => `${catalogId}\u0000${entityId}`;

function linkedLabEntity(entity: LinkableEntity): LabEntity {
  return {
    id: entity.id,
    name: entity.name,
    lifecycle: 'planned',
    data: entity.data,
    ...labIdentityOf(entity),
  };
}

function targetsOf(
  links: readonly CatalogLink[] | undefined,
  byKey: ReadonlyMap<string, LinkableEntity>,
): LinkableEntity[] {
  return (links ?? []).flatMap((link) => {
    const target = byKey.get(entityKey(link.catalogId, link.entityId));
    return target ? [target] : [];
  });
}

/**
 * Resolve the cross-catalog neighborhood of an entity without knowing any catalog's schema.
 *
 * The first hop accepts either direction of a recorded link. This matters for ownership links:
 * a dialog tree records its host character, while the character need not duplicate that edge.
 * Later hops follow the linked entity's outgoing links, which reaches dependencies such as the
 * quests named by a dialog ledger without expanding through every record that points at them.
 */
export function collectLinkedReferences(
  source: Pick<LinkableEntity, 'id' | 'catalogId' | 'links'>,
  entities: readonly LinkableEntity[],
  maxDepth = LINKED_REFERENCES_MAX_DEPTH,
): LinkableEntity[] {
  if (maxDepth < 1) return [];
  const byKey = new Map(entities.map((entity) => [entityKey(entity.catalogId, entity.id), entity]));
  const sourceKey = entityKey(source.catalogId, source.id);
  const incoming = entities
    .filter((entity) => entity.links?.some((link) => entityKey(link.catalogId, link.entityId) === sourceKey))
    .sort((a, b) => a.catalogId.localeCompare(b.catalogId) || a.id.localeCompare(b.id));
  const queue = [...targetsOf(source.links, byKey), ...incoming].map((entity) => ({ entity, depth: 1 }));
  const seen = new Set([sourceKey]);
  const linked: LinkableEntity[] = [];

  for (let index = 0; index < queue.length; index += 1) {
    const { entity, depth } = queue[index];
    const key = entityKey(entity.catalogId, entity.id);
    if (seen.has(key)) continue;
    seen.add(key);
    linked.push(entity);
    if (depth >= maxDepth) continue;
    for (const target of targetsOf(entity.links, byKey)) queue.push({ entity: target, depth: depth + 1 });
  }
  return linked;
}

function linkedReferenceBlock(entity: LinkableEntity): string {
  const reference = labIdentityOf(entity).reference;
  const values = entityValueLines(linkedLabEntity(entity), Number.MAX_SAFE_INTEGER);
  return [
    `## Linked reference: ${entity.catalogId} ${entity.id} — ground truth, cite it`,
    ...(reference
      ? [`Source: ${reference.sourceGame} · ${reference.sourceFile} (${reference.sourceRow})`]
      : []),
    values || '- (no values recorded)',
  ].join('\n');
}

/** Render linked entities' recorded values with one explicit, total character budget. */
export function linkedReferencesBlock(
  source: Pick<LinkableEntity, 'id' | 'catalogId' | 'links'>,
  entities: readonly LinkableEntity[],
  maxChars = LINKED_REFERENCES_MAX_CHARS,
): string {
  const linked = collectLinkedReferences(source, entities);
  if (linked.length === 0) return '';
  const full = [
    '# LINKED REFERENCES — related catalog entities',
    'These are recorded values from linked entities. Treat them as ground truth, cite them, and do not contradict them.',
    ...linked.map(linkedReferenceBlock),
  ].join('\n\n');
  if (full.length <= maxChars) return full;

  const detailedMarker = `… TRUNCATED at ${maxChars} characters — additional linked ground truth was NOT shown.`;
  const marker = detailedMarker.length + 2 <= maxChars ? detailedMarker : '… TRUNCATED.';
  const room = Math.max(0, maxChars - marker.length - 2);
  if (room === 0) return marker.slice(0, Math.max(0, maxChars));
  return `${full.slice(0, room).trimEnd()}\n\n${marker}`;
}
