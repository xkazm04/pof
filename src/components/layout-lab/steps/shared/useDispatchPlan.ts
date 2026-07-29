'use client';

import { useEffect, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import type { DispatchPlan } from '@/lib/cli-spend/dispatchPlan';

/**
 * Fetch what a live CLI dispatch will run on and what it has historically cost, so the
 * Produce panel can say it AT the point of produce instead of the vague "spends model
 * budget".
 *
 * `enabled` is the whole reason this is a hook and not a prop: `CliProduce` is mounted by
 * every one of the ~342 pipeline steps, and all but a handful never enter live mode. Gating
 * the fetch on "the operator has actually switched this step to LIVE" keeps the default
 * path free of network work — the same shape `useGeneratedImageAssets` uses for its
 * manifest.
 *
 * Returns `null` until (and unless) the fetch resolves. A failure stays `null` rather than
 * substituting a guess: the panel then falls back to its unpriced copy, which is honest.
 */
export function useDispatchPlan(enabled: boolean, taskType: string): DispatchPlan | null {
  const [plan, setPlan] = useState<DispatchPlan | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void (async () => {
      const res = await tryApiFetch<DispatchPlan>(
        `/api/cli-spend?action=dispatch-plan&taskType=${encodeURIComponent(taskType)}`,
      );
      if (live && res.ok) setPlan(res.data);
    })();
    return () => { live = false; };
  }, [enabled, taskType]);

  return plan;
}
