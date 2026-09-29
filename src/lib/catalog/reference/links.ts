/**
 * Cross-table link resolution for one source's wrappers.
 *
 * A projected link holds the SOURCE's own reference (`Fireball`, `CLEAVER`) because the row
 * that owns it cannot know what id its target was given. Once every table of the source is
 * wrapped, a reference that names a wrapped entity can be rewritten to that entity's PoF id
 * (`d1-Fireball`). One that names nothing wrapped is left raw and REPORTED — rewriting it to
 * a guessed id would produce a link that resolves nowhere and looks fine.
 */
import type { CatalogLink } from '@/lib/catalog/types';
import type { ReferenceWrapper } from './wrapper';

export interface UnresolvedLink {
  wrapperId: string;
  role: string;
  catalogId: string;
  ref: string;
}

export interface LinkReport {
  resolved: number;
  unresolved: UnresolvedLink[];
}

const BASE_ITEM_FILE = 'items/itemdat.tsv';
const UNIQUE_ITEM_FILE = 'items/unique_itemdat.tsv';
const MISSILE_FILE = 'missiles/misdat.tsv';

// Uniq(X) is not a unique_base_item value. The monster parser turns the two supported
// tokens into _unique_items enum values (.reference/devilutionX/Source/tables/monstdat.cpp:299-306),
// whose declarations are positions 0 and 1 (.reference/devilutionX/Source/items.h:47-50);
// the unique loader appends table rows in that same order
// (.reference/devilutionX/Source/tables/itemdat.cpp:642-665).
// SpawnItem masks that enum index back out and passes it to SpawnUnique
// (.reference/devilutionX/Source/items.cpp:3427-3432).
const UNIQUE_DROP_ENUMS = ['CLEAVER', 'SKCROWN'] as const;

function addBaseItemLinks(wrappers: ReferenceWrapper[]): ReferenceWrapper[] {
  const bases = new Map<string, ReferenceWrapper[]>();
  for (const wrapper of wrappers) {
    if (wrapper.file !== BASE_ITEM_FILE) continue;
    const base = wrapper.entity.data.uniqueBase;
    if (typeof base !== 'string' || base === '') continue;
    bases.set(base, [...(bases.get(base) ?? []), wrapper]);
  }

  return wrappers.map((wrapper) => {
    if (wrapper.file !== UNIQUE_ITEM_FILE) return wrapper;
    const base = wrapper.entity.data.uniqueBase;
    if (typeof base !== 'string' || base === '') return wrapper;

    // Runtime selection joins the base row and every eligible unique by this enum
    // (.reference/devilutionX/Source/items.cpp:1417-1436). Several itemdat rows can carry
    // one enum, so preserve every target; forced unique spawning chooses the first match
    // (.reference/devilutionX/Source/items.cpp:3210-3216), it does not redefine the join.
    const targets = bases.get(base) ?? [];
    const links = (wrapper.entity.links ?? []).filter((link) => link.role !== 'base-item');
    if (targets.length === 0) {
      links.push({ catalogId: 'items', entityId: base, role: 'base-item' });
    } else {
      links.push(...targets.map((target) => ({
        catalogId: 'items', entityId: target.entity.id, role: 'base-item',
      })));
    }
    return { ...wrapper, entity: { ...wrapper.entity, links } };
  });
}

function addMissileSpriteLinks(wrappers: ReferenceWrapper[]): ReferenceWrapper[] {
  return wrappers.map((wrapper) => {
    if (wrapper.file !== MISSILE_FILE || !wrapper.raw.graphic) return wrapper;
    const graphic = wrapper.raw.graphic;
    const links = (wrapper.entity.links ?? []).filter((link) => link.role !== 'sprite');
    links.push({
      catalogId: 'vfx',
      entityId: `sprite-${graphic}`,
      role: 'sprite',
    });
    return { ...wrapper, entity: { ...wrapper.entity, links } };
  });
}

/** Pure. Returns new wrappers; the inputs are not mutated. */
export function resolveLinks(wrappers: ReferenceWrapper[], idPrefix: string): { wrappers: ReferenceWrapper[]; report: LinkReport } {
  const linkedWrappers = addMissileSpriteLinks(addBaseItemLinks(wrappers));
  const ids = new Map<string, Set<string>>();
  for (const w of linkedWrappers) {
    (ids.get(w.catalogId) ?? ids.set(w.catalogId, new Set()).get(w.catalogId)!).add(w.entity.id);
  }
  const uniqueItems = linkedWrappers.filter((wrapper) => wrapper.file === UNIQUE_ITEM_FILE);

  const report: LinkReport = { resolved: 0, unresolved: [] };
  const out = linkedWrappers.map((w) => {
    if (!w.entity.links?.length) return w;
    const links = w.entity.links.map((l): CatalogLink => {
      const target = `${idPrefix}-${l.entityId}`;
      if (l.entityId.startsWith(`${idPrefix}-`) && ids.get(l.catalogId)?.has(l.entityId)) {
        report.resolved++;
        return l; // already resolved (a re-run over resolved wrappers is a no-op)
      }
      if (l.role === 'unique-drop') {
        const uniqueIndex = UNIQUE_DROP_ENUMS.indexOf(l.entityId as typeof UNIQUE_DROP_ENUMS[number]);
        const unique = uniqueIndex === -1 ? undefined : uniqueItems[uniqueIndex];
        if (unique) {
          report.resolved++;
          return { ...l, entityId: unique.entity.id };
        }
      }
      if (ids.get(l.catalogId)?.has(target)) {
        report.resolved++;
        return { ...l, entityId: target };
      }
      report.unresolved.push({ wrapperId: w.wrapperId, role: l.role, catalogId: l.catalogId, ref: l.entityId });
      return l;
    });
    return { ...w, entity: { ...w.entity, links } };
  });
  return { wrappers: out, report };
}
