/**
 * Shared formatters for the spend dashboard — dollars and token counts.
 *
 * Cost figures are often fractions of a cent, so {@link formatUsd} widens the
 * decimal precision as the magnitude shrinks instead of collapsing tiny costs to
 * `$0.00`. Keep this the single source of truth so every spend surface (meters,
 * tables, the pre-flight dialog) renders money and tokens identically.
 */

/** Format a USD amount, widening precision only for sub-cent costs. */
export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0.00';
  const abs = Math.abs(n);
  if (abs === 0) return '$0.00';
  // Sub-cent costs (e.g. per-token fractions) keep 4 decimals so they don't
  // collapse to $0.00; everything else uses standard 2-decimal money.
  if (abs < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

/** Format a token count as `940`, `12.3k`, or `4.50M`. */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 1000) return `${Math.round(n)}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
