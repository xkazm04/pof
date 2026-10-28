import type Database from 'better-sqlite3';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import type { CatalogHandler } from './types';

export interface PoolResolution {
  pool?: ReferenceWrapper[];
  /** Why the handler's pool could not be built. Staleness is then UNKNOWN, never "none". */
  unavailable?: string;
}

/**
 * A handler pool exists only to compare a promoted entity against what its wrapper projects
 * TODAY. Two cases the GATE snapshot must survive instead of dying on (/diablo W108, after the
 * whole store was lost with the machine): nothing promoted makes the question vacuous, and an
 * engine-derived pool cannot be built on a COLD store at all — descentSim needs the class
 * aggregates and throws `the supplied wrappers have no d1-class-warrior aggregate`, which took
 * the entire snapshot down at exactly the moment a human needed it to say "nothing ingested".
 * Reporting "no stale entities" in either case would be a lie, so the reason travels out.
 */
export function resolveStalenessPool(
  handler: CatalogHandler | undefined,
  db: Database.Database,
  sourceId: string,
  wrappers: readonly ReferenceWrapper[],
  promotedCount: number,
): PoolResolution {
  if (!handler?.pool || promotedCount === 0) return {};
  try {
    return { pool: handler.pool(db, sourceId, wrappers) };
  } catch (err) {
    return { unavailable: err instanceof Error ? err.message : String(err) };
  }
}
