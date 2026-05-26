import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { pluginFor } from './plugins';
import type { Histogram } from './plugins/types';

export type { Histogram } from './plugins/types';

export interface CatalogDistribution {
  catalogId: string;
  total: number;
  byAttribute: Record<string, Histogram>;
  underrepresented: Array<{ attribute: string; value: string; count: number; expected: number }>;
  sample: StoredCatalogEntity[];
}

/** Read a dot-path value from an entity's `data` payload. */
function readPath(data: unknown, path: string): unknown {
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

function pickStratifiedSample(entities: StoredCatalogEntity[], path: string, max = 5): StoredCatalogEntity[] {
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
  while (out.length < max && keys.length > 0) {
    const k = keys[i % keys.length];
    const bucket = byKey.get(k)!;
    if (bucket.length) out.push(bucket.shift()!);
    if (!bucket.length) { keys.splice(keys.indexOf(k), 1); i = 0; continue; }
    i++;
    if (i > 1000) break;
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

export function analyzeCatalog(catalogId: string, entities: StoredCatalogEntity[]): CatalogDistribution {
  const plugin = pluginFor(catalogId);
  const dimensions = plugin?.dimensions ?? inferDimensions(entities);
  const byAttribute: Record<string, Histogram> = {};
  for (const d of dimensions) {
    const h = aggregateByAttr(entities, d);
    if (Object.keys(h).length > 0) byAttribute[d] = h;
  }
  const expected = plugin?.expectedShare ?? {};
  const underrepresented: CatalogDistribution['underrepresented'] = [];
  for (const [attr, h] of Object.entries(byAttribute)) {
    const exp = expected[attr];
    if (!exp) continue;
    const total = Object.values(h).reduce((a, b) => a + b, 0);
    for (const [val, share] of Object.entries(exp)) {
      const want = share * total;
      const got = h[val] ?? 0;
      if (got < want * 0.6 && want >= 1) {
        underrepresented.push({ attribute: attr, value: val, count: got, expected: Math.round(want) });
      }
    }
  }
  const primary = dimensions[0] ?? '';
  return {
    catalogId,
    total: entities.length,
    byAttribute,
    underrepresented,
    sample: pickStratifiedSample(entities, primary, 5),
  };
}
