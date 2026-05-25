/**
 * Letter-grade + delta helpers for the Asset-Code Consistency Oracle headline
 * metric. Kept separate from the view so the grading thresholds are pure,
 * reusable, and unit-testable.
 *
 * Color for a score comes from `successRateColor` in `@/lib/chart-colors`
 * (green >=80, amber 50-79, red <50) — the same band logic the rest of the
 * app uses, so we don't re-define a parallel threshold ladder here.
 */

/** Map a 0-100 consistency score to a universally-understood letter grade. */
export function letterGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/** Short qualitative band label aligned with the success/warning/error color bands. */
export function gradeBandLabel(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 50) return 'Needs attention';
  return 'Critical';
}

/** One-line plain-language caption describing what the score means. */
export function gradeBandCaption(score: number): string {
  if (score >= 80) return 'Assets and code are well-aligned across the project.';
  if (score >= 50) return 'Several mismatches detected — review the violations below.';
  return 'Significant drift between code and assets — needs attention.';
}

/**
 * Human-friendly "since <when>" phrase for a previous scan timestamp, e.g.
 * "since yesterday" or "since Tuesday". Accepts an injectable `now` so it
 * stays deterministic in tests (and is only ever called from event handlers,
 * never render — wall-clock reads in render violate react-hooks/purity).
 */
export function formatSince(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const startThen = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayDiff = Math.round((startNow - startThen) / 86_400_000);

  if (dayDiff <= 0) return 'since earlier today';
  if (dayDiff === 1) return 'since yesterday';
  if (dayDiff < 7) return `since ${then.toLocaleDateString(undefined, { weekday: 'long' })}`;
  return `since ${then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}
