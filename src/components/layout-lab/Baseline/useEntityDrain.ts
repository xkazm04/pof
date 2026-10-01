import { useState, useCallback } from 'react';
import { drainGates } from '@/components/layout-lab/labArtifactClient';
import { invalidateArtifacts } from '@/components/layout-lab/labArtifactCache';
import { useLabRunnerStore } from '@/components/layout-lab/labRunnerStore';
import { entityDrainOutcome, type EntityDrainOutcome } from '@/components/layout-lab/entityDrainOutcome';

/**
 * The per-entity coach drain ("Run N deferred gates"), extracted from `useBaseline`.
 *
 * Operator-triggered drain of the selected entity's deferred L3/L4 gates, then invalidate the
 * cache so the refreshed verdicts are re-read through the shared fetch path. Its OUTCOME is
 * kept (it used to be discarded): what ran, each failing gate's reason, the captured frames,
 * or the refusal/error reason — keyed by `${catalogId}/${entityId}` exactly like the draining
 * flag, so an outcome never renders on the wrong entity.
 */
export function useEntityDrain(catalogId: string | undefined, entityId: string | undefined, steps: readonly string[]) {
  // Drain state is keyed — NOT a single instance-scoped boolean — so switching entities
  // mid-drain neither blocks the new entity's drain nor attaches the "draining…" affordance
  // to the wrong entity (the `draining` flag reflects only the SELECTED entity). The live run is
  // the lab runner store's (run id = the drain key), so it also survives a Baseline remount.
  const [outcomes, setOutcomes] = useState<ReadonlyMap<string, EntityDrainOutcome>>(() => new Map());
  const drainKey = catalogId && entityId ? `${catalogId}/${entityId}` : null;
  const draining = useLabRunnerStore((s) => (drainKey ? s.runs[drainKey]?.phase === 'running' : false));
  const drainOutcome = drainKey ? outcomes.get(drainKey) ?? null : null;

  const recordOutcome = useCallback((key: string, outcome: EntityDrainOutcome | null) => {
    setOutcomes((prev) => {
      const next = new Map(prev);
      if (outcome) next.set(key, outcome); else next.delete(key);
      return next;
    });
  }, []);

  const runDrain = async () => {
    if (!catalogId || !entityId || !drainKey) return;
    const key = drainKey;
    // Publish this session's drain as a keyed run so the header chip shows "draining …" (and never
    // mistakes our own lease for another session's). Refused while this entity's drain is live.
    if (!useLabRunnerStore.getState().beginRun({ id: key, kind: 'entity', catalogId, entityIds: [entityId], scope: key })) return;
    // A new run replaces the last one's result — a stale outcome must not sit beside "Running…".
    recordOutcome(key, null);
    try {
      // drainGates never throws; a thrown stub is still reported, never swallowed.
      const response = await Promise.resolve().then(() => drainGates(catalogId, entityId))
        .catch((e: unknown) => ({ kind: 'error' as const, reason: e instanceof Error ? e.message : String(e) }));
      recordOutcome(key, entityDrainOutcome(steps, response));
      invalidateArtifacts(catalogId, entityId);
    } finally {
      // Ends THIS run only (keyed, so no ownership guard); its outcome renders in the coach.
      useLabRunnerStore.getState().finishRun(key, null);
    }
  };

  const dismissDrainOutcome = () => { if (drainKey) recordOutcome(drainKey, null); };

  return { draining, runDrain, drainOutcome, dismissDrainOutcome };
}
