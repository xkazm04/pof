/**
 * T-c (perf capture with a fixed timestep), SIMULATED half.
 *
 * Arm A: a single-run median compare, flagged by the rule `compareSessions` already uses
 * (a change above NOISE_FRACTION of the larger magnitude is a verdict).
 * Arm B: the A/A-spread + percentile gate (`gatePerfRuns`), five runs per side.
 * Ablation A5: arm A's rule over the median of five run medians, to separate "more runs"
 * from "gate relative to the spread".
 *
 * Everything here runs on SIMULATED frame times (see simulated-frames.ts). It measures the
 * gate's logic against a stated noise model. It does not measure a real engine: the real
 * half needs a branch build with an injected 2 ms busy tick, five runs each, and is
 * `unmeasurable` from here.
 */
import { describe, it, expect } from 'vitest';
import { NOISE_FRACTION } from '@/lib/profiling/session-compare';
import { gatePerfRuns, percentile, type PerfGateVerdict } from '@/lib/profiling/perf-capture';
import { simulateRun, SIM_DEFAULTS, type SimParams } from './simulated-frames';

const INJECT_MS = 2;
const RUNS = 5;

/** The numbers the report quotes, printed so a rerun shows them. */
function report(...parts: unknown[]): void {
  // eslint-disable-next-line no-console -- measurement report, not diagnostics
  console.log(...parts);
}

const median = (xs: number[]) => percentile(xs, 50);
const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs);

interface Pair {
  base: number[][];
  cand: number[][];
}

/** One comparison: five baseline runs and five candidate runs, every run its own seed. */
function makePair(pairIndex: number, params: Partial<SimParams>, injectMs: number, salt: number): Pair {
  const seedOf = (side: number, run: number) => salt * 1_000_003 + pairIndex * 1009 + side * 101 + run * 7 + 1;
  return {
    base: Array.from({ length: RUNS }, (_, r) => simulateRun(seedOf(0, r), params)),
    cand: Array.from({ length: RUNS }, (_, r) => simulateRun(seedOf(1, r), params, injectMs)),
  };
}

/** Arm A: first run of each side, flag a slower median above the existing 1% rule. */
function armA(p: Pair): boolean {
  const b = median(p.base[0]);
  const c = median(p.cand[0]);
  return c - b > NOISE_FRACTION * Math.max(b, c);
}

/** Ablation: the same 1% rule over the median of the five run medians. */
function armA5(p: Pair): boolean {
  const b = median(p.base.map(median));
  const c = median(p.cand.map(median));
  return c - b > NOISE_FRACTION * Math.max(b, c);
}

/** Ablation: arm A with B's own tolerance (5%) as its threshold, to see whether a looser fixed rule is enough. */
function armALoose(p: Pair): boolean {
  const b = median(p.base[0]);
  const c = median(p.cand[0]);
  return c - b > 0.05 * Math.max(b, c);
}

function armB(p: Pair): PerfGateVerdict {
  return gatePerfRuns(p.base, p.cand).verdict;
}

interface ArmTally {
  pairs: number;
  aFlags: number;
  a5Flags: number;
  aLooseFlags: number;
  bFail: number;
  bUnverifiable: number;
  bPass: number;
  /** Largest A/A spread of the per-run median frame time over the baseline runs, ms. */
  maxMedianSpreadMs: number;
}

function tally(count: number, params: Partial<SimParams>, injectMs: number, salt: number): ArmTally {
  const t: ArmTally = { pairs: count, aFlags: 0, a5Flags: 0, aLooseFlags: 0, bFail: 0, bUnverifiable: 0, bPass: 0, maxMedianSpreadMs: 0 };
  for (let i = 0; i < count; i++) {
    const p = makePair(i, params, injectMs, salt);
    if (armA(p)) t.aFlags++;
    if (armA5(p)) t.a5Flags++;
    if (armALoose(p)) t.aLooseFlags++;
    const v = armB(p);
    if (v === 'fail') t.bFail++; else if (v === 'unverifiable') t.bUnverifiable++; else t.bPass++;
    t.maxMedianSpreadMs = Math.max(t.maxMedianSpreadMs, range(p.base.map(median)));
  }
  return t;
}

