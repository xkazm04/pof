/**
 * The Package button's decision, as a pure reducer.
 *
 * A press is gated by a FAST pre-flight verdict for the pressed profile's OWN maps
 * (ai-registry game-production/ship-pipeline-gating: the cheapest capable observer
 * runs before the expensive transform, and unmeasured is not a pass):
 *
 *   idle -press-> measuring(profile, mapsKey, kinds) -summary-> cook | blocked
 *   blocked -measure-missing-> measuring(failing + never-run kinds)
 *   blocked -override-> cook (overridden)      measuring|blocked -cancel-> idle
 *   cook -settled-> idle
 *
 * A summary only counts when it measured THIS mapsKey and none of the requested
 * kinds is still running or still unmeasured. An unrun slow check the operator did
 * not ask for never vetoes the cook — it is disclosed on it (`disclosedNotRun`).
 */
import type { PreflightStatus } from '@/lib/packaging/preflight';

export type PreflightCheckKind = 'fast' | 'build-verify-editor' | 'build-verify-shipping' | 'asset-validation';

/** Canonical run order: the cheap gate first, the slow cook-relevant checks after. */
const KIND_ORDER: PreflightCheckKind[] = ['fast', 'build-verify-shipping', 'asset-validation', 'build-verify-editor'];

export interface PreflightStatusSummary {
  /** True when no COMPLETED check is in a `fail` state. An unrun check never vetoes. */
  canCook: boolean;
  /** Worst status across all completed checks, or 'idle' if none have run. */
  overall: PreflightStatus | 'idle';
  /** True when every cook-relevant check has produced a result. */
  fullyCovered: boolean;
  /** Labels / kinds of the cook-relevant checks that have never run. */
  notRunLabels: string[];
  notRunKinds: PreflightCheckKind[];
  /** How much of the cook-relevant gate was actually measured. */
  coverage: { ran: number; total: number };
  /** `mapsKeyOf(maps)` the held FAST verdict measured; null when no fast verdict is held. */
  mapsKey: string | null;
  /** Labels / kinds of the checks whose held result is `fail`. */
  failing: string[];
  failingKinds: PreflightCheckKind[];
  /** Kinds with a request in flight. */
  running: PreflightCheckKind[];
}

/** The identity of a map set, as the panel and the flow both serialize it. */
export function mapsKeyOf(maps: readonly string[] | undefined): string {
  return (maps ?? []).join('|');
}

interface Target { seq: number; profileId: string; maps: string[]; mapsKey: string }

export type PackageFlowState =
  | { phase: 'idle'; seq: number }
  | (Target & { phase: 'measuring'; kinds: PreflightCheckKind[] })
  | (Target & {
    phase: 'blocked';
    failing: string[]; failingKinds: PreflightCheckKind[];
    notRunLabels: string[]; notRunKinds: PreflightCheckKind[];
  })
  | (Target & { phase: 'cook'; disclosedNotRun: string[]; overridden: boolean });

export type PackageFlowEvent =
  | { type: 'press'; profileId: string; maps: string[]; summary: PreflightStatusSummary }
  | { type: 'summary'; summary: PreflightStatusSummary }
  | { type: 'measure-missing' }
  | { type: 'override' }
  | { type: 'cancel' }
  | { type: 'settled' };

export const INITIAL_PACKAGE_FLOW: PackageFlowState = { phase: 'idle', seq: 0 };

function ordered(kinds: Iterable<PreflightCheckKind>): PreflightCheckKind[] {
  const set = new Set(kinds);
  return KIND_ORDER.filter((k) => set.has(k));
}

/** The verdict a summary gives a measuring flow, or null while it does not decide it. */
function decide(
  state: Extract<PackageFlowState, { phase: 'measuring' }>,
  s: PreflightStatusSummary,
): PackageFlowState | null {
  if (s.mapsKey !== state.mapsKey) return null; // a verdict for other maps never releases this cook
  if (state.kinds.some((k) => s.running.includes(k))) return null;
  const { seq, profileId, maps, mapsKey } = state;
  const unmeasured = state.kinds.filter((k) => s.notRunKinds.includes(k));
  if (!s.canCook || unmeasured.length > 0) {
    return {
      phase: 'blocked', seq, profileId, maps, mapsKey,
      failing: s.failing, failingKinds: s.failingKinds,
      notRunLabels: s.notRunLabels, notRunKinds: s.notRunKinds,
    };
  }
  return { phase: 'cook', seq, profileId, maps, mapsKey, disclosedNotRun: s.notRunLabels, overridden: false };
}

export function packageFlow(state: PackageFlowState, event: PackageFlowEvent): PackageFlowState {
  switch (event.type) {
    case 'press': {
      if (state.phase === 'cook') return state;
      const maps = [...event.maps];
      const measuring = {
        phase: 'measuring' as const, seq: state.seq + 1, profileId: event.profileId,
        maps, mapsKey: mapsKeyOf(maps), kinds: ['fast' as const] as PreflightCheckKind[],
      };
      // A fast verdict already held for exactly these maps decides at once.
      return decide(measuring, event.summary) ?? measuring;
    }
    case 'summary':
      return state.phase === 'measuring' ? decide(state, event.summary) ?? state : state;
    case 'measure-missing': {
      if (state.phase !== 'blocked') return state;
      const kinds = ordered([...state.failingKinds, ...state.notRunKinds]);
      if (kinds.length === 0) return state;
      const { profileId, maps, mapsKey } = state;
      return { phase: 'measuring', seq: state.seq + 1, profileId, maps, mapsKey, kinds };
    }
    case 'override': {
      if (state.phase !== 'blocked') return state;
      const { seq, profileId, maps, mapsKey } = state;
      return { phase: 'cook', seq, profileId, maps, mapsKey, disclosedNotRun: state.notRunLabels, overridden: true };
    }
    case 'cancel':
      return state.phase === 'measuring' || state.phase === 'blocked' ? { phase: 'idle', seq: state.seq } : state;
    case 'settled':
      return state.phase === 'cook' ? { phase: 'idle', seq: state.seq } : state;
  }
}
