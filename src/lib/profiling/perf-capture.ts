import { PERF_CAPTURE_EVENTS } from '@/types/observation';

// ── Perf capture: read a bracketed capture, gate it against the noise floor ─────
//
// The analysis half (`csv-parser.ts`) reads "stat dump" rows and, when it finds no
// per-frame data, synthesizes frames from aggregates with Math.random. It cannot supply
// the per-frame times a noise-floor gate needs, so this file reads the CSV Profiler's own
// per-frame format instead (UE 5.8 CsvProfiler.cpp: first column `EVENTS`, one column per
// stat including `FrameTime`, then a repeated header row and `[Key],Value` metadata rows).
//
// The gate answers one question: did the candidate build get slower than the baseline
// build by more than the machine's own run-to-run spread? A bare difference of two
// medians cannot answer that; two runs of the SAME build already differ by the spread.
// So the verdict is relative to the spread measured over N baseline runs (the A/A spread):
//
//   pass          the regression, even at its noise-adjusted upper bound, is within tolerance
//   fail          the regression is above the spread AND above tolerance
//   unverifiable  anything else: the noise is too large to tell. Never pass, never fail.
//
// Pure. No engine, no I/O.

// ── Reading a capture ───────────────────────────────────────────────────────────

export interface PerfFrame {
  /** Event strings recorded on this frame, `##timestamp` suffix removed. */
  events: string[];
  frameMs: number;
}

export type FrameCsvResult =
  | { ok: true; frames: PerfFrame[] }
  | { ok: false; reason: string };

function normalizeEvent(raw: string): string {
  const cut = raw.indexOf('##');
  return (cut === -1 ? raw : raw.slice(0, cut)).trim();
}

/** True when `event` is `name`, or `Category/name` (the profiler prefixes non-global categories). */
function isEvent(event: string, name: string): boolean {
  return event === name || event.endsWith(`/${name}`);
}

/**
 * Parse a CSV Profiler capture into per-frame rows. Stops at the summary header row or the
 * first `[Metadata]` row the profiler appends. Rows whose FrameTime is not a number are
 * skipped, not coerced.
 */
export function parseFrameCsv(csv: string): FrameCsvResult {
  const lines = csv.split(/\r?\n/);
  const headerAt = lines.findIndex((l) => l.trim().length > 0);
  if (headerAt === -1) return { ok: false, reason: 'empty capture' };

  const header = lines[headerAt].split(',').map((h) => h.trim());
  const frameCol = header.findIndex((h) => h.toLowerCase() === 'frametime');
  if (frameCol === -1) return { ok: false, reason: 'no FrameTime column: not a CSV Profiler per-frame capture' };
  const eventsCol = header.findIndex((h) => h.toUpperCase() === 'EVENTS');

  const frames: PerfFrame[] = [];
  for (let i = headerAt + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cells = line.split(',');
    const first = (cells[0] ?? '').trim();
    if (first.toUpperCase() === 'EVENTS' || first.startsWith('[')) break;
    const frameMs = Number.parseFloat(cells[frameCol] ?? '');
    if (!Number.isFinite(frameMs)) continue;
    const eventCell = eventsCol === -1 ? '' : (cells[eventsCol] ?? '');
    frames.push({
      events: eventCell.split(';').map(normalizeEvent).filter((e) => e.length > 0),
      frameMs,
    });
  }
  if (frames.length === 0) return { ok: false, reason: 'no frame rows after the header' };
  return { ok: true, frames };
}

export type SplitStatus = 'ok' | 'no-window-start' | 'no-window-end';

export interface SplitCapture {
  status: SplitStatus;
  /** Frame times before the window-start event: the baseline phase, recorded first. */
  baselineMs: number[];
  /** Frame times from the window-start event up to (not including) the window-end event. */
  windowMs: number[];
  /** Frames inside the two ranges dropped for a non-positive FrameTime (the profiler's first frame). */
  droppedFrames: number;
}

/**
 * Split a capture at the scenario's own markers. Without a window-start event nothing is
 * guessed: the window is empty and the status says why. A missing window-end leaves a
 * truncated window and a status the gate refuses.
 */
export function splitPerfCapture(
  frames: readonly PerfFrame[],
  events: { windowStart: string; windowEnd: string } = PERF_CAPTURE_EVENTS,
): SplitCapture {
  const has = (f: PerfFrame, name: string) => f.events.some((e) => isEvent(e, name));
  const start = frames.findIndex((f) => has(f, events.windowStart));
  if (start === -1) return { status: 'no-window-start', baselineMs: [], windowMs: [], droppedFrames: 0 };

  let end = -1;
  for (let i = start + 1; i < frames.length; i++) {
    if (has(frames[i], events.windowEnd)) { end = i; break; }
  }
  const status: SplitStatus = end === -1 ? 'no-window-end' : 'ok';
  const windowEnd = end === -1 ? frames.length : end;

  let droppedFrames = 0;
  const keep = (slice: readonly PerfFrame[]): number[] => {
    const out: number[] = [];
    for (const f of slice) {
      if (f.frameMs > 0) out.push(f.frameMs); else droppedFrames++;
    }
    return out;
  };
  return { status, baselineMs: keep(frames.slice(0, start)), windowMs: keep(frames.slice(start, windowEnd)), droppedFrames };
}

