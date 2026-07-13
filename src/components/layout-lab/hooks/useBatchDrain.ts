'use client';

import { useCallback, useRef, useState } from 'react';
import { UI_TIMEOUTS } from '@/lib/constants';
import { invalidateArtifacts } from '../labArtifactCache';
import { drainEntityGates } from '../labArtifactClient';
import { emptyBatchSummary, foldEntityOutcome, type BatchDrainSummary } from '../batchDrainModel';

export interface BatchEntity { id: string; name: string }

export interface BatchDrainState {
  running: boolean;
  /** The entity currently being drained (for the live grid highlight), or null. */
  currentEntityId: string | null;
  /** Entities whose drain has completed this run. */
  doneEntityIds: Set<string>;
  /** Running (and, at the end, final) summary of flips. Null before a run starts. */
  summary: BatchDrainSummary | null;
  /** Total entities queued this run. */
  total: number;
}

const IDLE: BatchDrainState = { running: false, currentEntityId: null, doneEntityIds: new Set(), summary: null, total: 0 };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Serial batch drain of every entity with deferred gates in a catalog. The UE runner
 * is single-lease (one `catalogId|entityId` at a time), so entities are drained ONE AT
 * A TIME — never in parallel. Behaviour:
 *
 * - On HTTP 409 (another session holds the lease) it waits `retryDelayMs` and retries
 *   once; if still locked it skips the entity and records it (`entitiesLocked`) — no
 *   silent skip.
 * - The shared artifact cache is invalidated per entity as its result lands, so the
 *   grid refetches and updates live (the catalog-wide key is staled too).
 * - Cancellable: `cancel()` stops the loop AFTER the in-flight entity completes (its
 *   result is still folded in), never mid-request.
 */
export function useBatchDrain(catalogId: string, retryDelayMs: number = UI_TIMEOUTS.nextTaskDelay) {
  const [state, setState] = useState<BatchDrainState>(IDLE);
  const cancelRef = useRef(false);
  const runningRef = useRef(false);

  const cancel = useCallback(() => { cancelRef.current = true; }, []);

  const start = useCallback(async (entities: BatchEntity[]) => {
    if (runningRef.current || entities.length === 0) return;
    runningRef.current = true;
    cancelRef.current = false;

    const acc = emptyBatchSummary();
    const done = new Set<string>();
    setState({ running: true, currentEntityId: null, doneEntityIds: new Set(), summary: emptyBatchSummary(), total: entities.length });

    for (const e of entities) {
      if (cancelRef.current) break;
      setState((s) => ({ ...s, currentEntityId: e.id }));

      let outcome = await drainEntityGates(catalogId, e.id);
      if (outcome.kind === 'locked' && !cancelRef.current) {
        await sleep(retryDelayMs);
        if (!cancelRef.current) outcome = await drainEntityGates(catalogId, e.id);
      }

      foldEntityOutcome(acc, e.id, e.name, outcome);
      invalidateArtifacts(catalogId, e.id); // grid refetches this entity (and the catalog-wide view) live
      done.add(e.id);
      // Fresh Set + summary references so subscribers re-render on each landed result.
      setState((s) => ({ ...s, currentEntityId: null, doneEntityIds: new Set(done), summary: { ...acc, fails: [...acc.fails] } }));
    }

    runningRef.current = false;
    setState((s) => ({ ...s, running: false, currentEntityId: null }));
  }, [catalogId, retryDelayMs]);

  const reset = useCallback(() => { if (!runningRef.current) setState(IDLE); }, []);

  return { state, start, cancel, reset };
}
