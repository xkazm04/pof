/**
 * Where a one-shot proposal LANDS in the distribution it was designed against — computed before
 * the operator spends model dispatches on 'Run pipeline'.
 *
 * Every measured dimension reads the proposal through the same `readPath` + `bucketKeyOf` rule
 * the histograms were built with (`coverage.ts`), so a value can never be keyed differently here
 * than it will be once the entity exists. Whether it closes an under-represented gap is the
 * analyzer's own `isUnderrepresented`, re-applied at got+1 over total+1 with the plugin's declared
 * share — never the rounded `expected` shown on screen (the two disagree at the boundary).
 */
import { isUnderrepresented, type CatalogDistribution } from './index';
import { bucketKeyOf, readPath } from './coverage';
import { pluginFor } from './plugins';
import type { Histogram } from './plugins/types';
import type { GapTargetSpec } from './rankGaps';

export interface LandingBucket { label: string; before: number; after: number }

export interface DimensionLanding {
  attribute: string;
  /** `lands` = counted in `value`'s bucket; `missing` = the proposal carries no value here. */
  state: 'lands' | 'missing';
  value: string | null;
  before: number;
  after: number;
  /** No entity holds `value` yet — the proposal opens its bucket. */
  newBucket: boolean;
  /** Set when `value` is an under-represented bucket. `closes: null` = no declared share to re-apply. */
  gap: { expected: number; closes: boolean | null } | null;
  /** Every bucket of the dimension (zero-count gap buckets folded in), before and after. */
  buckets: LandingBucket[];
}

export type TargetVerdict =
  | { state: 'none' }
  | { state: 'on'; attribute: string; value: string }
  | { state: 'off'; attribute: string; want: string; got: string }
  | { state: 'missing'; attribute: string; want: string };

export interface ProposalLanding {
  dimensions: Record<string, DimensionLanding>;
  target: TargetVerdict;
}

type Shares = Record<string, Record<string, number>>;
type TargetLike = Pick<GapTargetSpec, 'attribute' | 'value'>;

const has = (h: Histogram, key: string): boolean => Object.prototype.hasOwnProperty.call(h, key);
const countOf = (h: Histogram, key: string): number => (has(h, key) ? h[key] : 0);

function landDimension(d: CatalogDistribution, attr: string, h: Histogram, data: unknown, shares: Shares): DimensionLanding {
  const gaps = new Map(d.underrepresented.filter((u) => u.attribute === attr).map((u) => [u.value, u]));
  const value = bucketKeyOf(readPath(data, attr));
  const labels = [...Object.keys(h), ...[...gaps.keys()].filter((v) => !has(h, v))];
  if (value !== null && !labels.includes(value)) labels.push(value);
  const buckets = labels.map((label) => {
    const before = countOf(h, label);
    return { label, before, after: before + (label === value ? 1 : 0) };
  });
  if (value === null) {
    return { attribute: attr, state: 'missing', value: null, before: 0, after: 0, newBucket: false, gap: null, buckets };
  }
  const before = countOf(h, value);
  const row = gaps.get(value);
  const share = shares[attr]?.[value];
  // The analyzer's per-dimension total is the histogram's carriers, not the catalog's entities.
  const total = Object.values(h).reduce((a, b) => a + b, 0);
  const gap = row
    ? { expected: row.expected, closes: share === undefined ? null : !isUnderrepresented(before + 1, share, total + 1) }
    : null;
  return { attribute: attr, state: 'lands', value, before, after: before + 1, newBucket: before === 0, gap, buckets };
}

function targetVerdict(data: unknown, target: TargetLike | null): TargetVerdict {
  if (!target) return { state: 'none' };
  const { attribute, value: want } = target;
  const got = bucketKeyOf(readPath(data, attribute));
  if (got === null) return { state: 'missing', attribute, want };
  return got === want ? { state: 'on', attribute, value: want } : { state: 'off', attribute, want, got };
}

/**
 * Place `data` on every measured dimension of `d` (plus the declared-but-unmeasured ones) and
 * judge it against `target`. `expectedShare` defaults to the catalog plugin's declaration.
 */
export function proposalLanding(
  d: CatalogDistribution,
  data: unknown,
  target: TargetLike | null,
  expectedShare: Shares = pluginFor(d.catalogId)?.expectedShare ?? {},
): ProposalLanding {
  const dimensions: Record<string, DimensionLanding> = {};
  for (const [attr, h] of Object.entries(d.byAttribute)) dimensions[attr] = landDimension(d, attr, h, data, expectedShare);
  for (const attr of d.unmeasured ?? []) {
    if (!dimensions[attr]) dimensions[attr] = landDimension(d, attr, {}, data, expectedShare);
  }
  return { dimensions, target: targetVerdict(data, target) };
}

/** The corrective refine direction for an off/missing target; `null` when there is nothing to fix. */
export function refineToTargetDirection(l: ProposalLanding): string | null {
  const t = l.target;
  if (t.state === 'off') {
    return `Set ${t.attribute} to ${t.want}: the proposal was aimed at the ${t.attribute}=${t.want} gap but carries ${t.attribute}=${t.got}. Keep the rest of the design coherent with that change.`;
  }
  if (t.state === 'missing') {
    return `Set ${t.attribute} to ${t.want}: the proposal was aimed at the ${t.attribute}=${t.want} gap but carries no ${t.attribute}, so it would count toward no bucket.`;
  }
  return null;
}
