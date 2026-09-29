import type {
  ProfilingSession, ProfilingSummary, ProfileSourceType, TriageResult, FrameTimingSample,
} from '@/types/performance-profiling';

/**
 * The Debug tab's one seam: every perf panel is a view over `DebugSnapshot`,
 * projected from ONE ProfilingSession (the newest profiler session, or the
 * SAMPLE_SESSION fixture). A metric has one value on screen by construction,
 * and every verdict (bound-by thread, GC interval, crash overall) is derived.
 */

export type ThreadId = 'game' | 'render' | 'gpu';
export type RiskLevel = 'GREEN' | 'AMBER' | 'RED';
export type CrashOverall = 'LOW' | 'MEDIUM' | 'HIGH';

export interface GaugeReading { label: string; current: number; target: number; unit: string }
export interface StatEntry { label: string; value: number; digits: number; unit?: string; sparkline: number[] }
export interface StatGroup { group: string; stats: StatEntry[] }
export interface RiskFactor { factor: string; risk: RiskLevel; detail: string }
export interface CrashRisk { overall: CrashOverall; factors: RiskFactor[]; notInCapture: string[] }

export interface DebugSnapshot {
  gauges: GaugeReading[];
  frame: {
    threads: Array<{ id: ThreadId; label: string; ms: number }>;
    criticalPathMs: number; boundBy: ThreadId; budgetMs: number; avgFPS: number;
  };
  memory: {
    slices: Array<{ label: string; mb: number; pct: number }>;
    totalMB: number; peakMB: number; budgetMB: number; headroomMB: number;
  };
  gc: {
    events: Array<{ timeS: number; durationMs: number; objectsCollected: number; freedMB: number; warn: boolean }>;
    avgIntervalS: number | null; warnCount: number; warnThresholdMs: number;
  };
  drawCalls: { perFrame: number; peak: number; budget: number; series: number[] };
  stats: StatGroup[];
  crash: CrashRisk;
  recommendations: string[];
}

/** Where the snapshot came from — shown in the tab header, never 'LIVE'. */
export type DebugProvenance =
  | { kind: 'sample' }
  | { kind: 'session'; source: ProfileSourceType; name: string; importedAt: string };

/** Targets are budgets (design intent), not measurements — the only typed numbers. */
export const DEBUG_BUDGETS = { memoryMB: 512, drawCalls: 2000, actors: 1000, gcWarnMs: 5 } as const;
export type DebugBudgets = typeof DEBUG_BUDGETS;

/** What a profiler capture does not contain; shown as absent, never invented. */
export const NOT_IN_CAPTURE = ['VRAM', 'Null access checks', 'Thread contention', 'Asset load failures'];

