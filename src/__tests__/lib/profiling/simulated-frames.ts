/**
 * SIMULATED per-frame timings for the perf-capture gate tests. No engine produced any of
 * this: every number is drawn from a seeded model, so a result built on it measures the
 * GATE's logic against a stated noise model, never the real run-to-run spread of a PoF
 * boot. The model parameters are guesses and are named as such in the tests that use them.
 *
 * Frame time = runBase * lognormal(sigmaFrame) + an occasional hitch + an injected cost.
 * runBase = medianMs * exp(sigmaRun * N(0,1)) is drawn once per run: the machine-state
 * drift between two boots of the SAME build (thermal, background load, cache). That
 * run-level term is what a bare median difference mistakes for an effect.
 */

export interface SimParams {
  /** Median frame time of a typical run, ms. A guess for a `-nullrhi -benchmark` boot. */
  medianMs: number;
  /** Per-frame lognormal sigma. */
  sigmaFrame: number;
  /** Per-run lognormal sigma on the median: the A/A drift. */
  sigmaRun: number;
  /** Probability a frame carries a hitch. */
  hitchProb: number;
  hitchLoMs: number;
  hitchHiMs: number;
  frames: number;
}

export const SIM_DEFAULTS: SimParams = {
  medianMs: 8,
  sigmaFrame: 0.15,
  sigmaRun: 0.02,
  hitchProb: 0.01,
  hitchLoMs: 8,
  hitchHiMs: 24,
  frames: 1800,
};

/** mulberry32: a small seeded PRNG so every simulated number is reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(next: () => number): number {
  const u = Math.max(next(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
}

/** One run's per-frame times (ms). `injectMs` is added to every frame: the busy-tick regression. */
export function simulateRun(seed: number, params: Partial<SimParams> = {}, injectMs = 0): number[] {
  const p = { ...SIM_DEFAULTS, ...params };
  const next = rng(seed);
  const runBase = p.medianMs * Math.exp(p.sigmaRun * normal(next));
  const out: number[] = [];
  for (let i = 0; i < p.frames; i++) {
    let t = runBase * Math.exp(p.sigmaFrame * normal(next));
    if (next() < p.hitchProb) t += p.hitchLoMs + (p.hitchHiMs - p.hitchLoMs) * next();
    out.push(t + injectMs);
  }
  return out;
}

/**
 * Wrap per-frame times in the CSV Profiler's per-frame layout (an EVENTS column, FrameTime,
 * a repeated header row, `[Key],Value` metadata rows). The baseline phase and window are cut
 * with the three event names, as the real capture would be if the scenario emitted them.
 */
export function simulateCaptureCsv(
  baselineMs: readonly number[],
  windowMs: readonly number[],
  events: { baselineStart: string; windowStart: string; windowEnd: string },
  opts: { omit?: 'windowStart' | 'windowEnd' } = {},
): string {
  const rows: string[] = ['EVENTS,FrameTime,GameThreadTime'];
  const row = (ev: string, ms: number) => `${ev},${ms.toFixed(4)},${(ms * 0.8).toFixed(4)}`;
  baselineMs.forEach((ms, i) => rows.push(row(i === 0 ? events.baselineStart : '', ms)));
  windowMs.forEach((ms, i) => rows.push(row(i === 0 && opts.omit !== 'windowStart' ? `${events.windowStart}##0.5` : '', ms)));
  if (opts.omit !== 'windowEnd') rows.push(row(events.windowEnd, 8));
  rows.push('EVENTS,FrameTime,GameThreadTime');
  rows.push('[HasHeaderRowAtEnd],1');
  rows.push('[Commandline],-csvStartOnEvent=PoFScenarioSettle');
  return rows.join('\n');
}
