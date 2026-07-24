import { buildRuntimeDeferredReason } from '@/types/observation';
import type { AcceptanceResult } from './types';

/** L3 runtime check, pending the live-UE runner. `testName` is the functional test to run later.
 *  The reason string is built by the shared `@/types/observation` contract so the runner's
 *  `parseTestName` reader stays in lockstep with this writer. */
export function runtimeDeferred(testName: string, label: string): () => AcceptanceResult {
  return () => ({ label, tier: 'L3', status: 'deferred', detail: 'runtime pending', reason: buildRuntimeDeferredReason(testName) });
}

/**
 * Per-entity L3 gate: the artifact's own `data.automationName` names the test that proves
 * THIS entity; `fallbackTestName` covers rows that haven't declared one. Exists because a
 * pipeline-level hardcoded name let one entity's gate be "proven" by another entity's test
 * (Force Push passed on the Fireball test; Knockback on the Burning test — 2026-07-22).
 */
export function entityRuntimeDeferred(
  fallbackTestName: string,
  label: string,
): (data: Record<string, unknown>) => AcceptanceResult {
  return (data) =>
    runtimeDeferred(
      typeof data.automationName === 'string' && data.automationName
        ? data.automationName
        : fallbackTestName,
      label,
    )();
}

/** L4 visual check, pending RHI + Gemini. */
export function visualDeferred(label: string): () => AcceptanceResult {
  return () => ({ label, tier: 'L4', status: 'deferred', detail: 'visual pending', reason: 'RHI+Gemini visual check not yet run' });
}
