/**
 * The bounded walker — PoF's own state-altitude engine (§8 "State pass", §9).
 *
 * `sampleGraph(graph, opts)` walks the graph `samples` times per cohort from its declared entries,
 * over (node, state) pairs, bounded by the DECLARED variable domains only, and reports:
 *   - `evidence.reach` — percent of each cohort's walks that reached each node. A node no walk
 *     reached is ABSENT (unmeasured is never 0);
 *   - outcomes per cohort (endings, stalls, structural dead ends, truncations);
 *   - state-altitude LEADS (`walker-findings.ts`) — each carrying `{seed, engine, samples, state,
 *     path}` so it stays falsifiable (`replayLead` in `walker-replay.ts` reproduces a stall).
 *
 * Seeded and reproducible: every walk draws from its own `mulberry32` stream keyed by
 * `(seed, cohort, sample)`, so the same `(graph, seed, samples, cohorts)` yields byte-identical
 * output however the work is chunked. No clock and no `Math.random` here — timing belongs to the
 * job wrapper. `createWalker` exposes the same run in chunks so a background job can yield
 * between them; `sampleGraph` runs it in one go.
 *
 * A walk that hits the step cap while it still has a way on is `truncated` — long or looping is not
 * stuck, and is never reported as a softlock.
 */

import type { StoryGraph, WalkerCohort, WalkerCohortOutcome, WalkerOptions, WalkerReport } from '@/lib/story/types';
import { mulberry32 } from '@/lib/story/fixtures';
import { buildWalkModel, type Site, type WalkModel } from '@/lib/story/walker-model';
import { resolve } from '@/lib/story/walker-resolve';
import { applyWrites, initialState, type DomainLog } from '@/lib/story/walker-state';
import { buildWalkerFindings, type Snapshot, type WalkStats } from '@/lib/story/walker-findings';
import type { EvalEnv } from '@/lib/story/cond-eval';

export const WALKER_ENGINE = 'pof-walker@1';
export const DEFAULT_COHORTS: readonly WalkerCohort[] = [{ id: 'uniform', policy: 'uniform' }];

/** Default step cap: twice the walkable positions (nodes + container exits), at least 1,000. */
export const defaultMaxSteps = (model: WalkModel): number => Math.max(1000, 2 * (model.topo.nodeById.size + model.topo.children.size));

/** Independent, order-free seed per walk. */
export function walkSeed(seed: number, cohort: number, sample: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (cohort + 0x85ebca6b), 0xc2b2ae35) >>> 0;
  h = Math.imul(h ^ (sample + 0x27d4eb2f) ^ (h >>> 13), 0x165667b1) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export interface Walker {
  readonly total: number;
  done(): number;
  /** Run up to `n` more walks; returns how many ran. */
  run(n: number): number;
  report(): WalkerReport;
}

function policyFor(cohort: WalkerCohort, rnd: () => number): (keys: readonly string[]) => number {
  if (cohort.policy !== 'weighted' || !cohort.weights) return (keys) => Math.floor(rnd() * keys.length);
  const w = cohort.weights;
  return (keys) => {
    const ws = keys.map((k) => Math.max(0, w[k] ?? 1));
    const sum = ws.reduce((a, b) => a + b, 0);
    if (!(sum > 0)) return Math.floor(rnd() * keys.length);
    let r = rnd() * sum;
    for (let i = 0; i < ws.length; i++) if ((r -= ws[i]) < 0) return i;
    return ws.length - 1;
  };
}

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

