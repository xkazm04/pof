import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

/**
 * Pure rollup helpers for the Verdicts tab. The AI content judges (Sonnet LLM-panel /
 * Qwen VLM / human) produce one {@link JudgeVerdict} per produced step; this groups them
 * by catalog and derives per-catalog summary stats so the UI can present the deepest
 * quality signal the project has (the judges) grouped the way the user thinks — by catalog.
 * Kept pure + separate so the grouping is unit-testable without rendering.
 */

export interface CatalogVerdictGroup {
  catalogId: string;
  verdicts: JudgeVerdict[];
  total: number;
  passCount: number;
  failCount: number;
  /** Average 0-100 score across the group's verdicts (rounded). */
  avgScore: number;
}

/** Newest-first by judgedAt, then by score ascending so the worst are easy to spot. */
function sortVerdicts(a: JudgeVerdict, b: JudgeVerdict): number {
  // Failing verdicts first (surface problems), then lowest score first.
  if (a.verdict !== b.verdict) return a.verdict === 'fail' ? -1 : 1;
  return a.score - b.score;
}

/** Group verdicts by catalog with summary stats, catalogs ordered worst-first (most fails,
 *  then lowest average) so the content most in need of attention leads. */
export function rollupVerdictsByCatalog(verdicts: JudgeVerdict[]): CatalogVerdictGroup[] {
  const byCatalog = new Map<string, JudgeVerdict[]>();
  for (const v of verdicts) {
    const arr = byCatalog.get(v.catalogId);
    if (arr) arr.push(v);
    else byCatalog.set(v.catalogId, [v]);
  }

  const groups: CatalogVerdictGroup[] = [];
  for (const [catalogId, vs] of byCatalog) {
    const sorted = [...vs].sort(sortVerdicts);
    const passCount = vs.filter((v) => v.verdict === 'pass').length;
    const failCount = vs.length - passCount;
    const avgScore = vs.length ? Math.round(vs.reduce((s, v) => s + v.score, 0) / vs.length) : 0;
    groups.push({ catalogId, verdicts: sorted, total: vs.length, passCount, failCount, avgScore });
  }

  groups.sort((a, b) => (b.failCount - a.failCount) || (a.avgScore - b.avgScore) || a.catalogId.localeCompare(b.catalogId));
  return groups;
}

/** Project-wide totals across every verdict — drives the header summary. */
export function verdictTotals(verdicts: JudgeVerdict[]): { total: number; passCount: number; failCount: number; avgScore: number } {
  const total = verdicts.length;
  const passCount = verdicts.filter((v) => v.verdict === 'pass').length;
  const avgScore = total ? Math.round(verdicts.reduce((s, v) => s + v.score, 0) / total) : 0;
  return { total, passCount, failCount: total - passCount, avgScore };
}
