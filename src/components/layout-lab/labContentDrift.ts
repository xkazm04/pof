import { stepContentHash } from '@/lib/judge/contentHash';

/**
 * CONTENT comparison between a local lab artifact and the server's persisted row.
 *
 * Drift used to be status-only, so the divergence that matters most in practice was
 * invisible: another session (or the MCP submit path) rewrites a step's `data` and the
 * checker still grades it `pass` — same verdict, different content, no signal anywhere.
 * This is the fingerprint the lab compares.
 *
 * The bookkeeping keys that must NOT count as content (`genHistory`, `_provenance`) are excluded
 * by {@link stepContentHash} itself — ONE exclusion rule, shared with the judge write path and
 * the verdict bridge. This file used to keep a SECOND rule (a local `_provenance` strip), which
 * is exactly how the two sides drifted apart: drift saw no divergence while the verdict bridge
 * saw a hash mismatch on the same pair of artifacts, so a real judge failure was reported as
 * "re-produced since" and neither the drift banner nor `adoptServer` could correct it. There is
 * now nothing to strip here — do not reintroduce one.
 */

/**
 * A stable fingerprint of what a step actually holds: its produced `data` (minus the shared
 * bookkeeping exclusions) plus its UE asset list, order-normalized so a reordered manifest is
 * not reported as a change.
 */
export function labContentHash(data: Record<string, unknown> | undefined, ueAssets: string[] | undefined): string {
  return `${stepContentHash(data)}|${JSON.stringify([...(ueAssets ?? [])].sort())}`;
}

/** True when the two sides hold genuinely different content (see {@link labContentHash}). */
export function contentDiverges(
  a: { data?: Record<string, unknown>; ueAssets?: string[] },
  b: { data?: Record<string, unknown>; ueAssets?: string[] },
): boolean {
  return labContentHash(a.data, a.ueAssets) !== labContentHash(b.data, b.ueAssets);
}
