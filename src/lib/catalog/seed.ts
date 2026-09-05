/**
 * Server-side reader for catalog entities.
 *
 * `seededEntities` is the ONE server-importable answer to "does this entity exist?" — it
 * backs `listEntitySummaries`, the server `CheckerContext.has()`, the static-verify
 * resolver, the one-shot routes and the headless recipe builder. It used to read
 * `CATALOG_SECTIONS` only, so an entity a USER created (the one-shot flow's
 * `draft-<catalog>-<ts>`, which lived in `localStorage` while its ~11 artifacts went to
 * SQLite) resolved nowhere on the server: every gate silently EXEMPTED it. Absence must
 * never read as exemption — so the answer is now the UNION of the code seeds and the
 * `catalog_entities` rows.
 *
 * Precedence is one-directional and non-negotiable: **a persisted row can never shadow a
 * code seed.** The code seed is the reviewed, version-controlled definition the walker, the
 * drain and the judge all resolve; letting a DB row silently replace one would make an
 * entity's identity depend on which machine read it. A colliding row is REPORTED
 * (`entityCollisions`, plus a one-time `logger.warn`) rather than merged away.
 */
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { listEntities } from '@/lib/catalog-db';
import { logger } from '@/lib/logger';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

/** A persisted row whose id is already taken by a code seed — reported, never merged. */
export interface EntityCollision {
  catalogId: string;
  entityId: string;
  /** The name the persisted row carries (the code seed's name is what actually resolves). */
  persistedName: string;
  reason: string;
}

/**
 * The statically-seeded entities for a catalogId, exactly as the code declares them.
 * Empty when the catalogId is not registered. Pure — no DB.
 */
export function codeSeededEntities(catalogId: string): StoredCatalogEntity[] {
  const section = CATALOG_SECTIONS.find((s) => s.catalogId === catalogId);
  if (!section) return [];
  return section.seed() as StoredCatalogEntity[];
}

/** Persisted rows for a catalog, or `[]` when the DB is unreachable from this context. */
function persistedEntities(catalogId: string): StoredCatalogEntity[] {
  try {
    return listEntities(catalogId).map((r) => r.entity);
  } catch (e) {
    // A read failure is not "there are none" — say so loudly rather than quietly
    // reproducing the exemption this module exists to remove.
    logger.error(`seededEntities: catalog_entities unreadable for ${catalogId}: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

/** Persisted ids that collide with a code seed of the same catalog. */
export function entityCollisions(catalogId: string): EntityCollision[] {
  const codeIds = new Set(codeSeededEntities(catalogId).map((e) => e.id));
  return persistedEntities(catalogId)
    .filter((e) => codeIds.has(e.id))
    .map((e) => ({
      catalogId,
      entityId: e.id,
      persistedName: e.name,
      reason:
        `A persisted catalog_entities row uses the id of a code seed in "${catalogId}". `
        + 'The code seed wins — the persisted row is ignored, not merged. Delete or re-id the '
        + 'persisted row; never rename the code seed (that orphans every pipeline_artifacts row).',
    }));
}

/** One warn per (catalog, id) per process — a collision is a finding, not a per-call log flood. */
const warnedCollisions = new Set<string>();

/**
 * Every entity of a catalog the server can resolve: the code seeds FIRST, byte-identical
 * and in their declared order (so the Rule 5 walker and the drain are unchanged), then the
 * persisted `catalog_entities` rows that do not collide with one.
 */
export function seededEntities(catalogId: string): StoredCatalogEntity[] {
  const code = codeSeededEntities(catalogId);
  const persisted = persistedEntities(catalogId);
  if (!persisted.length) return code;

  const codeIds = new Set(code.map((e) => e.id));
  const extra: StoredCatalogEntity[] = [];
  for (const e of persisted) {
    if (codeIds.has(e.id)) {
      const key = `${catalogId}/${e.id}`;
      if (!warnedCollisions.has(key)) {
        warnedCollisions.add(key);
        logger.warn(
          `catalog_entities row "${key}" shadows a code seed — the code seed wins and the `
          + 'persisted row is ignored (see entityCollisions).',
        );
      }
      continue;
    }
    extra.push(e);
  }
  return extra.length ? [...code, ...extra] : code;
}