const SPARK_POINTS = 60;
const RISK_RANK: Record<RiskLevel, number> = { GREEN: 0, AMBER: 1, RED: 2 };
const OVERALL: Record<RiskLevel, CrashOverall> = { GREEN: 'LOW', AMBER: 'MEDIUM', RED: 'HIGH' };
const FIX_HINT: Record<string, string> = {
  'Memory Headroom': 'Trim the largest allocation category or raise the memory budget deliberately.',
  'GC Pause': 'Pool short-lived actors / VFX so collection has less to sweep per pause.',
  'Frame Budget': 'Profile the bound-by thread first — it sets the frame, the others run in parallel.',
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Header text for a provenance: a generated sample is never called a capture. */
export function provenanceLabel(p: DebugProvenance): string {
  if (p.kind === 'sample') return 'SAMPLE DATA';
  if (p.source === 'manual') return `GENERATED SAMPLE: ${p.name}`;
  return `CAPTURE: ${p.name} · ${p.importedAt.slice(0, 16).replace('T', ' ')}`;
}

/** Crash risk: every factor is a threshold over the summary; overall = the worst factor. */
export function deriveCrashRisk(summary: ProfilingSummary, budgets: DebugBudgets = DEBUG_BUDGETS): CrashRisk {
  const freeMB = round2(budgets.memoryMB - summary.totalMemoryMB);
  const freePct = (freeMB / budgets.memoryMB) * 100;
  const gcMax = summary.maxGcPauseMs;
  const factors: RiskFactor[] = [
    {
      factor: 'Memory Headroom',
      risk: freePct > 25 ? 'GREEN' : freePct > 10 ? 'AMBER' : 'RED',
      detail: `${freeMB}MB free of ${budgets.memoryMB}MB budget (${freePct.toFixed(0)}%)`,
    },
    {
      factor: 'GC Pause',
      risk: gcMax < budgets.gcWarnMs ? 'GREEN' : gcMax < budgets.gcWarnMs * 1.6 ? 'AMBER' : 'RED',
      detail: `max ${gcMax}ms over ${summary.gcPauseCount} pauses (warn at ${budgets.gcWarnMs}ms)`,
    },
    {
      factor: 'Frame Budget',
      risk: summary.budgetHitRate >= 95 ? 'GREEN' : summary.budgetHitRate >= 80 ? 'AMBER' : 'RED',
      detail: `${summary.budgetHitRate}% of frames within ${summary.frameBudgetMs}ms`,
    },
  ];
  const worst = factors.reduce<RiskLevel>((w, f) => (RISK_RANK[f.risk] > RISK_RANK[w] ? f.risk : w), 'GREEN');
  return { overall: OVERALL[worst], factors, notInCapture: NOT_IN_CAPTURE };
}

function projectFrame(s: ProfilingSummary): DebugSnapshot['frame'] {
  const threads: DebugSnapshot['frame']['threads'] = [
    { id: 'game', label: 'GameThread', ms: s.avgGameThreadMs },
    { id: 'render', label: 'RenderThread', ms: s.avgRenderThreadMs },
    { id: 'gpu', label: 'GPU', ms: s.avgGpuMs },
  ];
  // The threads run in parallel: the frame is their critical path (max), as the
  // profiler's own totalFrameMs is (sample-generator.ts, csv-parser.ts).
  const bound = threads.reduce((a, b) => (b.ms > a.ms ? b : a));
  return { threads, criticalPathMs: round2(bound.ms), boundBy: bound.id, budgetMs: s.frameBudgetMs, avgFPS: s.avgFPS };
}

function projectMemory(session: ProfilingSession, budgetMB: number): DebugSnapshot['memory'] {
  const allocs = session.memoryAllocations;
  const totalMB = round2(allocs.reduce((sum, a) => sum + a.currentMB, 0));
  const peakMB = round2(allocs.reduce((sum, a) => sum + a.peakMB, 0));
  const slices = allocs.map((a) => ({
    label: a.category, mb: a.currentMB, pct: totalMB > 0 ? round1((a.currentMB / totalMB) * 100) : 0,
  }));
  return { slices, totalMB, peakMB, budgetMB, headroomMB: round2(budgetMB - totalMB) };
}

function projectGc(session: ProfilingSession, warnMs: number): DebugSnapshot['gc'] {
  const pauses = [...session.gcPauses].sort((a, b) => a.timestampMs - b.timestampMs);
  const gaps = pauses.slice(1).map((p, i) => p.timestampMs - pauses[i].timestampMs);
  const events = pauses.map((p) => ({
    timeS: round1(p.timestampMs / 1000), durationMs: p.durationMs,
    objectsCollected: p.objectsCollected, freedMB: p.memoryFreedMB, warn: p.durationMs >= warnMs,
  }));
  return {
    events,
    avgIntervalS: gaps.length > 0 ? round1(gaps.reduce((s, g) => s + g, 0) / gaps.length / 1000) : null,
    warnCount: events.filter((e) => e.warn).length,
    warnThresholdMs: warnMs,
  };
}

function projectStats(session: ProfilingSession, memory: DebugSnapshot['memory'], actors: number): StatGroup[] {
  const s = session.summary;
  const tail = session.frameSamples.slice(-SPARK_POINTS);
  const series = (pick: (f: FrameTimingSample) => number) => tail.map(pick);
  const avgTriangles = tail.length > 0 ? tail.reduce((sum, f) => sum + f.triangleCount, 0) / tail.length : 0;
  return [
    { group: 'Frame', stats: [
      { label: 'FPS', value: s.avgFPS, digits: 1, unit: 'fps', sparkline: series((f) => round1(1000 / f.totalFrameMs)) },
      { label: 'Frame Time', value: s.avgFrameMs, digits: 2, unit: 'ms', sparkline: series((f) => f.totalFrameMs) },
      { label: 'P99 Frame', value: s.p99FrameMs, digits: 2, unit: 'ms', sparkline: [] },
    ] },
    { group: 'Game Thread', stats: [
      { label: 'Game Thread', value: s.avgGameThreadMs, digits: 1, unit: 'ms', sparkline: series((f) => f.gameThreadMs) },
      { label: 'Ticking Actors', value: actors, digits: 0, sparkline: [] },
    ] },
    { group: 'Render Thread', stats: [
      { label: 'Draw Calls', value: s.avgDrawCallsPerFrame, digits: 0, sparkline: series((f) => f.drawCalls) },
      { label: 'Triangles', value: round2(avgTriangles / 1e6), digits: 2, unit: 'M', sparkline: series((f) => f.triangleCount) },
      { label: 'Render Time', value: s.avgRenderThreadMs, digits: 1, unit: 'ms', sparkline: series((f) => f.renderThreadMs) },
    ] },
    { group: 'GPU', stats: [
      { label: 'GPU Time', value: s.avgGpuMs, digits: 1, unit: 'ms', sparkline: series((f) => f.gpuMs) },
    ] },
    { group: 'Memory', stats: [
      { label: 'Tracked', value: memory.totalMB, digits: 0, unit: 'MB', sparkline: [] },
      { label: 'Peak', value: memory.peakMB, digits: 0, unit: 'MB', sparkline: [] },
    ] },
  ];
}

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

/** Project one ProfilingSession (+ its triage, when run) into every perf panel's data. */
export function projectDebugSnapshot(
  session: ProfilingSession, triage: TriageResult | null, budgets: DebugBudgets = DEBUG_BUDGETS,
): DebugSnapshot {
  const s = session.summary;
  const memory = projectMemory(session, budgets.memoryMB);
  const actors = session.actorProfiles.reduce((sum, a) => sum + a.instanceCount, 0);
  // Crash risk reads the same memory total the memory panel shows.
  const crash = deriveCrashRisk({ ...s, totalMemoryMB: memory.totalMB }, budgets);
  const recommendations = triage && triage.findings.length > 0
    ? [...triage.findings].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]).slice(0, 3).map((f) => f.title)
    : crash.factors.filter((f) => f.risk !== 'GREEN').map((f) => FIX_HINT[f.factor]);
  return {
    gauges: [
      { label: 'GAME_THREAD', current: s.avgGameThreadMs, target: s.frameBudgetMs, unit: 'ms' },
      { label: 'DRAW_CALLS', current: s.avgDrawCallsPerFrame, target: budgets.drawCalls, unit: '' },
      { label: 'MEMORY', current: memory.totalMB, target: budgets.memoryMB, unit: 'MB' },
      { label: 'TICKING_ACTORS', current: actors, target: budgets.actors, unit: '' },
    ],
    frame: projectFrame(s),
    memory,
    gc: projectGc(session, budgets.gcWarnMs),
    drawCalls: {
      perFrame: s.avgDrawCallsPerFrame, peak: s.peakDrawCalls, budget: budgets.drawCalls,
      series: session.frameSamples.slice(-SPARK_POINTS).map((f) => f.drawCalls),
    },
    stats: projectStats(session, memory, actors),
    crash,
    recommendations,
  };
}
