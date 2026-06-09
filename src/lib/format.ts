/**
 * Shared human-readable formatters for byte sizes and durations.
 *
 * These consolidate the byte/duration helpers that were copy-pasted across the
 * packaging surfaces (size budgets, build history, build comparison, size-trend
 * chart) and the GDD synthesizer. Keep this the single source of truth so a
 * rounding/unit change lands everywhere at once.
 */

export interface FormatBytesOptions {
  /**
   * Select the unit tier by magnitude (|bytes|) instead of the raw value, so a
   * negative size (e.g. a build-size delta) still renders as KB/MB/GB rather
   * than collapsing into the bytes tier. Preserves the size-budgets behavior.
   */
  signed?: boolean;
}

/**
 * Format a byte count as `B`/`KB`/`MB`/`GB` with a leading space:
 * `512 B`, `1.5 KB`, `1.0 MB`, `2.34 GB`.
 *
 * KB/MB use one decimal, GB uses two. The numeric value is always the signed
 * input; only tier selection respects {@link FormatBytesOptions.signed}.
 */
export function formatBytes(bytes: number, options: FormatBytesOptions = {}): string {
  const tier = options.signed ? Math.abs(bytes) : bytes;
  if (tier < 1024) return `${bytes} B`;
  if (tier < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (tier < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * Format a millisecond duration as `500ms`, `1.5s`, `2m 5s`, or `1h 1m`.
 *
 * Sub-second → `ms`, sub-minute → one-decimal seconds, sub-hour → minutes+seconds,
 * an hour or more → hours+minutes. The single source of truth for every duration
 * string in the app — build/eval timings (seconds-to-minutes) and long-running
 * "time invested" totals (minutes-to-hours) both render through here so the same
 * elapsed time looks identical in every panel.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) {
    const mins = Math.floor(ms / 60_000);
    const secs = Math.round((ms % 60_000) / 1000);
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.round((ms % 3_600_000) / 60_000);
  return `${hours}h ${mins}m`;
}

/**
 * Format the elapsed time between two ISO timestamps, e.g. a batch's start and
 * end. A null `endIso` measures up to now (for an in-progress span). Delegates to
 * {@link formatDuration} so an interval renders the same as any other duration.
 */
export function formatDurationBetween(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  return formatDuration(Math.max(0, end - start));
}
