/**
 * The bounded walker — PoF's own state-altitude engine (§8 "State pass", §9).
 *
 * `sampleGraph(graph, opts)` walks the graph `samples` times per cohort from its declared entries,
 * over (node, state) pairs, bounded by the DECLARED variable domains only, and reports:
 *   - `evidence.reach` — percent of each cohort's walks that reached each node. Every node the run
 *     COVERS (`WalkModel.walkable()`) has a value in every cohort — an explicit `0` is a MEASURED
 *     zero (covered, never reached in the run's n walks); a node the run does not cover (an orphan,
 *     a template, an island behind an unknown edge kind) stays ABSENT (unmeasured, never 0);
 *   - outcomes per cohort (endings, stalls, structural dead ends, truncations, livelocks);
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
 * stuck, and is never reported as a softlock — unless its (node, state) is proven to lie in a closed
 * loop with no ending (`livelocked`, LIVELOCK_LEAD). Threads (`mode: 'all'`) and the inner loop
 * live in `walker-walk.ts`.
 */

import type { StoryGraph, WalkerCohort, WalkerCohortOutcome, WalkerOptions, WalkerReport } from '@/lib/story/types';
import { buildWalkModel, type WalkModel } from '@/lib/story/walker-model';
import type { DomainLog } from '@/lib/story/walker-state';
import { buildWalkerFindings } from '@/lib/story/walker-findings';
import { walkOne } from '@/lib/story/walker-walk';
import { createSink, type WalkContext } from '@/lib/story/walker-sink';

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

export function createWalker(graph: StoryGraph, opts: WalkerOptions): Walker {
  const { seed, samples } = opts;
  if (!Number.isInteger(seed)) throw new RangeError(`walker: seed must be an integer, got ${seed}`);
  if (!Number.isInteger(samples) || samples < 0) throw new RangeError(`walker: samples must be an integer >= 0, got ${samples}`);
  const cohorts = opts.cohorts && opts.cohorts.length > 0 ? opts.cohorts : DEFAULT_COHORTS;
  if (new Set(cohorts.map((c) => c.id)).size !== cohorts.length) throw new RangeError('walker: cohort ids must be unique');
  const model = buildWalkModel(graph);
  const maxSteps = opts.maxSteps ?? defaultMaxSteps(model);
  const ids = model.ids;
  const log: DomainLog = new Map();
  const ctx: WalkContext = {
    model, cohorts, samples, maxSteps, policyFor, looped: new Map(), open: new Set(),
    seedOf: (c, sample) => walkSeed(seed, c, sample),
  };
  const sink = createSink(ctx, log);
  const total = samples * cohorts.length;
  let done = 0;

  return {
    total,
    done: () => done,
    run(n: number) {
      const end = Math.min(total, done + Math.max(0, Math.floor(n)));
      const ran = end - done;
      for (; done < end; done++) walkOne(ctx, sink, done);
      return ran;
    },
    report(): WalkerReport {
      const pct = (count: number) => Math.round((count * 10000) / samples) / 100;
      // Covered (walkable) nodes get a value in every cohort, an explicit 0 when no walk reached them
      // (a MEASURED zero); anything the run does not cover stays absent (unmeasured).
      const covered = samples > 0 ? model.walkable() : new Set<string>();
      const reach: Record<string, Record<string, number>> = {};
      ids.forEach((id, idx) => {
        const measured = covered.has(id);
        cohorts.forEach((co, c) => {
          const count = sink.stats.reach[c][idx];
          if (count > 0 || measured) (reach[id] ??= {})[co.id] = pct(count);
        });
      });
      const outs: Record<string, WalkerCohortOutcome> = {};
      cohorts.forEach((co, c) => {
        const o = sink.outcomes[c];
        const out: WalkerCohortOutcome = { samples, endings: Object.fromEntries(o.endings), stalled: o.stalled, terminal: o.terminal, truncated: o.truncated };
        outs[co.id] = o.livelocked > 0 ? { ...out, livelocked: o.livelocked } : out;
      });
      const findings = buildWalkerFindings(model, sink.stats, { seed, samples, cohorts, engine: WALKER_ENGINE, floors: opts.floors, outcomes: outs });
      const livelockedAt = sink.livelockedAt.size > 0 ? { livelockedAt: Object.fromEntries(sink.livelockedAt) } : {};
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
        truncatedAt: Object.fromEntries(sink.truncatedAt),
        ...livelockedAt,
        terminalAt: Object.fromEntries(sink.terminalAt),
        gradeable: model.untypedEdges.length === 0,
        untypedEdges: model.untypedEdges,
        steps: sink.steps,
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
