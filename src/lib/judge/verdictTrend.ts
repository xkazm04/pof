import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { sameContent } from './bindingRule';

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

/**
 * How many judgments are kept per (catalog, entity, step, judge class) before the oldest are
 * pruned.
 *
 * It lives HERE, not in `judge-verdicts-db`, because the trend UI displays the bound and that
 * file opens better-sqlite3 at import time — a client component importing it as a VALUE drags a
 * native Node module into the browser bundle (`Can't resolve 'fs'`), which neither `tsc` nor
 * vitest catches. This module is pure and client-safe; the DB module imports the constant from
 * here for its prune, so there is still exactly one definition.
 */
export const VERDICT_HISTORY_LIMIT = 20;

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
  /** Best / worst scores across the comparable window (`null` when empty). */
  best: number | null;
  worst: number | null;
  /**
   * How many trailing points share the newest point's rubric version AND model. `delta`,
   * `direction`, `best` and `worst` are drawn from exactly these: a rubric bump or a model swap
   * changes the ruler, so a score difference across it is not movement of the product.
   */
  comparable: number;
}

/**
 * Where the trailing run of mutually comparable points starts (an index into `pts`): the
 * earliest point from which every later point shares the newest point's `version` and `model`.
 * THE comparable-window rule the R-axis and A-axis trends share. `0` for an empty or uniform log.
 */
export function comparableWindowStart(pts: readonly { version?: number; model: string }[]): number {
  if (pts.length === 0) return 0;
  const last = pts[pts.length - 1];
  let start = pts.length - 1;
  while (start > 0 && pts[start - 1].version === last.version && pts[start - 1].model === last.model) start--;
  return start;
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
    sameContentAsPrevious: i === 0 ? null : sameContent(ordered[i - 1], v),
  }));

  if (points.length < 2) {
    return {
      points,
      delta: null,
      direction: 'none',
      best: points.length ? points[0].score : null,
      worst: points.length ? points[0].score : null,
      comparable: points.length,
    };
  }

  const start = comparableWindowStart(points.map((p) => ({ version: p.rubricVersion, model: p.model })));
  const window = points.slice(start);
  const scores = window.map((p) => p.score);
  if (window.length < 2) {
    return { points, delta: null, direction: 'none', best: scores[0], worst: scores[0], comparable: window.length };
  }
  const delta = window[window.length - 1].score - window[0].score;
  return {
    points,
    delta,
    direction: delta > 0 ? 'improved' : delta < 0 ? 'regressed' : 'unchanged',
    best: Math.max(...scores),
    worst: Math.min(...scores),
    comparable: window.length,
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
  if (t.delta === null) {
    return `${t.points.length} judgments, but the rubric or model changed since the earlier ones — the latest (${t.points[t.points.length - 1].score}) is not comparable to them yet.`;
  }
  const window = t.points.slice(t.points.length - t.comparable);
  const sign = t.delta > 0 ? '+' : '';
  const word = t.direction === 'improved' ? 'improved' : t.direction === 'regressed' ? 'regressed' : 'unchanged';
  return `${window.length} judgments · ${word} ${sign}${t.delta} points (${window[0].score} → ${window[window.length - 1].score}), best ${t.best} / worst ${t.worst}.`;
}
