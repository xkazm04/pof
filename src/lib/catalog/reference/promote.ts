/**
 * Promotion — a wrapper's projection becomes a real catalog entity (`catalog_entities`,
 * `source: 'ingest'`), which is what makes it visible to the lab, the pipelines and the gates.
 *
 * Promotion is SELECTIVE by design. The wrapper store holds the whole game; the replication
 * loop promotes only what a wave targets, so the lab shows the entities under review rather
 * than 300 rows nobody is working on. A payload JSON cannot carry is refused, not written
 * hollow — the lesson of `ArchetypeConfig.icon`.
 */
import { jsonUnsafeKeys } from '@/lib/catalog/entityPayload';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { ReferenceWrapper } from './wrapper';

export interface PromoteSelection {
  catalogId?: string;
  /** Exact entity ids (`d1-MT_NZOMBIE`). */
  entityIds?: string[];
  limit?: number;
}

export type EntityUpsert = (rec: { catalogId: string; entityId: string; source: 'ingest'; entity: StoredCatalogEntity }) => unknown;

export interface PromoteReport {
  promoted: string[];
  refused: { entityId: string; reason: string; unsafeKeys?: string[] }[];
}

/**
 * The same refusals the hand-made path enforces (`POST /api/catalog-entities` answers 409 for a
 * code-seed id). Import is a writer like any other, never a side door around the model's
 * invariants (registry: import-normalization, "one validation door"). Returns a reason to refuse,
 * or null.
 */
export type PromotionGuard = (catalogId: string, entityId: string) => string | null;

export function selectForPromotion(wrappers: ReferenceWrapper[], sel: PromoteSelection): ReferenceWrapper[] {
  const ids = sel.entityIds ? new Set(sel.entityIds) : null;
  const picked = wrappers.filter((w) =>
    (!sel.catalogId || w.catalogId === sel.catalogId) && (!ids || ids.has(w.entity.id)));
  return sel.limit !== undefined ? picked.slice(0, sel.limit) : picked;
}

export function promoteWrappers(wrappers: ReferenceWrapper[], upsert: EntityUpsert, guard?: PromotionGuard): PromoteReport {
  const report: PromoteReport = { promoted: [], refused: [] };
  for (const w of wrappers) {
    const unsafe = jsonUnsafeKeys(w.entity);
    if (unsafe.length) {
      report.refused.push({ entityId: w.entity.id, reason: 'payload would not survive JSON persistence', unsafeKeys: unsafe });
      continue;
    }
    const denied = guard?.(w.catalogId, w.entity.id);
    if (denied) { report.refused.push({ entityId: w.entity.id, reason: denied }); continue; }
    upsert({ catalogId: w.catalogId, entityId: w.entity.id, source: 'ingest', entity: w.entity });
    report.promoted.push(w.entity.id);
  }
  return report;
}
