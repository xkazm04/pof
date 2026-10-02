import type {
  ProfilingSession, FrameTimingSample, ActorTickProfile, MemoryAllocation, GCPauseEvent,
} from '@/types/performance-profiling';

/**
 * The Debug tab's fallback when the profiler holds no session: ONE deterministic
 * ProfilingSession (same contract as a CSV capture or a generated sample), so
 * the fixture goes through the same projection as real data. Every summary
 * figure is computed from the arrays below — nothing is typed twice.
 */

const BUDGET_MS = 16.67;
const FRAME_STEP_MS = 35_000; // 12 frames downsampled across a 7-minute run
// Per-frame deltas around the thread means; each column sums to zero.
const GT = [0.3, -0.2, 0.1, -0.1, 0, 0.2, -0.3, 0.1, -0.1, 0, 0.4, -0.4];
const RT = [0.4, -0.3, 0.2, -0.2, 0.1, -0.1, 0.3, -0.4, 0, 0.2, -0.2, 0];
const GPU = [0.5, -0.4, 0.3, 2.9, -0.6, 0.2, -0.5, 0.4, -0.2, -2.4, 0.1, -0.3];
const DRAWS = [20, -15, 5, 40, -30, 10, -10, 15, -20, -5, 0, -10];

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

const frameSamples: FrameTimingSample[] = GT.map((d, i) => {
  const gameThreadMs = round2(8.4 + d);
  const renderThreadMs = round2(11.2 + RT[i]);
  const gpuMs = round2(14.8 + GPU[i]);
  return {
    frameIndex: i, timestampMs: i * FRAME_STEP_MS,
    gameThreadMs, renderThreadMs, gpuMs, rhiMs: round2(gpuMs * 0.3),
    totalFrameMs: Math.max(gameThreadMs, renderThreadMs, gpuMs),
    drawCalls: 1640 + DRAWS[i], triangleCount: (1640 + DRAWS[i]) * 730,
  };
});

const actorProfiles: ActorTickProfile[] = [
  ['AARPGEnemyCharacter', 50, 0.12, 60], ['AARPGProjectile', 120, 0.03, 60],
  ['AARPGVFXActor', 400, 0.01, 60], ['AARPGWorldItem', 150, 0.015, 10],
].map(([className, instanceCount, avgTickMs, tickFrequencyHz]) => ({
  className: className as string, instanceCount: instanceCount as number,
  avgTickMs: avgTickMs as number, maxTickMs: round2((avgTickMs as number) * 2.5),
  totalTickMs: round2((avgTickMs as number) * (instanceCount as number)),
  tickFrequencyHz: tickFrequencyHz as number, gameThreadPercent: 0,
}));

const memoryAllocations: MemoryAllocation[] = [
  ['Textures', 171, 185], ['Meshes', 95, 104], ['Audio', 38, 40],
  ['Scripts', 30.4, 33], ['Physics', 26.6, 30], ['UI', 19, 20],
].map(([category, currentMB, peakMB]) => ({
  category: category as string, currentMB: currentMB as number, peakMB: peakMB as number,
  allocationCount: Math.round((currentMB as number) * 50), allocationRateMBps: 0.4,
}));

const gcPauses: GCPauseEvent[] = [
  [12.4, 2.1, 60], [58.2, 3.8, 95], [102.6, 1.5, 55], [148.1, 4.2, 105], [192.8, 2.8, 95],
  [237.5, 1.9, 65], [283.0, 5.6, 130], [328.4, 2.4, 82], [372.9, 3.1, 97], [418.3, 1.7, 63],
].map(([atS, durationMs, freedMB]) => ({
  timestampMs: atS * 1000, durationMs, objectsCollected: freedMB * 20, memoryFreedMB: freedMB,
}));

const frameMs = frameSamples.map((f) => f.totalFrameMs);
const draws = frameSamples.map((f) => f.drawCalls);
const gcMs = gcPauses.map((g) => g.durationMs);
const sortedFrames = [...frameMs].sort((a, b) => a - b);
const avgFrameMs = round2(mean(frameMs));

export const SAMPLE_SESSION: ProfilingSession = {
  id: 'debug-tab-sample',
  name: 'Debug tab sample (combat, 50 enemies)',
  source: 'manual',
  projectPath: '',
  importedAt: '2026-01-01T00:00:00.000Z',
  durationMs: 420_000,
  frameCount: frameSamples.length,
  summary: {
    avgFrameMs,
    p99FrameMs: sortedFrames[sortedFrames.length - 1],
    minFPS: round2(1000 / Math.max(...frameMs)),
    avgFPS: round2(1000 / avgFrameMs),
    maxFPS: round2(1000 / Math.min(...frameMs)),
    avgGameThreadMs: round2(mean(frameSamples.map((f) => f.gameThreadMs))),
    avgRenderThreadMs: round2(mean(frameSamples.map((f) => f.renderThreadMs))),
    avgGpuMs: round2(mean(frameSamples.map((f) => f.gpuMs))),
    totalDrawCalls: draws.reduce((s, d) => s + d, 0),
    avgDrawCallsPerFrame: Math.round(mean(draws)),
    peakDrawCalls: Math.max(...draws),
    totalMemoryMB: round2(memoryAllocations.reduce((s, m) => s + m.currentMB, 0)),
    peakMemoryMB: round2(memoryAllocations.reduce((s, m) => s + m.peakMB, 0)),
    gcPauseCount: gcPauses.length,
    avgGcPauseMs: round2(mean(gcMs)),
    maxGcPauseMs: Math.max(...gcMs),
    totalGcTimeMs: round2(gcMs.reduce((s, d) => s + d, 0)),
    frameBudgetMs: BUDGET_MS,
    budgetHitRate: round2((frameMs.filter((t) => t <= BUDGET_MS).length / frameMs.length) * 100),
  },
  frameSamples,
  actorProfiles,
  memoryAllocations,
  gcPauses,
};
