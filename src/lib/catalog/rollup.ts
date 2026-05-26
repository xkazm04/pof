import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { AcceptanceTier } from './acceptance/types';

const TIER_ORDER: AcceptanceTier[] = ['L0', 'L1', 'L2', 'L3', 'L4'];

export interface EntityRollup {
  total: number;
  done: number;       // status === 'pass'
  deferred: number;
  pending: number;
  failed: number;
  highestTier: AcceptanceTier | null;
  /** Every step is either pass (any tier) or deferred at L3/L4 — i.e. nothing pending/failed. */
  configComplete: boolean;
}

export function summarizeEntity(artifacts: PipelineArtifact[], totalSteps: number): EntityRollup {
  let done = 0, deferred = 0, pending = 0, failed = 0, hi = -1, earlyDeferred = 0;
  for (const art of artifacts) {
    if (art.status === 'pass') done++;
    else if (art.status === 'deferred') {
      deferred++;
      if (art.tier !== 'L3' && art.tier !== 'L4') earlyDeferred++;
    }
    else if (art.status === 'fail') failed++;
    else pending++;
    if (art.status === 'pass' && art.tier) hi = Math.max(hi, TIER_ORDER.indexOf(art.tier));
  }
  const missing = Math.max(0, totalSteps - done - deferred - failed - pending); // steps with no artifact yet
  const pendingTotal = pending + missing;
  return {
    total: totalSteps, done, deferred, failed,
    pending: pendingTotal,
    highestTier: hi >= 0 ? TIER_ORDER[hi] : null,
    configComplete: failed === 0 && pendingTotal === 0 && earlyDeferred === 0,
  };
}
