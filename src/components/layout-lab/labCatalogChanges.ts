'use client';

import { tryApiFetch } from '@/lib/api-utils';
import type { Result } from '@/types/result';
import type { CatalogChanges, CatalogChangeRow } from '@/app/api/pipeline-artifacts/changes/route';

export type { CatalogChanges, CatalogChangeRow };

/**
 * Read what MOVED in one catalog since a moment — the client half of the changed-since
 * digest. Same `Result` discipline as the other lab reads: a failed GET is not "nothing
 * moved", and the digest says which of the two it is.
 */
export async function fetchCatalogChanges(catalogId: string, since: string): Promise<Result<CatalogChanges, string>> {
  const q = new URLSearchParams({ catalogId, since });
  const r = await tryApiFetch<CatalogChanges>(`/api/pipeline-artifacts/changes?${q.toString()}`);
  return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error };
}

/**
 * An absolute, local rendering of the baseline moment. Absolute rather than relative ("2
 * hours ago") on purpose: a relative label needs the clock DURING RENDER, which React 19
 * purity forbids, and it would silently go stale on a page left open — the exact failure this
 * digest exists to expose.
 */
export function describeSince(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso; // never invent a date we cannot parse
  return new Date(ms).toLocaleString();
}

/**
 * What ONE row is entitled to claim, from what the store actually recorded.
 *
 * A version is archived only when a write CHANGED the content, so `revisionsSince > 0` is
 * proof of content change and its count is how many times. Zero is NOT proof of nothing: the
 * row was written, and a verdict-only write (a drain, a verify pass) or a step's very first
 * write archives nothing at all. The wording keeps those apart instead of flattening both
 * into "changed".
 */
export function describeChangeRow(row: CatalogChangeRow, cap: number): string {
  if (row.revisionsSince === 0) {
    return 'written since — nothing was archived, so this was a verdict-only write or its first version';
  }
  const n = row.revisionsSince;
  const base = `content changed — ${n} version${n === 1 ? '' : 's'} archived since`;
  // The blind spot, stated on the row it applies to: the history is bounded, so the count is
  // a floor. Under-reporting silently would defeat the entire point of this digest.
  return row.historyTruncated
    ? `${base} (at least — this step's history is capped at ${cap} versions, so older ones are gone)`
    : base;
}

/** The one-line headline: how much moved, and against what baseline. */
export function describeChanges(changes: CatalogChanges): string {
  const n = changes.rows.length;
  if (n === 0) return `Nothing moved since ${describeSince(changes.since)}.`;
  return `${n} step${n === 1 ? '' : 's'} moved since ${describeSince(changes.since)}.`;
}
