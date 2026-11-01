/**
 * The walker's run state shared by its walks (`walker-walk.ts`): the run context, the sink each walk
 * records into (a throwaway sink for the livelock lead's re-run), and the cached livelock verdicts.
 */

import type { WalkerCohort } from '@/lib/story/types';
import type { Site, WalkModel } from '@/lib/story/walker-model';
import type { DomainLog, VarState } from '@/lib/story/walker-state';
import { livelockClosure, stateKey } from '@/lib/story/walker-livelock';
import type { Snapshot, WalkStats } from '@/lib/story/walker-findings';

export interface WalkContext {
  model: WalkModel;
  cohorts: readonly WalkerCohort[];
  samples: number;
  maxSteps: number;
  seedOf: (cohort: number, sample: number) => number;
  policyFor: (cohort: WalkerCohort, rnd: () => number) => (keys: readonly string[]) => number;
  /** Closure verdicts, shared by every walk of the run: key -> loop id, and keys known not to loop. */
  looped: Map<string, string>;
  open: Set<string>;
}

export interface MutableOutcome {
  endings: Map<string, number>;
  stalled: number;
  terminal: number;
  truncated: number;
  livelocked: number;
}

export interface WalkSink {
  stats: WalkStats;
  stamp: Int32Array;
  outcomes: MutableOutcome[];
  truncatedAt: Map<string, number>;
  terminalAt: Map<string, number>;
  livelockedAt: Map<string, number>;
  log?: DomainLog;
  steps: number;
}

export function createSink(ctx: WalkContext, log?: DomainLog): WalkSink {
  const n = ctx.model.ids.length;
  return {
    stats: { ids: ctx.model.ids, reach: ctx.cohorts.map(() => new Uint32Array(n)), stalls: new Map(), choices: new Map(), livelocks: new Map() },
    stamp: new Int32Array(n),
    outcomes: ctx.cohorts.map(() => ({ endings: new Map(), stalled: 0, terminal: 0, truncated: 0, livelocked: 0 })),
    truncatedAt: new Map(),
    terminalAt: new Map(),
    livelockedAt: new Map(),
    log,
    steps: 0,
  };
}

export const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

/** The loop id a (position, state) is caught in, or undefined when it can still exit (or no claim). */
export function livelockOf(ctx: WalkContext, pos: string, state: VarState): string | undefined {
  const key = stateKey(pos, state);
  const hit = ctx.looped.get(key);
  if (hit !== undefined || ctx.open.has(key)) return hit;
  const v = livelockClosure(ctx.model, pos, state);
  if (v.kind !== 'livelock') {
    ctx.open.add(key);
    return undefined;
  }
  const id = v.closure.nodes.join('\u0000');
  for (const k of v.closure.keys) ctx.looped.set(k, id);
  return id;
}

export function recordStall(sink: WalkSink, s: Site, cohort: string, out: MutableOutcome, snap: () => Snapshot): void {
  out.stalled += 1;
  const hit = sink.stats.stalls.get(s.display);
  if (hit) hit.byCohort[cohort] = (hit.byCohort[cohort] ?? 0) + 1;
  else sink.stats.stalls.set(s.display, { site: s, byCohort: { [cohort]: 1 }, first: snap() });
}
