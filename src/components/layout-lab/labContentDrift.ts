import { stepContentHash } from '@/lib/judge/contentHash';

/**
 * CONTENT comparison between a local lab artifact and the server's persisted row.
 *
 * Drift used to be status-only, so the divergence that matters most in practice was
 * invisible: another session (or the MCP submit path) rewrites a step's `data` and the
 * checker still grades it `pass` — same verdict, different content, no signal anywhere.
 * This is the fingerprint the lab compares.
 *
 * Two classes of key are excluded, because they are BOOKKEEPING rather than produced content
 * and comparing them would make every step read as drifted forever:
 *  - `genHistory` — the gallery's kept re-roll log. Already excluded by
 *    {@link stepContentHash} (see `@/lib/judge/contentHash`), and deliberately preserved
 *    across an adopt, so local and server legitimately differ there.
 *  - `_provenance` — stamped SERVER-SIDE onto every persisted artifact by the
 *    `/api/pipeline-artifacts` POST route (`stampPromptVersion`). The row that comes back
 *    therefore always carries a key the local artifact never had; without stripping it,
 *    EVERY produced step would report content drift the moment it was compared.
 */
const SERVER_STAMP_KEYS = ['_provenance'] as const;

/** Strip the server's own bookkeeping stamp (never the produced payload). */
function withoutServerStamp(data: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!data) return {};
  let out: Record<string, unknown> | null = null;
  for (const k of SERVER_STAMP_KEYS) {
    if (k in data) { out = out ?? { ...data }; delete out[k]; }
  }
  return out ?? data;
}

/**
 * A stable fingerprint of what a step actually holds: its produced `data` (minus the
 * bookkeeping above) plus its UE asset list, order-normalized so a reordered manifest is
 * not reported as a change.
 */
export function labContentHash(data: Record<string, unknown> | undefined, ueAssets: string[] | undefined): string {
  return `${stepContentHash(withoutServerStamp(data))}|${JSON.stringify([...(ueAssets ?? [])].sort())}`;
}

/** True when the two sides hold genuinely different content (see {@link labContentHash}). */
export function contentDiverges(
  a: { data?: Record<string, unknown>; ueAssets?: string[] },
  b: { data?: Record<string, unknown>; ueAssets?: string[] },
): boolean {
  return labContentHash(a.data, a.ueAssets) !== labContentHash(b.data, b.ueAssets);
}
