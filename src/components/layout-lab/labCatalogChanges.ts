'use client';

import { tryApiFetch } from '@/lib/api-utils';
import type { Result } from '@/types/result';
import type { CatalogChanges, CatalogChangeRow } from '@/app/api/pipeline-artifacts/changes/route';
import type { AcceptanceStatus } from '@/lib/catalog/acceptance/types';
import type { WorkQueue } from './workQueue';

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

/**
 * How a row's verdict moved, read ONLY from the verdict the store archived (`priorStatus`).
 * `regressed` = was pass, is not; `improved` = was not pass, is; `sideways` = neither passed
 * but the verdict changed. No archived verdict → `unknown`: the store holds no "before", so
 * the digest never assumes one — and the classification never changes a grade.
 */
export type VerdictShift = 'regressed' | 'improved' | 'same' | 'sideways' | 'unknown';

export function verdictShift(row: { priorStatus?: AcceptanceStatus; status: AcceptanceStatus }): VerdictShift {
  const was = row.priorStatus;
  if (was === undefined) return 'unknown';
  if (was === row.status) return 'same';
  if (was === 'pass') return 'regressed';
  return row.status === 'pass' ? 'improved' : 'sideways';
}

/** Rank class: what stopped passing leads, what is unknown trails. */
const SHIFT_RANK: Record<VerdictShift, number> = { regressed: 0, improved: 1, sideways: 2, same: 2, unknown: 3 };

/** Rows by shift class, then newest write first within a class. Never mutates its input. */
export function rankChanges(rows: readonly CatalogChangeRow[]): CatalogChangeRow[] {
  return rows
    .map((row, i) => ({ row, i, rank: SHIFT_RANK[verdictShift(row)] }))
    .sort((a, b) => a.rank - b.rank
      || (b.row.updatedAt < a.row.updatedAt ? -1 : b.row.updatedAt > a.row.updatedAt ? 1 : a.i - b.i))
    .map((x) => x.row);
}

/** A row's shift in words + a glyph (never hue alone). */
export function describeShift(row: CatalogChangeRow): { shift: VerdictShift; glyph: string; text: string } {
  const shift = verdictShift(row);
  const was = row.priorStatus;
  switch (shift) {
    case 'regressed': return { shift, glyph: '▼', text: `stopped passing: was ${was}, now ${row.status}` };
    case 'improved': return { shift, glyph: '▲', text: `now passes: was ${was}, now ${row.status}` };
    case 'sideways': return { shift, glyph: '↔', text: `was ${was}, now ${row.status}` };
    case 'same': return { shift, glyph: '=', text: `still ${row.status}` };
    default: return { shift, glyph: '?', text: `now ${row.status} (the verdict before is not on record)` };
  }
}

/** The one-line headline: how much moved, what stopped passing / now passes, and against what baseline. */
export function describeChanges(changes: CatalogChanges): string {
  const n = changes.rows.length;
  if (n === 0) return `Nothing moved since ${describeSince(changes.since)}.`;
  const moved = `${n} step${n === 1 ? '' : 's'} moved since ${describeSince(changes.since)}`;
  const shifts = changes.rows.map(verdictShift);
  const regressed = shifts.filter((s) => s === 'regressed').length;
  const improved = shifts.filter((s) => s === 'improved').length;
  const lead = [
    regressed > 0 ? `${regressed} stopped passing` : '',
    improved > 0 ? `${improved} now pass${improved === 1 ? 'es' : ''}` : '',
  ].filter(Boolean).join(' · ');
  return lead ? `${lead} — ${moved}.` : `${moved}.`;
}

/** entityId + step label → that entity's OWN step index (-1 when it has no such step or is not on the board). */
export type StepIndexOf = (entityId: string, step: string) => number;

/** Resolve jumps through the board's rows (`MatrixRow.stepIndex`), the same list the rail indexes. */
export function stepIndexResolver(rows: readonly { id: string; stepIndex: (s: string) => number }[]): StepIndexOf {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return (entityId, step) => byId.get(entityId)?.stepIndex(step) ?? -1;
}

/**
 * The steps that stopped passing, as a work queue walked with Next / Prev. Each stop carries the
 * entity's OWN step index; a row whose step that entity does not have is skipped, never guessed.
 */
export function regressionQueue(
  changes: CatalogChanges,
  stepIndexOf: StepIndexOf,
  nameOf: (entityId: string) => string | undefined,
): WorkQueue {
  const items = rankChanges(changes.rows)
    .filter((r) => verdictShift(r) === 'regressed')
    .map((r) => ({ entityId: r.entityId, entityName: nameOf(r.entityId) ?? r.entityId, step: r.step, stepIndex: stepIndexOf(r.entityId, r.step) }))
    .filter((i) => i.stepIndex >= 0);
  return { catalogId: changes.catalogId, label: 'stopped passing', items, cursor: 0 };
}
