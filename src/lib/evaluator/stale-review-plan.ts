import { ok, err, type Result } from '@/types/result';
import type { BatchReviewState, ModuleReviewStatus } from '@/types/batch-review';

/**
 * Pure planning for a SCOPED feature review: which modules are stale, which of a
 * requested subset the batch route may run, and what each heatmap cell shows while
 * the one in-memory batch progresses. Shared by `/api/feature-matrix/batch-review`
 * (scope validation) and the Quality tab (stale set + per-cell state).
 */

const DAY_MS = 86_400_000;

/** A cell's review state inside the current batch. */
export type CellReviewState = 'queued' | 'reviewing' | 'reviewed' | 'failed';

/** Ids of modules never reviewed, or reviewed more than `staleDays` whole days before
 *  `now` — in the input (heatmap) order. An unparseable timestamp reads as never. */
export function selectStaleModuleIds(
  cells: ReadonlyArray<{ moduleId: string; lastReviewedAt: string | null }>,
  staleDays: number,
  now: number,
): string[] {
  return cells
    .filter(({ lastReviewedAt }) => {
      const t = lastReviewedAt ? Date.parse(lastReviewedAt) : NaN;
      if (Number.isNaN(t)) return true;
      return Math.floor((now - t) / DAY_MS) > staleDays;
    })
    .map((c) => c.moduleId);
}

/**
 * The modules a batch runs: `requested` undefined = all of them; otherwise a
 * non-empty string list, every id of which must be in `all` (requested order,
 * duplicates dropped). Any unknown id refuses the WHOLE request, naming it.
 */
export function resolveBatchModules<T extends { moduleId: string }>(
  all: readonly T[],
  requested: unknown,
): Result<T[], string> {
  if (requested === undefined) return ok([...all]);
  if (!Array.isArray(requested) || requested.some((id) => typeof id !== 'string')) {
    return err('moduleIds must be an array of module ids');
  }
  if (requested.length === 0) return err('moduleIds must name at least one module');
  const byId = new Map(all.map((m) => [m.moduleId, m]));
  const ids = [...new Set(requested as string[])];
  const unknown = ids.filter((id) => !byId.has(id));
  if (unknown.length > 0) {
    return err(`Unknown or undefined module id(s): ${unknown.join(', ')}`);
  }
  return ok(ids.map((id) => byId.get(id)!));
}

const STATE_OF: Partial<Record<ModuleReviewStatus, CellReviewState>> = {
  pending: 'queued',
  running: 'reviewing',
  completed: 'reviewed',
  error: 'failed',
};

/** What `moduleId`'s cell shows for `batch`: null when there is no batch, the module
 *  is not in it, it was skipped, or it is still pending in a batch that has ended
 *  (an aborted batch will never reach it — it is not queued any more). */
export function cellReviewState(
  batch: BatchReviewState | null,
  moduleId: string,
): CellReviewState | null {
  const mod = batch?.modules.find((m) => m.moduleId === moduleId);
  if (!batch || !mod) return null;
  if (mod.status === 'pending' && batch.status !== 'running') return null;
  return STATE_OF[mod.status] ?? null;
}
