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
 * Format a millisecond duration as `500ms`, `1.5s`, or `2m 5s`.
 * Sub-second → `ms`, sub-minute → one-decimal seconds, otherwise minutes+seconds.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}