// ── Statistics ──────────────────────────────────────────────────────────────────

/** Percentile `p` (0-100) by linear interpolation between order statistics. NaN on empty input. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (Math.min(100, Math.max(0, p)) / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

function median(values: readonly number[]): number {
  return percentile(values, 50);
}

function range(values: readonly number[]): number {
  return Math.max(...values) - Math.min(...values);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ── The noise-floor gate ────────────────────────────────────────────────────────

export type PerfGateVerdict = 'pass' | 'fail' | 'unverifiable';

export interface PerfGateOptions {
  /** Percentiles gated, each against its own A/A spread. p95 is the one that matters; p50 rides along. */
  percentiles?: readonly number[];
  /** Runs required on EACH side: fewer cannot estimate a spread. Default 3. */
  minRuns?: number;
  /** Frames required in each run's window. Default 300 (5 s at the fixed 60 fps step). */
  minFramesPerRun?: number;
  /** Smallest regression worth gating, as a fraction of the baseline value. Default 0.05. */
  toleranceFraction?: number;
  /** Floor under the tolerance: below this the frame timer's own resolution decides. Default 0.1 ms. */
  toleranceFloorMs?: number;
}

export interface PerfGateMetric {
  percentile: number;
  /** Median over the baseline runs of that run's percentile. */
  baselineMs: number;
  candidateMs: number;
  /** candidate - baseline: positive is slower. */
  effectMs: number;
  /** A/A spread: max - min of the percentile across the baseline runs. */
  spreadMs: number;
  toleranceMs: number;
  verdict: PerfGateVerdict;
  reason: string;
}

export interface PerfGateResult {
  verdict: PerfGateVerdict;
  reason: string;
  metrics: PerfGateMetric[];
  baselineRuns: number;
  candidateRuns: number;
}

const DEFAULTS = {
  percentiles: [50, 95] as readonly number[],
  minRuns: 3,
  minFramesPerRun: 300,
  toleranceFraction: 0.05,
  toleranceFloorMs: 0.1,
};

function unverifiable(reason: string, baselineRuns: number, candidateRuns: number): PerfGateResult {
  return { verdict: 'unverifiable', reason, metrics: [], baselineRuns, candidateRuns };
}

function judgeMetric(p: number, base: readonly number[], cand: readonly number[], fraction: number, floorMs: number): PerfGateMetric {
  const baselineMs = median(base);
  const candidateMs = median(cand);
  const effectMs = candidateMs - baselineMs;
  const spreadMs = range(base);
  const toleranceMs = Math.max(floorMs, fraction * baselineMs);

  let verdict: PerfGateVerdict;
  let reason: string;
  if (effectMs > spreadMs && effectMs > toleranceMs) {
    verdict = 'fail';
    reason = `p${p} is ${round3(effectMs)} ms slower, above the A/A spread (${round3(spreadMs)} ms) and the tolerance (${round3(toleranceMs)} ms)`;
  } else if (effectMs + spreadMs <= toleranceMs) {
    verdict = 'pass';
    reason = `p${p} change ${round3(effectMs)} ms plus A/A spread ${round3(spreadMs)} ms stays within the ${round3(toleranceMs)} ms tolerance`;
  } else {
    verdict = 'unverifiable';
    reason = `p${p} change ${round3(effectMs)} ms cannot be told from the A/A spread of ${round3(spreadMs)} ms at a ${round3(toleranceMs)} ms tolerance`;
  }
  return { percentile: p, baselineMs: round3(baselineMs), candidateMs: round3(candidateMs), effectMs: round3(effectMs), spreadMs: round3(spreadMs), toleranceMs: round3(toleranceMs), verdict, reason };
}

/**
 * Gate `candidateRuns` against `baselineRuns`; each run is the per-frame times (ms) of one
 * capture window. A fail on any percentile fails the gate; otherwise any unverifiable
 * percentile makes it unverifiable; pass needs every percentile to pass.
 */
