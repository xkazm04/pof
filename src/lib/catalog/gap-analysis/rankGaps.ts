/**
 * Gap ranking across catalogs — the operator's "what should I add next?" as computed objects.
 *
 * `analyzeCatalog` already measures expected vs have per dimension; this turns every measured
 * under-represented row into a `GapTarget` with its deficit and orders them in ONE deterministic
 * total order (deficit desc, then catalogId, attribute, value) so the same catalogs always yield
 * the same list regardless of input order. A catalog with no gap basis is never ranked and never
 * called balanced: it is listed as `unmeasured` (absence is not balance — see `coverage.ts`).
 */
import type { CatalogDistribution } from './index';
import { gapBasisOf } from './coverage';
import { pluginFor } from './plugins';
import { gapDeficit, planClosure, type ClosurePlan } from './closurePlan';

/** One under-represented bucket of one catalog, as a proposal target. */
export interface GapTarget {
  catalogId: string;
  attribute: string;
  value: string;
  count: number;
  expected: number;
  /** expected − count: how many entities short the bucket is. */
  deficit: number;
}

/** What a design prompt needs of a target (the catalog is implied by the prompt). */
export type GapTargetSpec = Pick<GapTarget, 'attribute' | 'value' | 'count' | 'expected'>;

export interface CatalogGapRanking {
  /** Every measured gap, highest deficit first. */
  targets: GapTarget[];
  /** Catalogs with no basis to compute a gap from (no expected share) — never "balanced". */
  unmeasured: string[];
  /** Catalogs with an expected share and every bucket within tolerance. */
  balanced: string[];
  /** Per catalog with targets: how many new entities close its gaps together. */
  plans: Record<string, ClosurePlan>;
}

/** Code-unit order — never locale-dependent, so every machine ranks identically. */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

interface RankedTarget { target: GapTarget; deficit: number }

/** Order by the un-rounded deficit (`gapDeficit`, the closure plan's rule); ties fall to stable identity. */
function byStableIdentity(x: RankedTarget, y: RankedTarget): number {
  const a = x.target;
  const b = y.target;
  return y.deficit - x.deficit
    || cmp(a.catalogId, b.catalogId)
    || cmp(a.attribute, b.attribute)
    || cmp(a.value, b.value);
}

export function rankCatalogGaps(
  distributions: CatalogDistribution[],
  sharesOf: (catalogId: string) => Record<string, Record<string, number>> = (id) => pluginFor(id)?.expectedShare ?? {},
): CatalogGapRanking {
  const plans: Record<string, ClosurePlan> = {};
  const targets: RankedTarget[] = [];
  const unmeasured: string[] = [];
  const balanced: string[] = [];
  for (const d of distributions) {
    if (d.underrepresented.length) {
      const shares = sharesOf(d.catalogId);
      plans[d.catalogId] = planClosure(d, shares);
      for (const u of d.underrepresented) {
        const share = shares[u.attribute]?.[u.value];
        const total = Object.values(d.byAttribute[u.attribute] ?? {}).reduce((a, b) => a + b, 0);
        targets.push({
          target: {
            catalogId: d.catalogId, attribute: u.attribute, value: u.value,
            count: u.count, expected: u.expected, deficit: u.expected - u.count,
          },
          // No declared share to re-derive from: the rounded gap is all there is.
          deficit: share === undefined ? u.expected - u.count : gapDeficit(u.count, share, total),
        });
      }
    } else if (gapBasisOf(d) === 'expected-share') {
      balanced.push(d.catalogId);
    } else {
      unmeasured.push(d.catalogId);
    }
  }
  return {
    targets: targets.sort(byStableIdentity).map((r) => r.target),
    unmeasured: unmeasured.sort(cmp),
    balanced: balanced.sort(cmp),
    plans: Object.fromEntries(Object.keys(plans).sort(cmp).map((k) => [k, plans[k]])),
  };
}

/** The gap phrased as the next action the operator can take. */
export function gapTargetAction(t: Pick<GapTarget, 'catalogId' | 'attribute' | 'value' | 'count' | 'expected'>): string {
  return `Add a ${t.catalogId} entity with ${t.attribute}=${t.value} (have ${t.count}, expected ~${t.expected})`;
}

/** The prompt line for a target — the same wording the "Under-represented niches" rows use. */
export function gapTargetLine(t: GapTargetSpec): string {
  return `${t.attribute}=${t.value}: expected ~${t.expected}, have ${t.count}`;
}

/**
 * Narrow an untrusted value (a request body) to a target, or `null`. Every target `rankCatalogGaps`
 * or an under-represented row can produce has integer `count >= 0` and `expected > count` (a gap
 * is a deficit of at least one), so anything else is refused before a CLI run is spent on it.
 */
export function asGapTarget(v: unknown): GapTarget | null {
  if (!v || typeof v !== 'object') return null;
  const t = v as Record<string, unknown>;
  const str = (k: string) => typeof t[k] === 'string' && (t[k] as string).length > 0;
  const int = (k: string) => typeof t[k] === 'number' && Number.isInteger(t[k]) && (t[k] as number) >= 0;
  if (!str('catalogId') || !str('attribute') || !str('value') || !int('count') || !int('expected')) return null;
  const count = t.count as number;
  const expected = t.expected as number;
  if (expected <= count) return null;
  return {
    catalogId: t.catalogId as string, attribute: t.attribute as string, value: t.value as string,
    count, expected, deficit: expected - count,
  };
}
