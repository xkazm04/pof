/**
 * scan-sweep --challenge catalog-browser-ui/B — the Matrix work queue: the filtered set becomes
 * a list of (entity, step) items walked with Next/Prev from the canvas, without wrap, and a jump
 * outside the queue ends it.
 */
import { describe, it, expect } from 'vitest';
import type { MatrixRow } from '@/components/layout-lab/matrixRows';
import type { StepDisplayStatus } from '@/components/layout-lab/hooks/useEntityArtifacts';
import type { CoachPriority } from '@/components/layout-lab/coachLadder';
import { buildWorkQueue, queueNext, queuePrev, reconcileQueue } from '@/components/layout-lab/workQueue';

/** Rows own different step lists (a profile-scoped step shifts later indices). */
function row(id: string, own: string[], issue: { step: string; priority: CoachPriority } | null, cells: Record<string, StepDisplayStatus> = {}): MatrixRow {
  return {
    id, name: `Name ${id}`,
    statusByStep: (s) => cells[s] ?? 'pass',
    applies: (s) => own.includes(s),
    stepIndex: (s) => own.indexOf(s),
    rollup: { done: 0, total: own.length, configComplete: false, deferred: 0 } as MatrixRow['rollup'],
    blockers: [],
    issue: issue ? { ...issue, index: own.indexOf(issue.step) } : null,
  };
}

const FULL = ['Brief', 'Sprite Render', 'Stats', 'Test Gate'];
const SCOPED = ['Brief', 'Stats', 'Test Gate'];
const rows = [
  row('r1', FULL, { step: 'Stats', priority: 'deferred' }, { 'Test Gate': 'deferred', Stats: 'deferred' }),
  row('r2', SCOPED, { step: 'Test Gate', priority: 'deferred' }, { 'Test Gate': 'deferred' }),
  row('r3', FULL, { step: 'Brief', priority: 'deferred' }, { Brief: 'deferred', 'Test Gate': 'deferred' }),
];

describe('buildWorkQueue', () => {
  it('a rung predicate queues each row at its own ladder step; a column predicate at the column, indexed per row', () => {
    const rung = buildWorkQueue(rows, { kind: 'rung', rung: 'deferred' }, 'bestiary');
    expect(rung.catalogId).toBe('bestiary');
    expect(rung.cursor).toBe(0);
    expect(rung.items.map(({ entityId, step, stepIndex }) => ({ entityId, step, stepIndex }))).toEqual([
      { entityId: 'r1', step: 'Stats', stepIndex: 2 },
      { entityId: 'r2', step: 'Test Gate', stepIndex: 2 },
      { entityId: 'r3', step: 'Brief', stepIndex: 0 },
    ]);
    const col = buildWorkQueue(rows, { kind: 'column', step: 'Test Gate', status: 'deferred' }, 'bestiary');
    expect(col.items.map(({ entityId, step, stepIndex }) => ({ entityId, step, stepIndex }))).toEqual([
      { entityId: 'r1', step: 'Test Gate', stepIndex: 3 },
      { entityId: 'r2', step: 'Test Gate', stepIndex: 2 },
      { entityId: 'r3', step: 'Test Gate', stepIndex: 3 },
    ]);
  });

  it('Next at the last item is done with the cursor unchanged; Prev at 0 is null (no wrap)', () => {
    const q = buildWorkQueue(rows, { kind: 'rung', rung: 'deferred' }, 'bestiary');
    const n1 = queueNext(q);
    expect(n1.done).toBe(false);
    if (n1.done) return;
    expect(n1.queue.cursor).toBe(1);
    expect(n1.item.entityId).toBe('r2');
    const last = { ...q, cursor: 2 };
    const end = queueNext(last);
    expect(end.done).toBe(true);
    expect(end.queue.cursor).toBe(2);
    expect(queuePrev(q)).toBeNull();
    expect(queuePrev(last)?.queue.cursor).toBe(1);
    expect(queuePrev(last)?.item.entityId).toBe('r2');
  });
});

describe('reconcileQueue', () => {
  const q = buildWorkQueue(rows, { kind: 'rung', rung: 'deferred' }, 'bestiary');
  it('a location on item k moves the cursor to k; the same location keeps the same queue', () => {
    expect(reconcileQueue(q, { catalogId: 'bestiary', entityId: 'r3' })?.cursor).toBe(2);
    expect(reconcileQueue(q, { catalogId: 'bestiary', entityId: 'r1' })).toBe(q);
  });
  it('a location outside every item (a tree click elsewhere) clears the queue', () => {
    expect(reconcileQueue(q, { catalogId: 'bestiary', entityId: 'someone-else' })).toBeNull();
    expect(reconcileQueue(q, { catalogId: 'items', entityId: 'r1' })).toBeNull();
    expect(reconcileQueue(q, { catalogId: 'bestiary', entityId: null })).toBeNull();
  });
});
