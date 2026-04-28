/**
 * Canonical severity vocabulary
 * ─────────────────────────────
 *
 * Multiple subsystems (crash analyzer, codebase archeologist, asset oracle,
 * performance profiler, evaluator, GDD compliance, etc.) historically grew
 * their own severity scales (`major/minor/info`, `error/warning/info`,
 * `critical/high/medium/low`, `critical/warning/info/positive`, etc.). This
 * module declares the canonical vocabulary used at the UI / presentation
 * boundary so that downstream views can pick a single colour, icon, and
 * a11y-label per severity without reading 4+ legacy union types.
 *
 * Per-subsystem unions remain valid for engine-internal use (and especially
 * where DB enums are persisted — see crash-severity TEXT columns) but should
 * be mapped to `Severity` before crossing into UI props.
 *
 * Refs: harness ui-perfectionist 21.1, 22.1.
 */

export type Severity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'info'
  | 'positive';

/** Numeric rank for default sort order (highest = most urgent). */
export const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
  positive: 0,
} as const;

/**
 * Map any legacy severity-like string into the canonical vocabulary. Returns
 * `'medium'` as the safe-default for anything we don't recognise — never
 * throws, since this often runs on stored data we can't refuse.
 *
 * Coverage:
 *   - crash-analyzer:        critical | high | medium | low                    (passthrough)
 *   - codebase-archeologist: critical | warning | info                         (warning → high)
 *   - asset-code-oracle:     error | warning | info                            (error → high, warning → medium)
 *   - gdd-compliance:        critical | major | minor | info                   (major → high, minor → medium)
 *   - insight-generator:     critical | warning | info | positive              (warning → high)
 *   - performance:           critical | high | medium | low                    (passthrough)
 */
export function legacyToCanonical(input: string | null | undefined): Severity {
  if (!input) return 'medium';
  const v = input.toLowerCase();
  switch (v) {
    case 'critical':
    case 'high':
    case 'medium':
    case 'low':
    case 'info':
    case 'positive':
      return v as Severity;
    case 'error':
      return 'high';
    case 'warning':
      return 'medium';
    case 'major':
      return 'high';
    case 'minor':
      return 'medium';
    case 'fatal':
      return 'critical';
    default:
      return 'medium';
  }
}

/** Convenience comparator suitable for `.sort()` (descending — most urgent first). */
export function compareSeverityDesc(a: Severity, b: Severity): number {
  return SEVERITY_RANK[b] - SEVERITY_RANK[a];
}
