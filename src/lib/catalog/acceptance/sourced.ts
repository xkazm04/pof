/**
 * SOURCED — a step artifact seeded from a reference source instead of produced (/diablo D3).
 *
 * The operator decided a seeded step is a distinct state and never `pass`: matching the reference is
 * the one thing a seeded value cannot prove about itself (registry: reference-parity-gating — the
 * producer never hands the gate a number). So the step's own checker still runs — a seeded value that
 * FAILS it is a real defect and stays `fail` — but a would-be `pass` is held at `pending` with a
 * greppable `SOURCED:` reason naming the source row. Parity with the reference is measured separately.
 *
 * Applied once, at pipeline registration, so every grading path (server grade, lab banner, rollup,
 * coach) reads the same guarded checker.
 */
import { SOURCED_MARKER } from './markers';
import type { AcceptanceResult, Checker } from './types';

/**
 * The artifact field that carries the stamp. PROVENANCE, not graded content: only the registration
 * guard reads it (the spec linter's content-read probe exempts it by this constant).
 */
export const SOURCED_FIELD = 'sourced';

/** What a seeded artifact carries in `data.sourced`. */
export interface SourcedStamp {
  sourceGame: string;
  sourceFile: string;
  sourceRow: string;
  /** Which source columns this step's data came from. */
  columns: string[];
}

export function sourcedStampOf(data: Record<string, unknown> | undefined): SourcedStamp | null {
  const s = data?.[SOURCED_FIELD] as Partial<SourcedStamp> | undefined;
  return s && typeof s.sourceGame === 'string' && typeof s.sourceRow === 'string' ? (s as SourcedStamp) : null;
}

export function heldAsSourced(result: AcceptanceResult, stamp: SourcedStamp): AcceptanceResult {
  return {
    ...result,
    status: 'pending',
    reason: `${SOURCED_MARKER}: seeded from ${stamp.sourceGame} ${stamp.sourceFile} (${stamp.sourceRow}; `
      + `columns ${stamp.columns.join(', ') || 'n/a'}) — not produced. Its checker passes the shape, but a seeded `
      + `step is never graded pass; parity with the reference is a separate measurement.`,
  };
}

/** Wrap a step checker so a seeded artifact can never grade `pass`. Hidden checker tags are preserved. */
export function sourcedGuard(checker: Checker): Checker {
  const wrapped: Checker = (data, ctx) => {
    const result = checker(data, ctx);
    const stamp = result.status === 'pass' ? sourcedStampOf(data) : null;
    return stamp ? heldAsSourced(result, stamp) : result;
  };
  // Carry the symbol tags (content-invariant, canon-law) that callers introspect on the checker.
  for (const sym of Object.getOwnPropertySymbols(checker)) {
    Object.defineProperty(wrapped, sym, { value: (checker as unknown as Record<symbol, unknown>)[sym], enumerable: false });
  }
  return wrapped;
}