export function createWalker(graph: StoryGraph, opts: WalkerOptions): Walker {
  const { seed, samples } = opts;
  if (!Number.isInteger(seed)) throw new RangeError(`walker: seed must be an integer, got ${seed}`);
  if (!Number.isInteger(samples) || samples < 0) throw new RangeError(`walker: samples must be an integer >= 0, got ${samples}`);
  const cohorts = opts.cohorts && opts.cohorts.length > 0 ? opts.cohorts : DEFAULT_COHORTS;
  if (new Set(cohorts.map((c) => c.id)).size !== cohorts.length) throw new RangeError('walker: cohort ids must be unique');
  const model = buildWalkModel(graph);
  const maxSteps = opts.maxSteps ?? defaultMaxSteps(model);
  const ids = model.ids;
  const stampArr = new Int32Array(ids.length);
  const roots = model.topo.roots;
  const history = model.needsHistory;
  const log: DomainLog = new Map();
  const stats: WalkStats = { ids, reach: cohorts.map(() => new Uint32Array(ids.length)), stalls: new Map(), choices: new Map() };
  const outcomes = cohorts.map(() => ({ endings: new Map<string, number>(), stalled: 0, terminal: 0, truncated: 0 }));
  const truncatedAt = new Map<string, number>();
  const terminalAt = new Map<string, number>();
  const total = samples * cohorts.length;
  let done = 0;
  let steps = 0;

  function walkOne(i: number): void {
    const c = Math.floor(i / samples);
    const cohort = cohorts[c];
    const rnd = mulberry32(walkSeed(seed, c, i % samples));
    const pick = (n: number) => Math.floor(rnd() * n);
    const policy = policyFor(cohort, rnd);
    const state = initialState(model.vars, model.setVars, rnd);
    // `visited`/`fired` are kept only when some guard reads them (`flag`/`visited`, §6).
    const visited = new Set<string>();
    const fired = new Set<string>();
    const env: { -readonly [K in keyof EvalEnv]: EvalEnv[K] } = {
      state, declared: model.declared, visited, fired, axis: undefined, definitions: graph.definitions, roll: (p) => rnd() < p,
    };
    const path: string[] = [];
    const counts = stats.reach[c];
    const out = outcomes[c];
    const stamp = i + 1;
    const snap = (): Snapshot => ({ state: { ...state }, path: [...path], cohort: cohort.id, sample: i % samples });
    let lastReal = '';
    const visit = (s: Site) => {
      if (path[path.length - 1] !== s.display) path.push(s.display);
      if (!s.real) return;
      lastReal = s.display;
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
    };
    if (roots.length === 0) {
      out.terminal += 1;
      bump(terminalAt, '(no entry)');
      return;
    }
    let s = model.site(roots[roots.length === 1 ? 0 : pick(roots.length)]);
    visit(s);
    let n = 0;
    for (;;) {
      if (n >= maxSteps) {
        out.truncated += 1;
        bump(truncatedAt, s.display);
        break;
      }
      env.axis = s.node?.axis;
      const r = resolve(model, s, env, pick, policy);
      if (r.offered) {
        let ch = stats.choices.get(s.display);
        if (!ch) stats.choices.set(s.display, (ch = { visits: 0, offered: new Uint32Array(s.optionKeys.length) }));
        ch.visits += 1;
        for (const k of r.offered) ch.offered[k] += 1;
        if (r.offered.length < s.optionKeys.length && !ch.partial) ch.partial = snap();
      }
      if (r.kind !== 'move') {
        if (r.kind === 'ending') out.endings.set(s.display, (out.endings.get(s.display) ?? 0) + 1);
        else if (r.kind === 'terminal') {
          // Recorded at the last real node: a dead end falls through exits to the top first.
          out.terminal += 1;
          bump(terminalAt, lastReal);
        } else {
          out.stalled += 1;
          const hit = stats.stalls.get(s.display);
          if (hit) hit.byCohort[cohort.id] = (hit.byCohort[cohort.id] ?? 0) + 1;
          else stats.stalls.set(s.display, { site: s, byCohort: { [cohort.id]: 1 }, first: snap() });
        }
        break;
      }
      const edge = r.arc?.edge;
      if (edge) {
        if (edge.writes) applyWrites(state, edge.writes, edge.id, model.vars, log);
        if (history && edge.optionId) fired.add(edge.optionId);
      }
      s = model.site(r.to);
      visit(s);
      n += 1;
    }
    steps += n;
  }

  return {
    total,
    done: () => done,
    run(n: number) {
      const end = Math.min(total, done + Math.max(0, Math.floor(n)));
      const ran = end - done;
      for (; done < end; done++) walkOne(done);
      return ran;
    },
    report(): WalkerReport {
      const pct = (count: number) => Math.round((count * 10000) / samples) / 100;
      const reach: Record<string, Record<string, number>> = {};
      ids.forEach((id, idx) => {
        cohorts.forEach((co, c) => {
          const count = stats.reach[c][idx];
          if (count > 0) (reach[id] ??= {})[co.id] = pct(count);
        });
      });
      const outs: Record<string, WalkerCohortOutcome> = {};
      cohorts.forEach((co, c) => {
        const o = outcomes[c];
        outs[co.id] = { samples, endings: Object.fromEntries(o.endings), stalled: o.stalled, terminal: o.terminal, truncated: o.truncated };
      });
      const findings = buildWalkerFindings(model, stats, { seed, samples, cohorts, engine: WALKER_ENGINE, floors: opts.floors, outcomes: outs });
      return {
        engine: WALKER_ENGINE,
        graphId: graph.graphId,
        project: graph.project,
        revision: graph.revision,
        seed,
        samples,
        maxSteps,
        cohorts,
        evidence: {
          runs: [{
            runId: `${WALKER_ENGINE}:${graph.project}/${graph.graphId}@r${graph.revision}:seed-${seed}`,
            engine: WALKER_ENGINE,
            config: cohorts.map((co) => `${co.id}=${co.policy}`).join(','),
            seeds: String(seed),
            n: total,
            graphHash: opts.graphHash ?? null,
            cohorts: cohorts.map((co) => co.id),
          }],
          reach,
          unit: `percent of walks, per cohort (${samples} walks per cohort)`,
        },
        outcomes: outs,
        findings,
        domainEvents: [...log.values()],
        truncatedAt: Object.fromEntries(truncatedAt),
        terminalAt: Object.fromEntries(terminalAt),
        gradeable: model.untypedEdges.length === 0,
        untypedEdges: model.untypedEdges,
        steps,
      };
    },
  };
}

/** Walk the whole sample in one call. Same output as any chunking of {@link createWalker}. */
export function sampleGraph(graph: StoryGraph, opts: WalkerOptions): WalkerReport {
  const w = createWalker(graph, opts);
  w.run(w.total);
  return w.report();
}
