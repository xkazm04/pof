/**
 * One walk (`walkOne`) — the inner loop of the walker (`walker.ts` owns the run and the report).
 *
 * A walk is a set of THREADS sharing one variable state, one history and one path. It starts as a
 * single thread at an entry; a fork (`mode: 'all'`, `resolveFork`) keeps the forking thread on the
 * first move and spawns one new thread per further move, in order (each move's writes applied as
 * its thread is placed). Without a fork there is exactly one thread and the walk is the plain
 * single-cursor walk, step for step and draw for draw.
 *
 * With several threads (all decided in this order, so a seed replays):
 *   - SCHEDULING. Each step picks one ready thread uniformly with the walk's PRNG (no draw when
 *     only one is ready). A step is one move (a fork's spawns count as one step).
 *   - BLOCKING. A thread whose guards all fail is BLOCKED, not stalled: another thread's writes may
 *     open its way. It is ready again once any move has written state. The walk STALLS only when
 *     every live thread is blocked; the stall is recorded at the lowest-numbered one.
 *   - MERGING. A thread arriving at a real node another thread has already visited joins that
 *     story and completes — unless it is the only live thread. Reach still counts the arrival.
 *   - COMPLETING. With other live threads, a thread arriving at a dead end (no traversal edge, no
 *     fall-through) completes at once; arriving at an ending with no authored way on ends the WALK
 *     at once. The last live thread resolves exactly as a single-thread walk does.
 *   - Endings are counted once per walk (the first terminal ending); reach once per walk.
 *
 * At the step cap, a walk with one live thread is checked for a LIVELOCK (`walker-livelock.ts`):
 * when its (position, state) lies in a closed loop with no ending, the walk is `livelocked`, not
 * `truncated`. The livelock lead's path is found by re-running the same walk (same stream, a
 * throwaway sink) to the FIRST step it entered that loop.
 */

import { mulberry32 } from '@/lib/story/fixtures';
import type { Site } from '@/lib/story/walker-model';
import { resolve, type Move } from '@/lib/story/walker-resolve';
import { applyWrites, initialState, type VarState } from '@/lib/story/walker-state';
import { stateKey } from '@/lib/story/walker-livelock';
import type { Snapshot } from '@/lib/story/walker-findings';
import type { EvalEnv } from '@/lib/story/cond-eval';
import { bump, createSink, livelockOf, recordStall, type WalkContext, type WalkSink } from '@/lib/story/walker-sink';

type Probe = (pos: string, state: VarState) => boolean;

