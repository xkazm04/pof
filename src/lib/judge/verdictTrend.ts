import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

/**
 * A step's SCORE TREND across re-judges — the pure model behind "did my fix actually improve
 * this?".
 *
 * The judge table keeps one row per judge class per step, so before the append-only history log
 * existed the second run overwrote the first and that question was unanswerable from the data.
 * This projects the kept log into the smallest shape a reader (or a chart) needs.
 *
 * Pure + framework-free: no fetching, no rendering, no clock. Evidence only — nothing in
 * `src/lib/catalog/acceptance/` imports this, so it provably cannot move a verdict.
 */

/** One judgment on the trend line. */
export interface VerdictTrendPoint {
  score: number;
  verdict: 'pass' | 'fail';
  judgedAt?: string;
  model: string;
  rubricVersion?: number;
  /** Did this judgment read the SAME content as the previous one? `null` for the first point. */
  sameContentAsPrevious: boolean | null;
}

export interface VerdictTrend {
  /** Oldest first — the direction a trend is read in. */
  points: VerdictTrendPoint[];
  /** latest − first, or `null` when there is nothing to compare (0 or 1 judgment). */
  delta: number | null;
  /** What the delta says, in one word. `none` = no comparison possible. */
  direction: 'improved' | 'regressed' | 'unchanged' | 'none';
  /** Best / worst scores across the kept window (`null` when empty). */
  best: number | null;
  worst: number | null;
}

/**
 * Build the trend for ONE judge class. Pass the history log for a single (step, judge) — mixing
 * judge classes would compare a vision score against a panel score, which are different rubrics
 * and not a trend at all.
 *
 * Ordering: by `judgedAt` when every point carries one (the log is already insertion-ordered, and
 * a stable sort keeps ties in write order); otherwise the given order is trusted.
 */
export function buildVerdictTrend(history: readonly JudgeVerdict[]): VerdictTrend {
  const ordered = [...history];
  if (ordered.every((v) => v.judgedAt)) {
    ordered.sort((a, b) => String(a.judgedAt).localeCompare(String(b.judgedAt)));
  }

  const points: VerdictTrendPoint[] = ordered.map((v, i) => ({
    score: v.score,
    verdict: v.verdict,
    ...(v.judgedAt ? { judgedAt: v.judgedAt } : {}),
    model: v.model,
    ...(v.rubricVersion != null ? { rubricVersion: v.rubricVersion } : {}),
    // Only a REAL comparison counts: two verdicts both carrying a content hash. A missing hash
    // on either side is unknown, never "same" — an unbound verdict must not imply the content
    // stood still.
    sameContentAsPrevious:
      i === 0 ? null : Boolean(v.contentHash && ordered[i - 1].contentHash && v.contentHash === ordered[i - 1].contentHash),
  }));

  if (points.length < 2) {
    return {
      points,
      delta: null,
      direction: 'none',
      best: points.length ? points[0].score : null,
      worst: points.length ? points[0].score : null,
    };
  }

  const delta = points[points.length - 1].score - points[0].score;
  const scores = points.map((p) => p.score);
  return {
    points,
    delta,
    direction: delta > 0 ? 'improved' : delta < 0 ? 'regressed' : 'unchanged',
    best: Math.max(...scores),
    worst: Math.min(...scores),
  };
}

/** A short, stable label for a trend point (`2026-07-29 14:03` → `07-29 14:03`). */
export function trendPointLabel(p: VerdictTrendPoint, index: number): string {
  const at = p.judgedAt;
  if (!at) return `#${index + 1}`;
  const m = /^\d{4}-(\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(at);
  return m ? `${m[1]} ${m[2]}` : at.slice(0, 16);
}

/** One sentence stating what the trend shows — or honestly, that there is no trend yet. */
export function trendSummary(t: VerdictTrend): string {
  if (t.points.length === 0) return 'No judgments recorded for this step yet.';
  if (t.points.length === 1) return 'Judged once — no prior verdict to compare against yet.';
  const sign = t.delta! > 0 ? '+' : '';
  const word = t.direction === 'improved' ? 'improved' : t.direction === 'regressed' ? 'regressed' : 'unchanged';
  return `${t.points.length} judgments · ${word} ${sign}${t.delta} points (${t.points[0].score} → ${t.points[t.points.length - 1].score}), best ${t.best} / worst ${t.worst}.`;
}