export function gatePerfRuns(
  baselineRuns: readonly (readonly number[])[],
  candidateRuns: readonly (readonly number[])[],
  options: PerfGateOptions = {},
): PerfGateResult {
  const o = { ...DEFAULTS, ...options };
  const nb = baselineRuns.length;
  const nc = candidateRuns.length;

  if (nb < o.minRuns || nc < o.minRuns) {
    return unverifiable(`need at least ${o.minRuns} runs per side to estimate an A/A spread (baseline ${nb}, candidate ${nc})`, nb, nc);
  }
  const short = (runs: readonly (readonly number[])[]) => runs.findIndex((r) => r.length < o.minFramesPerRun);
  const sb = short(baselineRuns);
  const sc = short(candidateRuns);
  if (sb !== -1) return unverifiable(`baseline run ${sb} holds ${baselineRuns[sb].length} frames, under the ${o.minFramesPerRun} needed`, nb, nc);
  if (sc !== -1) return unverifiable(`candidate run ${sc} holds ${candidateRuns[sc].length} frames, under the ${o.minFramesPerRun} needed`, nb, nc);

  const metrics = o.percentiles.map((p) => judgeMetric(
    p,
    baselineRuns.map((r) => percentile(r, p)),
    candidateRuns.map((r) => percentile(r, p)),
    o.toleranceFraction,
    o.toleranceFloorMs,
  ));

  const failed = metrics.filter((m) => m.verdict === 'fail');
  const unclear = metrics.filter((m) => m.verdict === 'unverifiable');
  if (failed.length > 0) return { verdict: 'fail', reason: failed.map((m) => m.reason).join('; '), metrics, baselineRuns: nb, candidateRuns: nc };
  if (unclear.length > 0) return { verdict: 'unverifiable', reason: unclear.map((m) => m.reason).join('; '), metrics, baselineRuns: nb, candidateRuns: nc };
  return { verdict: 'pass', reason: metrics.map((m) => m.reason).join('; '), metrics, baselineRuns: nb, candidateRuns: nc };
}

// ── From CSV text to a verdict ──────────────────────────────────────────────────

export interface CaptureGateOptions extends PerfGateOptions {
  /** Frames the window should hold (`PerfCapturePlan.windowFrames`). Absent: not checked. */
  expectedWindowFrames?: number;
  /** Frames a run's window may differ from the plan by. At a fixed step this should be ~1. Default 2. */
  windowFrameTolerance?: number;
}

export interface CaptureRunSummary {
  side: 'baseline' | 'candidate';
  index: number;
  baselinePhaseFrames: number;
  windowFrames: number;
  /** Median frame time of the baseline phase, a drift indicator only: it never enters the verdict. */
  baselinePhaseP50Ms: number | null;
}

export interface CaptureGateResult extends PerfGateResult {
  runs: CaptureRunSummary[];
}

/**
 * Parse each capture, cut it at the scenario's markers, and gate the windows. A capture that
 * cannot be read, carries no window markers, or holds a window of the wrong length makes the
 * whole result unverifiable and names the run: a half-read comparison is not a comparison.
 */
export function gateCaptureCsvs(
  baselineCsvs: readonly string[],
  candidateCsvs: readonly string[],
  options: CaptureGateOptions = {},
): CaptureGateResult {
  const { expectedWindowFrames, windowFrameTolerance = 2, ...gateOptions } = options;
  const runs: CaptureRunSummary[] = [];
  const problems: string[] = [];

  const read = (csvs: readonly string[], side: 'baseline' | 'candidate'): number[][] => {
    const windows: number[][] = [];
    csvs.forEach((csv, index) => {
      const parsed = parseFrameCsv(csv);
      if (!parsed.ok) { problems.push(`${side} run ${index}: ${parsed.reason}`); return; }
      const split = splitPerfCapture(parsed.frames);
      if (split.status !== 'ok') { problems.push(`${side} run ${index}: ${split.status}`); return; }
      if (expectedWindowFrames !== undefined && Math.abs(split.windowMs.length - expectedWindowFrames) > windowFrameTolerance) {
        problems.push(`${side} run ${index}: window holds ${split.windowMs.length} frames, plan expects ${expectedWindowFrames} (truncated or not at the fixed step)`);
        return;
      }
      runs.push({
        side,
        index,
        baselinePhaseFrames: split.baselineMs.length,
        windowFrames: split.windowMs.length,
        baselinePhaseP50Ms: split.baselineMs.length > 0 ? round3(median(split.baselineMs)) : null,
      });
      windows.push(split.windowMs);
    });
    return windows;
  };

  const baselineWindows = read(baselineCsvs, 'baseline');
  const candidateWindows = read(candidateCsvs, 'candidate');
  if (problems.length > 0) {
    return { ...unverifiable(problems.join('; '), baselineCsvs.length, candidateCsvs.length), runs };
  }
  return { ...gatePerfRuns(baselineWindows, candidateWindows, gateOptions), runs };
}
