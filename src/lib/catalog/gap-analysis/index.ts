import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { pluginFor } from './plugins';
import type { Histogram } from './plugins/types';
import {
  SAMPLE_MAX, measureDimensions, readPath, scopeToProfile,
  type DimensionCoverage, type GapBasis,
} from './coverage';

export type { Histogram } from './plugins/types';
export { aggregateByAttr, gapBasisOf, scopeToProfile, unmeasuredDimensions } from './coverage';
export type { DimensionCoverage, GapBasis } from './coverage';

/** A bucket is under-represented below this fraction of its expected count. */
export const UNDERREP_RATIO = 0.6;

/**
 * THE under-represented rule: `got` entities against `share` of a dimension's `total` carriers.
 * `analyzeCatalog` lists gaps with it and `proposalLanding` re-applies it at got+1 / total+1 to
 * say whether a proposal closes one, so the two can never disagree (not the rounded `expected`).
 */
export function isUnderrepresented(got: number, share: number, total: number): boolean {
  const want = share * total;
  return got < want * UNDERREP_RATIO && want >= 1;
}

/**
 * A catalog's measured state. The coverage fields are optional on the TYPE because a
 * distribution persisted before they existed (zustand `pof-one-shot-job`) or posted back by
 * a client may lack them — read the basis through `gapBasisOf` (missing = `none`).
 * `analyzeCatalog` always fills them (`MeasuredCatalogDistribution`).
 */
export interface CatalogDistribution {
  catalogId: string;
  total: number;
  byAttribute: Record<string, Histogram>;
  underrepresented: Array<{ attribute: string; value: string; count: number; expected: number }>;
  sample: StoredCatalogEntity[];
  /** Canon profile the entities were scoped to; absent = every profile's entities. */
  profile?: string;
  /** Per declared dimension: how many of `total` entities carry it. */
  coverage?: Record<string, DimensionCoverage>;
  /** Declared dimensions no entity carries — absent, never "balanced". */
  unmeasured?: string[];
  /** Dimensions whose values are all unique (an id list, not a distribution). */
  degenerate?: string[];
  /** Whether `underrepresented` had any basis to be computed from. */
  gapBasis?: GapBasis;
}

export type MeasuredCatalogDistribution = CatalogDistribution
  & Required<Pick<CatalogDistribution, 'coverage' | 'unmeasured' | 'degenerate' | 'gapBasis'>>;

export interface AnalyzeOptions {
  /** Count only this canon profile's entities (`canonProfileOf`). Omitted = unscoped. */
  profile?: string;
}

function pickStratifiedSample(entities: StoredCatalogEntity[], path: string, max = SAMPLE_MAX): StoredCatalogEntity[] {
  const byKey = new Map<string, StoredCatalogEntity[]>();
  for (const e of entities) {
    const v = readPath(e.data, path);
    const k = v === undefined ? '__none__' : String(v);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(e);
  }
  const out: StoredCatalogEntity[] = [];
  const keys = [...byKey.keys()];
  let i = 0;
  // Terminates naturally: each iteration either appends to `out` (bounded by `max`)
  // or removes a key from `keys` (bounded by initial bucket count).
  while (out.length < max && keys.length > 0) {
    const k = keys[i % keys.length];
    const bucket = byKey.get(k)!;
    if (bucket.length) out.push(bucket.shift()!);
    if (!bucket.length) { keys.splice(keys.indexOf(k), 1); i = 0; continue; }
    i++;
  }
  return out;
}

/** Fallback when no plugin is registered: histogram the first 3 top-level keys of `data`. */
function inferDimensions(entities: StoredCatalogEntity[]): string[] {
  const keys = new Set<string>();
  for (const e of entities.slice(0, 20)) {
    if (e.data && typeof e.data === 'object') {
      for (const k of Object.keys(e.data)) keys.add(k);
    }
  }
  return [...keys].slice(0, 3);
}

export function analyzeCatalog(
  catalogId: string,
  allEntities: StoredCatalogEntity[],
  options: AnalyzeOptions = {},
): MeasuredCatalogDistribution {
  const entities = options.profile ? scopeToProfile(allEntities, options.profile) : allEntities;
  const plugin = pluginFor(catalogId);
  const dimensions = plugin?.dimensions ?? inferDimensions(entities);
  const expected = plugin?.expectedShare ?? {};
  const { byAttribute, coverage, unmeasured, degenerate } = measureDimensions(dimensions, entities, expected);
  const underrepresented: CatalogDistribution['underrepresented'] = [];
  let gapBasis: GapBasis = 'none';
  for (const [attr, h] of Object.entries(byAttribute)) {
    const exp = expected[attr];
    if (!exp) continue;
    gapBasis = 'expected-share';
    const total = Object.values(h).reduce((a, b) => a + b, 0);
    for (const [val, share] of Object.entries(exp)) {
      const got = h[val] ?? 0;
      if (isUnderrepresented(got, share, total)) {
        underrepresented.push({ attribute: attr, value: val, count: got, expected: Math.round(share * total) });
      }
    }
  }
  const primary = dimensions[0] ?? '';
  return {
    catalogId,
    total: entities.length,
    byAttribute,
    underrepresented,
    sample: pickStratifiedSample(entities, primary, SAMPLE_MAX),
    ...(options.profile ? { profile: options.profile } : {}),
    coverage,
    unmeasured,
    degenerate,
    gapBasis,
  };
}