/** Run walk `i` into `sink`. With `probe`, stop at the first step the probe accepts and return its snapshot. */
export function walkOne(ctx: WalkContext, sink: WalkSink, i: number, probe?: Probe): Snapshot | undefined {
  const { model, samples, maxSteps } = ctx;
  const c = Math.floor(i / samples);
  const cohort = ctx.cohorts[c];
  const rnd = mulberry32(ctx.seedOf(c, i % samples));
  const pick = (n: number) => Math.floor(rnd() * n);
  const policy = ctx.policyFor(cohort, rnd);
  const state = initialState(model.vars, model.setVars, rnd);
  const ids = model.ids;
  const history = model.needsHistory;
  // `visited`/`fired` are kept only when some guard reads them (`flag`/`visited`, §6).
  const visited = new Set<string>();
  const fired = new Set<string>();
  const env: { -readonly [K in keyof EvalEnv]: EvalEnv[K] } = {
    state, declared: model.declared, visited, fired, axis: undefined, definitions: model.graph.definitions, roll: (p) => rnd() < p,
  };
  const path: string[] = [];
  const tids: number[] | null = model.hasFork ? [] : null;
  const owner = model.hasFork ? new Map<string, number>() : null;
  const counts = sink.stats.reach[c];
  const out = sink.outcomes[c];
  const stampArr = sink.stamp;
  const stamp = i + 1;
  // Threads: walk id, site, live, blocked-at-version (-1 = ready), last path display, last real node.
  const where: string[] = [];
  const at: Site[] = [];
  const live: boolean[] = [];
  const blocked: number[] = [];
  const last: (string | undefined)[] = [];
  const lastReal: string[] = [];
  let liveN = 0;
  let version = 0;
  const snap = (): Snapshot => {
    const s: Snapshot = { state: { ...state }, path: [...path], cohort: cohort.id, sample: i % samples };
    if (at.length > 1) s.threads = [...tids!];
    return s;
  };
  const lowestLive = () => live.indexOf(true);
  const ENDED = 1;
  /** Place thread `t` at `pos` and visit it. Returns ENDED when the walk ends there at once. */
  const arrive = (t: number, pos: string): number => {
    const s = model.site(pos);
    where[t] = pos;
    at[t] = s;
    if (last[t] !== s.display) {
      path.push(s.display);
      tids?.push(t);
      last[t] = s.display;
    }
    if (!s.real) return 0;
    lastReal[t] = s.display;
    const line = s.line;
    for (let k = 0; k < line.length; k++) {
      const idx = line[k];
      if (stampArr[idx] === stamp) break; // its ancestors were stamped with it
      stampArr[idx] = stamp;
      counts[idx] += 1;
      if (history) {
        visited.add(ids[idx]);
        fired.add(ids[idx]);
      }
    }
    if (owner) {
      const o = owner.get(s.display);
      if (o === undefined) owner.set(s.display, t);
      else if (o !== t && liveN > 1) {
        live[t] = false;
        liveN -= 1;
        return 0;
      }
    }
    if (liveN > 1 && s.authored.length === 0) {
      if (s.ending) return ENDED;
      if (s.fallback.length === 0) {
        live[t] = false;
        liveN -= 1;
      }
    }
    return 0;
  };
  const spawn = (): number => {
    const t = at.length;
    live.push(true);
    blocked.push(-1);
    last.push(undefined);
    lastReal.push('');
    liveN += 1;
    return t;
  };

  const roots = model.topo.roots;
  if (roots.length === 0) {
    out.terminal += 1;
    bump(sink.terminalAt, '(no entry)');
    return undefined;
  }
  spawn();
  arrive(0, roots[roots.length === 1 ? 0 : pick(roots.length)]);
  let n = 0;
  for (;;) {
    if (probe && liveN === 1) {
      const t = lowestLive();
      if (probe(where[t], state)) return snap();
    }
    if (n >= maxSteps) {
      const t = lowestLive();
      const loop = !probe && liveN === 1 && blocked[t] !== version ? livelockOf(ctx, where[t], state) : undefined;
      if (loop === undefined) {
        out.truncated += 1;
        bump(sink.truncatedAt, at[t].display);
      } else {
        out.livelocked += 1;
        bump(sink.livelockedAt, at[t].display);
        const hit = sink.stats.livelocks.get(loop);
        if (hit) hit.byCohort[cohort.id] = (hit.byCohort[cohort.id] ?? 0) + 1;
        else {
          const dry = walkOne(ctx, createSink(ctx), i, (p, st) => ctx.looped.get(stateKey(p, st)) === loop);
          sink.stats.livelocks.set(loop, { nodes: loop.split('\u0000'), byCohort: { [cohort.id]: 1 }, first: dry ?? snap() });
        }
      }
      break;
    }
    let t = 0;
    if (at.length > 1) {
      const ready: number[] = [];
      for (let k = 0; k < at.length; k++) if (live[k] && blocked[k] !== version) ready.push(k);
      if (ready.length === 0) {
        recordStall(sink, at[lowestLive()], cohort.id, out, snap);
        break;
      }
      t = ready.length === 1 ? ready[0] : ready[pick(ready.length)];
    }
    const s = at[t];
    env.axis = s.node?.axis;
    const r = resolve(model, s, env, pick, policy);
    if (r.offered) {
      let ch = sink.stats.choices.get(s.display);
      if (!ch) sink.stats.choices.set(s.display, (ch = { visits: 0, offered: new Uint32Array(s.optionKeys.length) }));
      ch.visits += 1;
      for (const k of r.offered) ch.offered[k] += 1;
      if (r.offered.length < s.optionKeys.length && !ch.partial) ch.partial = snap();
    }
    if (r.kind === 'ending') {
      out.endings.set(s.display, (out.endings.get(s.display) ?? 0) + 1);
      break;
    }
    if (r.kind === 'terminal') {
      if (liveN > 1) {
        live[t] = false;
        liveN -= 1;
        continue;
      }
      // Recorded at the last real node: a dead end falls through exits to the top first.
      out.terminal += 1;
      bump(sink.terminalAt, lastReal[t]);
      break;
    }
    if (r.kind === 'stall') {
      if (at.length > 1) {
        blocked[t] = version;
        continue;
      }
      recordStall(sink, s, cohort.id, out, snap);
      break;
    }
    // One move (the common case, no allocation) or a fork's moves in order, spawning threads.
    const moves: readonly Move[] | undefined = r.kind === 'fork' ? r.moves : undefined;
    const count = moves ? moves.length : r.kind === 'move' ? 1 : 0;
    let ended = '';
    for (let m = 0; m < count; m++) {
      const mv: Move = moves ? moves[m] : (r as Move);
      const edge = mv.arc?.edge;
      if (edge) {
        if (edge.writes) {
          applyWrites(state, edge.writes, edge.id, model.vars, sink.log);
          if (edge.writes.length > 0) version += 1;
        }
        if (history && edge.optionId) fired.add(edge.optionId);
      }
      const tt = m === 0 ? t : spawn();
      if (arrive(tt, mv.to) === ENDED) {
        ended = at[tt].display;
        break;
      }
    }
    n += 1;
    if (ended) {
      out.endings.set(ended, (out.endings.get(ended) ?? 0) + 1);
      break;
    }
  }
  sink.steps += n;
  return undefined;
}
