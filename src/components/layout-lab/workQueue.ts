/**
 * Matrix work queue — the filtered board turned into a list of (entity, step) stops walked with
 * Next / Prev from the canvas, so working N entities is 2 clicks + (N-1) Next instead of a
 * Matrix round trip and a full-board re-scan per entity.
 *
 * Pure model; the shell (`LayoutLab` via `useLabWorkQueue`) owns the one live queue as session
 * state (never persisted). Each stop names its step by LABEL and carries that row's OWN index
 * (`row.stepIndex`, the rail's list — see `entityPipeline.ts`), never a catalog-wide position.
 */
import { matchesPredicate, predicateLabel, type TriagePredicate, type TriageRow } from './matrixTriage';

export interface WorkQueueItem {
  entityId: string;
  entityName: string;
  /** The step this stop opens, by label. */
  step: string;
  /** That step's index in THIS entity's own step list. */
  stepIndex: number;
}

export interface WorkQueue {
  catalogId: string;
  /** What the queue is (the predicate that built it): `deferred`, `Test Gate: deferred`. */
  label: string;
  items: WorkQueueItem[];
  /** The stop the canvas is on. */
  cursor: number;
}

/**
 * The queue a filtered board opens. A rung predicate stops at each row's own ladder step (its
 * `issue`); a column predicate stops at the column's step. A row with no such step is skipped.
 */
export function buildWorkQueue(rows: readonly TriageRow[], predicate: TriagePredicate, catalogId: string): WorkQueue {
  const items: WorkQueueItem[] = [];
  for (const r of rows) {
    if (!matchesPredicate(r, predicate)) continue;
    const step = predicate.kind === 'column' ? predicate.step : r.issue?.step;
    const stepIndex = step === undefined ? -1 : r.stepIndex(step);
    if (step !== undefined && stepIndex >= 0) items.push({ entityId: r.id, entityName: r.name, step, stepIndex });
  }
  return { catalogId, label: predicateLabel(predicate), items, cursor: 0 };
}

export type QueueAdvance =
  | { done: false; queue: WorkQueue; item: WorkQueueItem }
  | { done: true; queue: WorkQueue };

/** The next stop, or `done` at the last one (cursor unchanged — no wrap). */
export function queueNext(q: WorkQueue): QueueAdvance {
  const cursor = q.cursor + 1;
  if (cursor >= q.items.length) return { done: true, queue: q };
  return { done: false, queue: { ...q, cursor }, item: q.items[cursor] };
}

/** The previous stop, or `null` at the first one (no wrap). */
export function queuePrev(q: WorkQueue): { queue: WorkQueue; item: WorkQueueItem } | null {
  if (q.cursor <= 0) return null;
  const cursor = q.cursor - 1;
  return { queue: { ...q, cursor }, item: q.items[cursor] };
}

/**
 * Re-anchor the queue on where the lab actually is. On a queued entity (any step — working an
 * entity means moving along its rail) the cursor follows it; the SAME queue object comes back
 * when nothing moved, so a render-time reconcile settles. Anywhere else — a tree click, a search
 * or coach jump, a catalog switch — the queue is over: `null`.
 */
export function reconcileQueue(q: WorkQueue, loc: { catalogId: string; entityId: string | null }): WorkQueue | null {
  if (loc.catalogId !== q.catalogId || !loc.entityId) return null;
  const k = q.items.findIndex((i) => i.entityId === loc.entityId);
  if (k < 0) return null;
  return k === q.cursor ? q : { ...q, cursor: k };
}
