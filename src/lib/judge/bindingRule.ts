/**
 * The one rule for "does this verdict still speak for the content on record?" (pure).
 *
 * It used to exist three times: judge provenance (`verdictProvenance`), craft staleness
 * (`staleBecause`) and the re-judge skip (`judgeSkipDecision`), plus two copies of the trend
 * predicate "same content as the previous point". A hash-scheme bump or a new fallback now
 * changes this file only. Each caller keeps its own vocabulary on top (superseded rubrics,
 * message wording, skip reasons) and maps the three states.
 *
 *  - `current` - both sides carry a hash of the CURRENT scheme and they are equal.
 *  - `stale`   - the hashes differ, or (timestamp rule) the content was written after the verdict.
 *  - `unknown` - nothing can prove either way (superseded scheme, no hash, no usable timestamps).
 *                NEVER passed off as `current`.
 *
 * Per-caller timestamp policy (`timestampFallback`), pinned to what each caller did before:
 *  - `hashless` (judge provenance, default): the timestamp rule applies only to a verdict that
 *    records NO hash. A recorded hash that cannot be compared is `unknown`, never `stale`.
 *  - `unprovable` (craft): the timestamp rule applies whenever the hash comparison cannot be
 *    made on either side (legacy gauge, superseded scheme, or an artifact with no provable hash).
 *  - `none` (re-judge skip): never on timestamp; the binding is the hash and nothing else.
 */
import { CONTENT_HASH_SCHEME, hashScheme, isComparableHash } from './contentHash';

export type BindingState = 'current' | 'stale' | 'unknown';
/** What decided the state - lets a caller word its own message. */
export type BindingBasis = 'hash' | 'timestamp' | 'scheme' | 'unbound' | 'unprovable';

export interface BindingResult {
  state: BindingState;
  basis: BindingBasis;
  reason: string;
}

export interface BindingInput {
  recordedHash?: string | null;
  recordedAt?: string | null;
  currentHash?: string | null;
  currentUpdatedAt?: string | null;
  timestampFallback?: 'hashless' | 'unprovable' | 'none';
}

/** Tolerant timestamp parse: SQLite "YYYY-MM-DD HH:MM:SS" (UTC) and ISO both appear. NaN = unknown. */
export function bindingTs(v: string | null | undefined): number {
  if (!v) return NaN;
  const s = v.includes('T') || /[Zz]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v.replace(' ', 'T')}Z`;
  return Date.parse(s);
}

function writtenAfter(recordedAt: string | null | undefined, updatedAt: string | null | undefined): boolean {
  const judged = bindingTs(recordedAt);
  const written = bindingTs(updatedAt);
  return !Number.isNaN(judged) && !Number.isNaN(written) && judged < written;
}

export function classifyBinding(input: BindingInput): BindingResult {
  const mode = input.timestampFallback ?? 'hashless';
  const recorded = input.recordedHash || undefined;
  const current = input.currentHash || undefined;

  const timestampRule = (fallbackReason: string, fallbackBasis: BindingBasis): BindingResult =>
    writtenAfter(input.recordedAt, input.currentUpdatedAt)
      ? { state: 'stale', basis: 'timestamp', reason: 'artifact rewritten since the verdict and no content binding proves it unchanged' }
      : { state: 'unknown', basis: fallbackBasis, reason: fallbackReason };

  if (recorded && !isComparableHash(recorded)) {
    const reason = `content binding recorded under hash scheme ${hashScheme(recorded) ?? 'unknown'}, superseded by ${CONTENT_HASH_SCHEME}`;
    return mode === 'unprovable' ? timestampRule(reason, 'scheme') : { state: 'unknown', basis: 'scheme', reason };
  }
  if (recorded) {
    const currentOk = mode === 'unprovable' ? isComparableHash(current) : Boolean(current);
    if (currentOk) {
      return recorded === current
        ? { state: 'current', basis: 'hash', reason: 'content hash matches the verdict' }
        : { state: 'stale', basis: 'hash', reason: 'content changed since the verdict was recorded' };
    }
    const reason = 'the current content hash could not be proven';
    return mode === 'unprovable' ? timestampRule(reason, 'unprovable') : { state: 'unknown', basis: 'unprovable', reason };
  }
  const reason = 'it records no content binding';
  return mode === 'none' ? { state: 'unknown', basis: 'unbound', reason } : timestampRule(reason, 'unbound');
}

/**
 * "Did this point read the SAME content as the previous one?" for the trend builders.
 * Both hashes -> equality. Exactly one hash -> false (an unbound point must not imply the content
 * stood still). Neither hash -> the optional anchor (craft's `artifactUpdatedAt`) when both carry
 * one, else false. Only a REAL comparison yields true.
 */
export function sameContent(
  prev: { contentHash?: string | null; anchor?: string | null },
  next: { contentHash?: string | null; anchor?: string | null },
): boolean {
  if (prev.contentHash && next.contentHash) return prev.contentHash === next.contentHash;
  if (prev.contentHash || next.contentHash) return false;
  return Boolean(prev.anchor && next.anchor && prev.anchor === next.anchor);
}
