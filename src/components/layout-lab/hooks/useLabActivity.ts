'use client';

import { useState } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { UI_TIMEOUTS } from '@/lib/constants';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { fetchDrainLease, type DrainLeaseState } from '../labArtifactClient';
import { useLabRunnerStore } from '../labRunnerStore';
import { summarizeActivity, type ActivitySummary, type LeaseProbe } from '../activityModel';

/**
 * The ONE read of every job engine the lab can observe. It merges no runtimes — it
 * subscribes to the stores each engine already publishes and adds exactly one network
 * read: the drain lease poll that `RunnerChip` used to own, on the same
 * `UI_TIMEOUTS.runnerLeasePoll` interval, suspended with the lab and skipped entirely
 * while this session's own drain is authoritative. No engine gains a poll here, and
 * none loses a push.
 *
 * `leaseProbe` is the honesty carrier: the lease API returns `null` both before the
 * first answer and after a failed one, and the old chip rendered both as "idle". Here
 * they are `unpolled` / `failed` and the model reports UNKNOWN.
 */
export function useLabActivity(): ActivitySummary {
  const localDrain = useLabRunnerStore((s) => s.localDrain);
  const [lease, setLease] = useState<DrainLeaseState | null>(null);
  const [leaseProbe, setLeaseProbe] = useState<LeaseProbe>('unpolled');

  // One-shot orchestrator (client store, push). Field-wise selectors keep the
  // subscription stable — a whole-object selector would re-render every store write.
  const phase = useOneShotJobStore((s) => s.phase);
  const oneShotCatalog = useOneShotJobStore((s) => s.catalogId);
  const currentStepIndex = useOneShotJobStore((s) => s.currentStepIndex);
  const totalSteps = useOneShotJobStore((s) => s.totalSteps);
  const refinementTurns = useOneShotJobStore((s) => s.refinementTurns);

  // Asset forge background polls (client store, push). Read as a count so this never
  // re-renders on array identity churn.
  const activePolls = useForgeStore((s) => s.activePolls.length);

  useSuspendableEffect(() => {
    // Our own drain is authoritative — no need to poll (and avoids racing our own lease).
    if (localDrain) return;
    let alive = true;
    const tick = async () => {
      const s = await fetchDrainLease();
      if (!alive) return;
      setLease(s);
      // `fetchDrainLease` is non-throwing and returns null on failure, so null is the
      // ONLY signal that the read did not land. Record it as a failed probe rather than
      // letting an unreachable server read as a free editor.
      setLeaseProbe(s ? 'ok' : 'failed');
    };
    void tick();
    const id = setInterval(() => void tick(), UI_TIMEOUTS.runnerLeasePoll);
    return () => { alive = false; clearInterval(id); };
  }, [localDrain]);

  return summarizeActivity({
    drain: { localDrain, lease, leaseProbe },
    oneShot: { phase, catalogId: oneShotCatalog, currentStepIndex, totalSteps, refinementTurns },
    forge: { activePolls },
  });
}
