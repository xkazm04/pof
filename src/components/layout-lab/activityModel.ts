/**
 * activityModel — the ONE vocabulary for "what is running right now" in the lab.
 *
 * The lab drives several genuinely different runtimes: the non-reentrant UE drain
 * (a server lease, shared across every session), the one-shot orchestrator (a
 * client-side job store, this browser only) and the asset forge's background
 * generation polls (client-side, deliberately outliving their module). They stay
 * separate ENGINES — this module merges nothing but the READING of them, projecting
 * each into one lane with one shared state vocabulary so an operator can answer
 * "is it safe to start a drain?" from a single place.
 *
 * Two honesty rules are encoded here rather than left to the UI:
 *  1. `unknown` is a first-class state. Before the first lease poll returns — and after
 *     a poll that failed — the drain lane is UNKNOWN, never idle. Reading "idle" there
 *     would invite an operator to boot a second UE editor.
 *  2. Every lane carries a `blindSpot` string naming what it can NOT see. A surface that
 *     claims to answer "what is running" must say where its knowledge ends.
 */

import type { OneShotPhase } from '@/stores/oneShotJobStore';
import type { DrainLeaseState } from './labArtifactClient';

export type LaneId = 'drain' | 'one-shot' | 'forge';

export type LaneState =
  /** THIS page started it and it is still going. */
  | 'running-here'
  /** Something outside this page is running it (another session, or a run this page lost). */
  | 'running-elsewhere'
  /** We cannot tell. Never collapse this into idle. */
  | 'unknown'
  /** Not running, but waiting on the operator (a failure, or a proposal awaiting go). */
  | 'attention'
  | 'idle';

export interface ActivityLane {
  id: LaneId;
  /** Engine name as an operator would say it. */
  title: string;
  /** Two-to-eight character form used in the collapsed chip. */
  short: string;
  state: LaneState;
  /** One line answering "what is this engine doing right now". */
  label: string;
  /** What this lane cannot see — always populated, never empty. */
  blindSpot: string;
}

export interface ActivitySummary {
  lanes: ActivityLane[];
  /** Worst-case (most operationally significant) lane state. */
  state: LaneState;
  /** The collapsed chip's line. */
  label: string;
  /** Longer form for the chip's `title` tooltip. */
  detail: string;
}

/** How loudly a lane state must be reported. `unknown` deliberately outranks `attention`:
 *  not knowing whether the UE editor is busy has worse consequences than a finished job
 *  that failed. `idle` is the only state that may be reported as "nothing running". */
const RANK: Record<LaneState, number> = {
  'running-here': 4,
  'running-elsewhere': 3,
  unknown: 2,
  attention: 1,
  idle: 0,
};

/** Glyph + word, never hue alone (WCAG 1.4.1 — the lab's colorblind-safe status convention). */
export const LANE_GLYPH: Record<LaneState, string> = {
  'running-here': '▶',
  'running-elsewhere': '⧗',
  unknown: '?',
  attention: '!',
  idle: '○',
};

export const LANE_WORD: Record<LaneState, string> = {
  'running-here': 'RUNNING HERE',
  'running-elsewhere': 'RUNNING ELSEWHERE',
  unknown: 'UNKNOWN',
  attention: 'NEEDS YOU',
  idle: 'IDLE',
};

/** Whether the lease status API has been heard from yet, and whether it answered. */
export type LeaseProbe = 'unpolled' | 'ok' | 'failed';

export interface DrainInput {
  /** `labRunnerStore.localDrain` — the human scope THIS session is draining, else null. */
  localDrain: string | null;
  lease: DrainLeaseState | null;
  leaseProbe: LeaseProbe;
}

export interface OneShotInput {
  phase: OneShotPhase;
  catalogId: string | null;
  currentStepIndex: number;
  totalSteps: number;
  refinementTurns: number;
}

export interface ForgeInput {
  /** `useForgeStore.activePolls.length` — background generation polls still tracking. */
  activePolls: number;
}

export interface ActivityInput {
  drain: DrainInput;
  oneShot: OneShotInput;
  forge: ForgeInput;
}

