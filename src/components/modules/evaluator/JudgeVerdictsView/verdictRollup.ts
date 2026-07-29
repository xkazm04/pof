import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import type { VerdictProvenance } from '@/lib/catalog/acceptance/types';
import { isStanding, type StandingVerdict } from '@/lib/judge/verdictStanding';

/**
 * Pure rollup helpers for the Verdicts tab. The AI content judges (Sonnet LLM-panel /
 * Qwen VLM / human) produce one {@link JudgeVerdict} per produced step; this groups them
 * by catalog and derives per-catalog summary stats so the UI can present the deepest
 * quality signal the project has (the judges) grouped the way the user thinks — by catalog.
 * Kept pure + separate so the grouping is unit-testable without rendering.
 *
 * ── What counts (2026-07-29) ───────────────────────────────────────────────────
 * The headline counts and averages used to include EVERY stored row — so a fail scored under a
 * superseded rubric, and a fail bound to content the step no longer holds, both inflated a
 * number the acceptance layer itself did not hold (`judgeBridge` applies neither). Totals are
 * now derived from the STANDING subset only ({@link isStanding}, the same set acceptance
 * condemns on). Non-standing rows are NOT hidden — they are evidence, they stay in the list with
 * their provenance visible, and they are reported separately as `supersededCount` / `staleCount`
 * so the gap between "judged" and "still true" is legible rather than averaged away.
 *
 * A verdict with no server-computed `provenance` (a caller that did not read the enriched
 * endpoint) is treated as standing — it is the pre-existing behaviour, and inventing a
 * non-standing classification would silently drop a real condemnation from the count.
 */

/** A verdict as this view consumes it: the stored row plus its optional server standing. */
export type ViewVerdict = JudgeVerdict & Partial<Pick<StandingVerdict, 'provenance'>>;

export interface VerdictStats {
  /** Every stored verdict in scope, standing or not. */
  total: number;
  /** How many of them still speak for the content on record. */
  standing: number;
  /** pass / fail / average over the STANDING subset only. */
  passCount: number;
  failCount: number;
  avgScore: number;
  /** Why the rest do not count — reported, never hidden. */
  supersededCount: number;
  staleCount: number;
}

export interface CatalogVerdictGroup extends VerdictStats {
  catalogId: string;
  verdicts: ViewVerdict[];
}

/** Does this verdict count toward current quality? Absent provenance → yes (see module note). */
export function countsAsCurrent(v: ViewVerdict): boolean {
  return v.provenance === undefined || isStanding(v.provenance);
}

/** Provenance the server computed for this verdict, when the enriched endpoint supplied one. */
export function provenanceOf(v: ViewVerdict): VerdictProvenance | undefined {
  return v.provenance;
}

/** Standing first (a superseded/stale row is evidence, not today's news), then fails, then
 *  lowest score first so the worst content is easy to spot. */
function sortVerdicts(a: ViewVerdict, b: ViewVerdict): number {
  const [sa, sb] = [countsAsCurrent(a), countsAsCurrent(b)];
  if (sa !== sb) return sa ? -1 : 1;
  if (a.verdict !== b.verdict) return a.verdict === 'fail' ? -1 : 1;
  return a.score - b.score;
}

/** Totals over a set of verdicts — standing subset for quality, full set for the record. */
export function verdictTotals(verdicts: ViewVerdict[]): VerdictStats {
  const standing = verdicts.filter(countsAsCurrent);
  const passCount = standing.filter((v) => v.verdict === 'pass').length;
  return {
    total: verdicts.length,
    standing: standing.length,
    passCount,
    failCount: standing.length - passCount,
    avgScore: standing.length ? Math.round(standing.reduce((s, v) => s + v.score, 0) / standing.length) : 0,
    supersededCount: verdicts.filter((v) => v.provenance === 'superseded').length,
    staleCount: verdicts.filter((v) => v.provenance === 'stale').length,
  };
}

/** Group verdicts by catalog with summary stats, catalogs ordered worst-first (most standing
 *  fails, then lowest average) so the content most in need of attention leads. */
export function rollupVerdictsByCatalog(verdicts: ViewVerdict[]): CatalogVerdictGroup[] {
  const byCatalog = new Map<string, ViewVerdict[]>();
  for (const v of verdicts) {
    const arr = byCatalog.get(v.catalogId);
    if (arr) arr.push(v);
    else byCatalog.set(v.catalogId, [v]);
  }

  const groups: CatalogVerdictGroup[] = [];
  for (const [catalogId, vs] of byCatalog) {
    groups.push({ catalogId, verdicts: [...vs].sort(sortVerdicts), ...verdictTotals(vs) });
  }

  groups.sort((a, b) => (b.failCount - a.failCount) || (a.avgScore - b.avgScore) || a.catalogId.localeCompare(b.catalogId));
  return groups;
}
