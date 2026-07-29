'use client';

import { useSyncExternalStore } from 'react';
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
 *
 * The opt-in has a real control: every CLI-eligible step's `CliProduce` renders the mode
 * switch next to its dispatch button (`useLiveProduceMode`), so the operator always sees —
 * at the point of produce — whether the next click writes a stub or spends model budget.
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

type ModeListener = () => void;
const listeners = new Set<ModeListener>();

/**
 * Flip the live-CLI produce mode for this browser. Persisted (so a deliberate opt-in
 * survives a reload) and broadcast, so every mounted Produce panel re-reads it at once.
 */
export function setLiveProduceEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (on) window.localStorage.setItem(LIVE_PRODUCE_KEY, '1');
    else window.localStorage.removeItem(LIVE_PRODUCE_KEY);
  } catch {
    // storage blocked (private mode) — nothing persists, and `isLiveProduceEnabled`
    // will keep reporting stub. Notifying anyway keeps the UI honest about that.
  }
  for (const l of listeners) l();
}

function subscribeLiveProduce(l: ModeListener): () => void {
  listeners.add(l);
  if (typeof window === 'undefined') return () => { listeners.delete(l); };
  // `storage` fires for OTHER tabs only — keeps a second open lab tab from claiming stub
  // while this one is spending budget.
  const onStorage = (e: StorageEvent) => { if (e.key === LIVE_PRODUCE_KEY) l(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(l); window.removeEventListener('storage', onStorage); };
}

/**
 * Reactive view of the mode for UI, plus its setter. SSR/first-paint snapshot is `false`
 * (stub) so hydration matches; the real value arrives on the client subscribe pass.
 *
 * DISPLAY ONLY — the dispatch path still calls `isLiveProduceEnabled()` at click time, so
 * the decision can never be a stale render-state copy.
 */
export function useLiveProduceMode(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribeLiveProduce, isLiveProduceEnabled, () => false);
  return [on, setLiveProduceEnabled];
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