const DRAIN_BLIND_SPOT =
  'Reads the server lease, so it sees other sessions too — but only once a drain has TAKEN the lease. ' +
  'A batch drain’s per-entity progress lives in the matrix and does not survive a reload; the lease does.';

const ONE_SHOT_BLIND_SPOT =
  'Client-side, THIS browser only: a one-shot running in another session or another tab is invisible here, ' +
  'and a reload marks an interrupted run as failed rather than following it.';

const FORGE_BLIND_SPOT =
  'Counts only generation polls this browser session started. A reload loses the poll while the remote job ' +
  'keeps running — nothing here can see it after that.';

export function drainLane(d: DrainInput): ActivityLane {
  const base = { id: 'drain' as const, title: 'UE drain', short: 'drain', blindSpot: DRAIN_BLIND_SPOT };
  if (d.localDrain) {
    return { ...base, state: 'running-here', label: `draining ${d.localDrain} (one editor boot)` };
  }
  if (d.leaseProbe === 'unpolled') {
    return { ...base, state: 'unknown', label: 'lease not checked yet — a drain started now could be refused' };
  }
  if (d.leaseProbe === 'failed') {
    return { ...base, state: 'unknown', label: 'lease status unreachable — the last check failed' };
  }
  if (d.lease?.held) {
    const scope = d.lease.scope ? ` · ${d.lease.scope}` : '';
    return { ...base, state: 'running-elsewhere', label: `lease held by a drain this page did not start${scope}` };
  }
  return { ...base, state: 'idle', label: 'lease free — the UE editor is available' };
}

export function oneShotLane(o: OneShotInput): ActivityLane {
  const base = { id: 'one-shot' as const, title: 'One-shot', short: 'one-shot', blindSpot: ONE_SHOT_BLIND_SPOT };
  const c = o.catalogId ?? '—';
  switch (o.phase) {
    case 'analyzing':   return { ...base, state: 'running-here', label: `${c} · scanning…` };
    case 'proposing':   return { ...base, state: 'running-here', label: `${c} · drafting…` };
    case 'refining':    return { ...base, state: 'running-here', label: `${c} · refine ${o.refinementTurns}/3` };
    case 'running':     return { ...base, state: 'running-here', label: `${c} · step ${o.currentStepIndex + 1}/${o.totalSteps || '?'}` };
    case 'awaitingRun': return { ...base, state: 'attention', label: `${c} · proposal ready, awaiting your go` };
    case 'failed':      return { ...base, state: 'attention', label: `${c} · failed` };
    case 'completed':   return { ...base, state: 'idle', label: `${c} · ✓ last run completed` };
    default:            return { ...base, state: 'idle', label: 'no job' };
  }
}

export function forgeLane(f: ForgeInput): ActivityLane {
  const base = { id: 'forge' as const, title: 'Asset generation', short: 'gen', blindSpot: FORGE_BLIND_SPOT };
  if (f.activePolls > 0) {
    return {
      ...base,
      state: 'running-here',
      label: `${f.activePolls} background generation ${f.activePolls === 1 ? 'poll' : 'polls'} still tracking`,
    };
  }
  return { ...base, state: 'idle', label: 'no tracked generation' };
}

/** Combine the lanes into the collapsed chip's single answer. */
export function summarizeActivity(input: ActivityInput): ActivitySummary {
  const lanes = [drainLane(input.drain), oneShotLane(input.oneShot), forgeLane(input.forge)];
  const state = lanes.reduce<LaneState>((worst, l) => (RANK[l.state] > RANK[worst] ? l.state : worst), 'idle');
  const named = (s: LaneState) => lanes.filter((l) => l.state === s).map((l) => l.short).join(' + ');

  const label =
    state === 'running-here'      ? `Running · ${named('running-here')}` :
    state === 'running-elsewhere' ? `Busy elsewhere · ${named('running-elsewhere')}` :
    // Never "nothing running" while a lane cannot answer — that is the false idle.
    state === 'unknown'           ? `Unknown · ${named('unknown')}` :
    state === 'attention'         ? `Needs you · ${named('attention')}` :
                                    'Nothing running';

  const detail = lanes.map((l) => `${l.title}: ${l.label}`).join('\n');
  return { lanes, state, label, detail };
}