describe('T-c perf capture, SIMULATED frame times (no engine ran)', () => {
  // Primary parameters, fixed before any run: SIM_DEFAULTS (8 ms median, 2% run-to-run drift).
  const FIVE_AA = tally(5, {}, 0, 11);
  const INJECTED = tally(20, {}, INJECT_MS, 23);

  it('SIMULATED floor: arm B flags none of five A/A pairs; arm A does not hold the floor', () => {
    report('T-c SIMULATED five A/A pairs', JSON.stringify(FIVE_AA));
    expect(FIVE_AA.bFail).toBe(0);
    expect(FIVE_AA.aFlags).toBeGreaterThan(0);
  });

  it('SIMULATED detection: arm B catches the injected 2 ms regression', () => {
    report('T-c SIMULATED injected 2 ms, 20 pairs', JSON.stringify(INJECTED));
    expect(INJECTED.bFail).toBe(INJECTED.pairs);
  });

  it('SIMULATED falsifier: the A/A spread of median frame time stays under half the injected delta', () => {
    const half = INJECT_MS / 2;
    report('T-c SIMULATED falsifier', JSON.stringify({ halfDeltaMs: half, maxMedianSpreadMs: Math.max(FIVE_AA.maxMedianSpreadMs, INJECTED.maxMedianSpreadMs) }));
    expect(FIVE_AA.maxMedianSpreadMs).toBeLessThan(half);
    expect(INJECTED.maxMedianSpreadMs).toBeLessThan(half);
  });

  // 30 pairs per cell keeps the committed suite quick; PERF_CAPTURE_SWEEP=1 reruns it at 100
  // (the numbers the report quotes). Same seeds, so the 30 are the first 30 of the 100.
  const SWEEP_PAIRS = process.env.PERF_CAPTURE_SWEEP ? 100 : 30;

  it('SIMULATED sweep: where the falsifier trips, arm B degrades to unverifiable instead of flagging', () => {
    const rows = [0.005, 0.01, 0.02, 0.05, 0.1, 0.15].map((sigmaRun, i) => {
      const aa = tally(SWEEP_PAIRS, { sigmaRun }, 0, 100 + i);
      const inj = tally(SWEEP_PAIRS, { sigmaRun }, INJECT_MS, 200 + i);
      return {
        sigmaRun,
        falsifierTripped: aa.maxMedianSpreadMs > INJECT_MS / 2,
        aaMaxMedianSpreadMs: Math.round(aa.maxMedianSpreadMs * 1000) / 1000,
        aa: { A: aa.aFlags, A5: aa.a5Flags, Aloose: aa.aLooseFlags, Bfail: aa.bFail, Bunver: aa.bUnverifiable, Bpass: aa.bPass },
        inj: { A: inj.aFlags, A5: inj.a5Flags, Aloose: inj.aLooseFlags, Bfail: inj.bFail, Bunver: inj.bUnverifiable, Bpass: inj.bPass },
      };
    });
    report(`T-c SIMULATED sweep (${SWEEP_PAIRS} A/A pairs + ${SWEEP_PAIRS} injected pairs per row)\n` + rows.map((r) => JSON.stringify(r)).join('\n'));
    for (const r of rows) {
      // Arm B is not perfectly safe on A/A (a few percent at most), and arm A never is.
      expect(r.aa.Bfail / SWEEP_PAIRS).toBeLessThanOrEqual(0.1);
      expect(r.aa.A).toBeGreaterThan(r.aa.Bfail);
      // Past the falsifier the gate refuses to answer rather than answering wrongly.
      if (r.falsifierTripped) expect(r.aa.Bunver / SWEEP_PAIRS).toBeGreaterThan(0.5);
    }
    expect(rows.some((r) => r.falsifierTripped)).toBe(true);
    expect(rows.some((r) => !r.falsifierTripped)).toBe(true);
  }, 120_000);

  it('SIMULATED effect size: what the gate can and cannot see below the 2 ms the test injects', () => {
    const rows = [0.25, 0.5, 1, 2].map((inject, i) => {
      const inj = tally(SWEEP_PAIRS, {}, inject, 300 + i);
      return { injectMs: inject, pct: Math.round((inject / SIM_DEFAULTS.medianMs) * 1000) / 10, A: inj.aFlags, Aloose: inj.aLooseFlags, Bfail: inj.bFail, Bunver: inj.bUnverifiable, Bpass: inj.bPass };
    });
    report(`T-c SIMULATED effect size at sigmaRun ${SIM_DEFAULTS.sigmaRun} (${SWEEP_PAIRS} pairs per row)\n` + rows.map((r) => JSON.stringify(r)).join('\n'));
    // A regression under the 5% tolerance (0.25 ms) is called a failure only when noise lifts
    // the observed difference over both bars: some of the time, never most of the time.
    expect(rows[0].Bfail / SWEEP_PAIRS).toBeLessThan(0.25);
    // Above the tolerance (>= 0.5 ms) a regression is never passed; from 1 ms it is always seen.
    for (const r of rows.slice(1)) expect(r.Bpass).toBe(0);
    expect(rows[2].Bfail).toBe(SWEEP_PAIRS);
    expect(rows[3].Bfail).toBe(SWEEP_PAIRS);
  }, 120_000);
});
