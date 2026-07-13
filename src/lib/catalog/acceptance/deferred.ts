import { buildRuntimeDeferredReason } from '@/types/observation';
import type { AcceptanceResult } from './types';

/** L3 runtime check, pending the live-UE runner. `testName` is the functional test to run later.
 *  The reason string is built by the shared `@/types/observation` contract so the runner's
 *  `parseTestName` reader stays in lockstep with this writer. */
export function runtimeDeferred(testName: string, label: string): () => AcceptanceResult {
  return () => ({ label, tier: 'L3', status: 'deferred', detail: 'runtime pending', reason: buildRuntimeDeferredReason(testName) });
}

/** L4 visual check, pending RHI + Gemini. */
export function visualDeferred(label: string): () => AcceptanceResult {
  return () => ({ label, tier: 'L4', status: 'deferred', detail: 'visual pending', reason: 'RHI+Gemini visual check not yet run' });
}
