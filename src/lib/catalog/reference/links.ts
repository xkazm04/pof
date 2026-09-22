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

/** Pure. Returns new wrappers; the inputs are not mutated. */
export function resolveLinks(wrappers: ReferenceWrapper[], idPrefix: string): { wrappers: ReferenceWrapper[]; report: LinkReport } {
  const ids = new Map<string, Set<string>>();
  for (const w of wrappers) {
    (ids.get(w.catalogId) ?? ids.set(w.catalogId, new Set()).get(w.catalogId)!).add(w.entity.id);
  }

  const report: LinkReport = { resolved: 0, unresolved: [] };
  const out = wrappers.map((w) => {
    if (!w.entity.links?.length) return w;
    const links = w.entity.links.map((l): CatalogLink => {
      const target = `${idPrefix}-${l.entityId}`;
      if (l.entityId.startsWith(`${idPrefix}-`) && ids.get(l.catalogId)?.has(l.entityId)) {
        report.resolved++;
        return l; // already resolved (a re-run over resolved wrappers is a no-op)
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
