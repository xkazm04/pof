/**
 * Re-Scan reconciliation — the pure core of "did my fixes land?".
 *
 * A module scan is a record (`module_scans`) of which passes ran and what they
 * found. `reconcileScan` compares that latest scan against the findings that
 * were still unresolved before it:
 *
 *   - persisting   — an earlier finding the latest scan still reports
 *   - cleared      — an earlier finding whose pass RAN and no longer reports it
 *   - notRescanned — an earlier finding whose pass did NOT run: a pass that did
 *                    not run clears nothing
 *   - new          — a latest finding that matches no earlier one
 *
 * Matching is deterministic and deliberately forgiving of LLM rewording: the
 * same pass and the same normalized file, plus the same normalized category OR
 * the same normalized description. It is many-to-many: an issue reported (and
 * never resolved) in several earlier scans persists — or clears — as a group,
 * so a stale duplicate can never be left behind as a false "cleared".
 */

export interface ReconcilableFinding {
  pass: string;
  file: string | null;
  category: string;
  description: string;
}

export interface ReconcileLatest<L extends ReconcilableFinding> {
  /** Every pass the latest scan covered — including passes that found nothing. */
  passes: readonly string[];
  findings: L[];
}

export interface ReconcileResult<P, L> {
  new: L[];
  persisting: P[];
  cleared: P[];
  notRescanned: P[];
}

/** Lower-case, trimmed, whitespace-collapsed text. */
export function normalizeText(s: string | null | undefined): string {
  return (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** A path compared as text: separators unified, a leading `./` dropped. */
export function normalizeFile(file: string | null | undefined): string {
  return normalizeText(file).replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\.\//, '');
}

export function findingsMatch(a: ReconcilableFinding, b: ReconcilableFinding): boolean {
  if (a.pass !== b.pass) return false;
  if (normalizeFile(a.file) !== normalizeFile(b.file)) return false;
  return normalizeText(a.category) === normalizeText(b.category)
    || normalizeText(a.description) === normalizeText(b.description);
}

export function reconcileScan<P extends ReconcilableFinding, L extends ReconcilableFinding>(
  prior: readonly P[],
  latest: ReconcileLatest<L>,
): ReconcileResult<P, L> {
  const ran = new Set(latest.passes);
  const matchedLatest = new Set<number>();
  const result: ReconcileResult<P, L> = { new: [], persisting: [], cleared: [], notRescanned: [] };

  for (const p of prior) {
    if (!ran.has(p.pass)) {
      result.notRescanned.push(p);
      continue;
    }
    let seen = false;
    latest.findings.forEach((l, i) => {
      if (findingsMatch(p, l)) {
        seen = true;
        matchedLatest.add(i);
      }
    });
    (seen ? result.persisting : result.cleared).push(p);
  }

  latest.findings.forEach((l, i) => {
    if (!matchedLatest.has(i)) result.new.push(l);
  });
  return result;
}
