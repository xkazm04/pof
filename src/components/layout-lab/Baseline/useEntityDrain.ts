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
  // to the wrong entity (the `draining` flag reflects only the SELECTED entity).
  const [drainingKeys, setDrainingKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [outcomes, setOutcomes] = useState<ReadonlyMap<string, EntityDrainOutcome>>(() => new Map());
  const drainKey = catalogId && entityId ? `${catalogId}/${entityId}` : null;
  const draining = drainKey ? drainingKeys.has(drainKey) : false;
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
    if (drainingKeys.has(key)) return;
    setDrainingKeys((prev) => { const next = new Set(prev); next.add(key); return next; });
    // A new run replaces the last one's result — a stale outcome must not sit beside "Running…".
    recordOutcome(key, null);
    // Publish this session's drain scope so the header runner chip shows "draining …"
    // (and never mistakes our own lease for another session's).
    useLabRunnerStore.getState().setLocalDrain(key);
    try {
      // drainGates never throws; a thrown stub is still reported, never swallowed.
      const response = await Promise.resolve().then(() => drainGates(catalogId, entityId))
        .catch((e: unknown) => ({ kind: 'error' as const, reason: e instanceof Error ? e.message : String(e) }));
      recordOutcome(key, entityDrainOutcome(steps, response));
      invalidateArtifacts(catalogId, entityId);
    } finally {
      setDrainingKeys((prev) => { const next = new Set(prev); next.delete(key); return next; });
      // Only clear the header lease if it's still OURS (a later drain for another entity
      // may have taken it over while this one was in flight).
      const runner = useLabRunnerStore.getState();
      if (runner.localDrain === key) runner.setLocalDrain(null);
    }
  };

  const dismissDrainOutcome = () => { if (drainKey) recordOutcome(drainKey, null); };

  return { draining, runDrain, drainOutcome, dismissDrainOutcome };
}
