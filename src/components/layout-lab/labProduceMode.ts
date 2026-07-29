'use client';

import type { ArchetypeId } from '@/lib/catalog/stepSpec';

/**
 * Lab produce mode — STUB (the default) vs LIVE CLI.
 *
 * The lab has always produced artifacts deterministically in the browser (`spec.produce`),
 * which is what keeps the Rule 5 walker synchronous and offline. Meanwhile the ONE real CLI
 * produce seam — `POST /api/one-shot/step` with `mode: 'cli'`, which spawns a Claude session
 * and awaits its `@@CALLBACK` — was unreachable from the lab UI and ran on a hardcoded
 * direction. This module is the switch between the two, so the operator's typed direction can
 * actually drive a real session without changing the default behaviour of anything else.
 *
 * Opt-in only, and never on in tests/e2e: `localStorage['pof-lab-live-produce'] === '1'`.
 * Stub mode remains the default, so the walker (Rule 5) stays synchronous and green.
 */
export const LIVE_PRODUCE_KEY = 'pof-lab-live-produce';

/**
 * Archetypes whose Produce is a TEXT deliverable a CLI session can actually author end to
 * end (a brief's prose, a graph's nodes/edges, a rules body). Generative galleries, UE
 * packaging and balance math are produced by other engines (Leonardo/Tripo, the gate drain,
 * deterministic code), so routing them through a text CLI would overclaim.
 */
export const CLI_ELIGIBLE_ARCHETYPES: readonly ArchetypeId[] = ['brief', 'graph', 'rules'];

export function isCliEligible(archetype: ArchetypeId): boolean {
  return CLI_ELIGIBLE_ARCHETYPES.includes(archetype);
}

/** Is the live-CLI produce path enabled in this browser? SSR/test-safe (false). */
export function isLiveProduceEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LIVE_PRODUCE_KEY) === '1';
  } catch {
    return false; // storage blocked (private mode) — stay on the stub path
  }
}

/** Response payload of `POST /api/one-shot/step` (inside the `{ success, data }` envelope). */
export interface OneShotStepResult {
  outcome: 'pass' | 'fail';
  stepName: string;
  reason?: string;
  /** The artifact data the server persisted for this step. */
  artifactData: Record<string, unknown>;
  ueAssets: string[];
}
