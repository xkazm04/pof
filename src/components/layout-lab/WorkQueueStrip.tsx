'use client';

import { useCallback, useState } from 'react';
import { queueNext, queuePrev, reconcileQueue, type WorkQueue } from './workQueue';
import { Button } from './ui/Button';

/** Opens one queue stop: the shell's matrix jump (navigate + surface the canvas). */
type OpenStop = (catalogId: string, entityId: string, stepIndex: number) => void;

export interface LabWorkQueue {
  queue: WorkQueue | null;
  open: (queue: WorkQueue) => void;
  next: () => void;
  prev: () => void;
  exit: () => void;
}

/**
 * The shell's ONE live work queue (session state — never persisted to prefs). Every stop opens
 * through `openStop`, the same navigation a matrix cell uses. The queue re-anchors on the lab's
 * location during render (the adjust-state-during-render bail-out LayoutLab already uses): on a
 * queued entity the cursor follows it; a tree / search / coach jump anywhere else ends it.
 */
export function useLabWorkQueue(catalogId: string, entityId: string | null, openStop: OpenStop): LabWorkQueue {
  const [queue, setQueue] = useState<WorkQueue | null>(null);
  if (queue) {
    const reconciled = reconcileQueue(queue, { catalogId, entityId });
    if (reconciled !== queue) setQueue(reconciled);
  }
  const go = useCallback((q: WorkQueue) => {
    const item = q.items[q.cursor];
    setQueue(q);
    openStop(q.catalogId, item.entityId, item.stepIndex);
  }, [openStop]);
  const open = useCallback((q: WorkQueue) => { if (q.items.length > 0) go({ ...q, cursor: 0 }); }, [go]);
  const next = useCallback(() => {
    if (!queue) return;
    const a = queueNext(queue);
    if (a.done) setQueue(null); // Finish: the last stop is worked — the queue is over.
    else go(a.queue);
  }, [queue, go]);
  const prev = useCallback(() => {
    const p = queue ? queuePrev(queue) : null;
    if (p) go(p.queue);
  }, [queue, go]);
  const exit = useCallback(() => setQueue(null), []);
  return { queue, open, next, prev, exit };
}

/**
 * Strip above the canvas while a Matrix work queue is active: what the queue is, the current
 * stop, `k of N`, and Prev / Next / Exit. Next on the last stop reads Finish and ends the queue.
 */
export function WorkQueueStrip({ q }: { q: LabWorkQueue }) {
  const { queue } = q;
  if (!queue) return null;
  const item = queue.items[queue.cursor];
  const last = queue.cursor === queue.items.length - 1;
  return (
    <div data-testid="work-queue-strip" role="region" aria-label="Work queue"
      style={{
        flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 'var(--lab-s2)', flexWrap: 'wrap',
        padding: 'var(--lab-s2) var(--lab-s4)', background: 'var(--lab-accent-bg)',
        borderBottom: '1px solid var(--lab-line)', fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-text)',
      }}>
      <span style={{ fontFamily: 'var(--lab-font-mono)', color: 'var(--lab-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        Queue · <span style={{ color: 'var(--lab-ink)' }}>{queue.label}</span>
      </span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--lab-ink-deep)', fontWeight: 600 }}>
        {item.entityName} — {item.step}
      </span>
      <span data-testid="work-queue-position" aria-live="polite" style={{ fontFamily: 'var(--lab-font-mono)', fontWeight: 600 }}>
        {`${queue.cursor + 1} of ${queue.items.length}`}
      </span>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--lab-s2)' }}>
        <Button mono onClick={q.prev} disabled={queue.cursor === 0} data-testid="work-queue-prev" ariaLabel="Previous in queue">‹ Prev</Button>
        <Button mono variant="accent" onClick={q.next} data-testid="work-queue-next" ariaLabel={last ? 'Finish the queue' : 'Next in queue'}>
          {last ? 'Finish' : 'Next ›'}
        </Button>
        <Button mono onClick={q.exit} data-testid="work-queue-exit">Exit</Button>
      </span>
    </div>
  );
}
