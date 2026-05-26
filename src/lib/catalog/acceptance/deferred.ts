import type { AcceptanceResult } from './types';

/** L3 runtime check, pending the live-UE runner. `testName` is the functional test to run later. */
export function runtimeDeferred(testName: string, label: string): () => AcceptanceResult {
  return () => ({ label, tier: 'L3', status: 'deferred', detail: 'runtime pending', reason: `live-UE runner not yet run: ${testName}` });
}

/** L4 visual check, pending RHI + Gemini. */
export function visualDeferred(label: string): () => AcceptanceResult {
  return () => ({ label, tier: 'L4', status: 'deferred', detail: 'visual pending', reason: 'RHI+Gemini visual check not yet run' });
}
