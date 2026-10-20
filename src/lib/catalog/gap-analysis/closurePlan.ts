/**
 * Closure plan — how many NEW entities balance a catalog, not the sum of its bucket deficits.
 *
 * One entity lands in a bucket of EVERY measured dimension at once, and each addition grows every
 * dimension's total. So the plan is a greedy simulation against the analyzer's single rule
 * (`isUnderrepresented`): each step builds one entity taking the largest-deficit open gap of each
 * dimension (a dimension with no open gap gets its most over-filled bucket, so totals stay honest),
 * applies got+1 / total+1, and repeats until nothing is under-represented or `MAX_ENTITIES`.
 */
import { isUnderrepresented, type CatalogDistribution } from './index';
import { gapBasisOf, type GapBasis } from './coverage';

export const MAX_ENTITIES = 50;

export interface PlanAssignment {
  attribute: string;
  value: string;
  /** `gap`: the bucket was under-represented; `filler`: the entity must carry some value here. */
  kind: 'gap' | 'filler';
}

export interface PlannedEntity { assignments: PlanAssignment[] }

export interface ClosurePlan {
  entities: PlannedEntity[];
  /** False when `MAX_ENTITIES` was hit with gaps still open (or the shares are unknown). */
  converged: boolean;
  basis: GapBasis;
}

type Shares = Record<string, Record<string, number>>;

/** Code-unit order — never locale-dependent. */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

interface Dim { attr: string; hist: Record<string, number>; total: number; share: Record<string, number> }

function openGaps(d: Dim): Array<{ value: string; deficit: number }> {
  const out: Array<{ value: string; deficit: number }> = [];
  for (const [value, s] of Object.entries(d.share)) {
    const got = d.hist[value] ?? 0;
    if (isUnderrepresented(got, s, d.total)) out.push({ value, deficit: s * d.total - got });
  }
  return out.sort((a, b) => b.deficit - a.deficit || cmp(a.value, b.value));
}

function mostOverfilled(d: Dim): string | null {
  let best: { value: string; surplus: number } | null = null;
  for (const [value, s] of Object.entries(d.share).sort(([a], [b]) => cmp(a, b))) {
    const surplus = (d.hist[value] ?? 0) - s * d.total;
    if (!best || surplus > best.surplus) best = { value, surplus };
  }
  return best ? best.value : null;
}

export function planClosure(dist: CatalogDistribution, shares: Shares): ClosurePlan {
  const basis = gapBasisOf(dist);
  if (basis === 'none') return { entities: [], converged: true, basis };

  const dims: Dim[] = Object.keys(dist.byAttribute).sort(cmp)
    .filter((attr) => shares[attr] && Object.keys(shares[attr]).length > 0)
    .map((attr) => ({
      attr, hist: { ...dist.byAttribute[attr] }, share: shares[attr],
      total: Object.values(dist.byAttribute[attr]).reduce((a, b) => a + b, 0),
    }));

  const entities: PlannedEntity[] = [];
  while (entities.length < MAX_ENTITIES && dims.some((d) => openGaps(d).length > 0)) {
    const assignments: PlanAssignment[] = [];
    for (const d of dims) {
      const gap = openGaps(d)[0];
      const value = gap ? gap.value : mostOverfilled(d);
      if (value === null) continue;
      assignments.push({ attribute: d.attr, value, kind: gap ? 'gap' : 'filler' });
    }
    // Apply after choosing: the entity is one unit, every dimension saw the same "before".
    for (const a of assignments) {
      const d = dims.find((x) => x.attr === a.attribute)!;
      d.hist[a.value] = (d.hist[a.value] ?? 0) + 1;
      d.total += 1;
    }
    entities.push({ assignments });
  }
  return { entities, converged: !dims.some((d) => openGaps(d).length > 0), basis };
}
