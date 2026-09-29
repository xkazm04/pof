/**
 * Coverage honesty for gap analysis — what a dimension MEASURED, and whose entities count.
 *
 * Two decisions every consumer used to get wrong by default now live here, once:
 *
 * 1. **World scope.** `seededEntities` returns every canon profile's entities (the /diablo
 *    ingest persisted hundreds of `diablo1` rows). A distribution for designing a PoF entity
 *    must count PoF entities only — `scopeToProfile` filters through `canonProfileOf`.
 * 2. **Absence is not balance.** A declared dimension that no entity carries is UNMEASURED
 *    (reported with its coverage), a dimension whose every value is unique is DEGENERATE (an
 *    id list, not a distribution), and a catalog with no expected share has gap basis `none`
 *    — never "no gaps". Readers of a distribution persisted before these fields existed must
 *    go through `gapBasisOf`, which reads a missing basis as `none`.
 */
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { canonProfileOf } from '@/lib/catalog/canon/profiles';
import { pluginFor } from './plugins';
import type { Histogram } from './plugins/types';

/** Where an under-represented row can come from: a declared expected share, or nothing. */
export type GapBasis = 'expected-share' | 'none';

/** How many of a (scoped) catalog's entities carry a value for one dimension. */
export interface DimensionCoverage { covered: number; of: number }

/** The stratified sample size — also the degenerate threshold (see `measureDimensions`). */
export const SAMPLE_MAX = 5;

/** Read a dot-path value from an entity's `data` payload. */
export function readPath(data: unknown, path: string): unknown {
  if (data == null || typeof data !== 'object') return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, data);
}

export function aggregateByAttr(entities: StoredCatalogEntity[], path: string): Histogram {
  const out: Histogram = {};
  for (const e of entities) {
    const v = readPath(e.data, path);
    if (v === undefined || v === null) continue;
    const key = typeof v === 'string' ? v : String(v);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

/** The entities of one canon profile (`canonProfileOf`: an entity without one is `pof`). */
export function scopeToProfile(entities: StoredCatalogEntity[], profile: string): StoredCatalogEntity[] {
  return entities.filter((e) => canonProfileOf(e) === profile);
}

export interface DimensionMeasurement {
  /** Histograms of the dimensions that measured something (neither unmeasured nor degenerate). */
  byAttribute: Record<string, Histogram>;
  /** Coverage of EVERY dimension asked for, measured or not. */
  coverage: Record<string, DimensionCoverage>;
  /** Dimensions no entity carries (covered 0) — absent, never "balanced". */
  unmeasured: string[];
  /** Dimensions whose every value is unique across more entities than the sample holds. */
  degenerate: string[];
}

/**
 * Measure each dimension over `entities`. A dimension is DEGENERATE when it holds more
 * singleton buckets than the stratified sample (`SAMPLE_MAX`) and nothing else — such a
 * histogram names entities rather than distributing them. The minimum keeps small catalogs
 * (1-3 entities, every value trivially unique) measurable, and a dimension with a declared
 * expected share is a closed vocabulary, so it is never degenerate.
 */
export function measureDimensions(
  dimensions: readonly string[],
  entities: StoredCatalogEntity[],
  expectedShare: Record<string, Record<string, number>> = {},
): DimensionMeasurement {
  const out: DimensionMeasurement = { byAttribute: {}, coverage: {}, unmeasured: [], degenerate: [] };
  for (const d of dimensions) {
    const h = aggregateByAttr(entities, d);
    const counts = Object.values(h);
    const covered = counts.reduce((a, b) => a + b, 0);
    out.coverage[d] = { covered, of: entities.length };
    if (covered === 0) out.unmeasured.push(d);
    else if (!expectedShare[d] && covered > SAMPLE_MAX && counts.every((c) => c === 1)) out.degenerate.push(d);
    else out.byAttribute[d] = h;
  }
  return out;
}

/** The declared dimensions of `catalogId`'s plugin that cover none of `entities`. */
export function unmeasuredDimensions(catalogId: string, entities: StoredCatalogEntity[]): string[] {
  const plugin = pluginFor(catalogId);
  if (!plugin) return [];
  return measureDimensions(plugin.dimensions, entities).unmeasured;
}

/** A distribution's gap basis — a distribution persisted before the field existed reads `none`. */
export function gapBasisOf(dist: { gapBasis?: GapBasis }): GapBasis {
  return dist.gapBasis ?? 'none';
}
