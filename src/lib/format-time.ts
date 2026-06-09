/**
 * Shared relative "time ago" formatter.
 *
 * Consolidates the m/h/d-ago helpers that were hand-rolled across the shell
 * (TopBar, ActivityFeedPanel) and several module views (FeatureMatrix,
 * ContextHealthBadge, CrashAnalyzerView, ChatMessages). Keep this the single
 * source of truth so the relative-time wording stays consistent everywhere — a
 * threshold or label tweak then lands in one place instead of nine.
 *
 * For elapsed *durations* (build/eval timings) use `formatDuration` in
 * `@/lib/format`; this file is only for "how long ago was this timestamp".
 */

export interface TimeAgoOptions {
  /**
   * Add weeks/months tiers for older timestamps. Without it the scale caps at
   * days (`Nd ago` indefinitely). With it: `<7d → Nd ago`, `<5w → Nw ago`,
   * else `Nmo ago` (months = whole 30-day blocks).
   */
  extended?: boolean;
  /**
   * Render an `Ns ago` seconds tier under a minute (only the first 5s read as
   * "just now"). Off by default — most surfaces collapse the whole first minute
   * into the just-now label.
   */
  seconds?: boolean;
  /** Sub-minute label. Default `'just now'` (TopBar passes `'Just now'`). */
  justNow?: string;
  /** Label when the input doesn't parse to a date. Defaults to {@link justNow}. */
  invalid?: string;
}

/**
 * Format a past timestamp as a short relative string: `just now`, `5m ago`,
 * `3h ago`, `2d ago` (and `1w ago` / `4mo ago` with {@link TimeAgoOptions.extended}).
 *
 * Accepts an ISO string, an epoch-millisecond number, or a Date. Always measures
 * against "now" (reads the wall clock internally, like the call sites it replaces).
 */
export function formatTimeAgo(input: string | number | Date, options: TimeAgoOptions = {}): string {
  const justNow = options.justNow ?? 'just now';
  const then = input instanceof Date ? input.getTime() : new Date(input).getTime();
  if (Number.isNaN(then)) return options.invalid ?? justNow;

  const seconds = Math.floor((Date.now() - then) / 1000);
  if (options.seconds) {
    if (seconds < 5) return justNow;
    if (seconds < 60) return `${seconds}s ago`;
  } else if (seconds < 60) {
    return justNow;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (!options.extended || days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
