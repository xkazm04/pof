import { describe, it, expect } from 'vitest';
import {
  projectDebugSnapshot, deriveCrashRisk, DEBUG_BUDGETS,
} from '@/components/modules/core-engine/sub_debug/_shared/debugSnapshot';
import { SAMPLE_SESSION } from '@/components/modules/core-engine/sub_debug/_shared/sampleSession';
import type { ProfilingSession, ProfilingSummary, MemoryAllocation } from '@/types/performance-profiling';

/**
 * Acceptance for scan-sweep --challenge card debug-performance/A: every perf
 * panel of the Debug tab is a projection of ONE ProfilingSession, so a metric
 * can no longer carry two hand-typed values on one screen, and every verdict
 * (bound-by thread, GC interval, crash overall) is derived, never typed.
 */

function withSummary(patch: Partial<ProfilingSummary>): ProfilingSession {
  return { ...SAMPLE_SESSION, summary: { ...SAMPLE_SESSION.summary, ...patch } };
}

const alloc = (category: string, currentMB: number): MemoryAllocation => ({
  category, currentMB, peakMB: currentMB, allocationCount: 1, allocationRateMBps: 0,
});

describe('projectDebugSnapshot', () => {
  it('frame is the critical path of the parallel threads (max), not their sum', () => {
    const snap = projectDebugSnapshot(withSummary({
      avgGameThreadMs: 4.2, avgRenderThreadMs: 6.1, avgGpuMs: 8.3, frameBudgetMs: 16.67,
    }), null);
    expect(snap.frame.criticalPathMs).toBe(8.3);
    expect(snap.frame.boundBy).toBe('gpu');
    expect(snap.frame.criticalPathMs).not.toBeCloseTo(23.0);
  });

  it('draw calls: gauge, stat group and panel total are one number', () => {
    const snap = projectDebugSnapshot(SAMPLE_SESSION, null);
    const expected = SAMPLE_SESSION.summary.avgDrawCallsPerFrame;
    const gauge = snap.gauges.find((g) => g.label === 'DRAW_CALLS');
    const stat = snap.stats.flatMap((g) => g.stats).find((s) => s.label === 'Draw Calls');
    expect(gauge?.current).toBe(expected);
    expect(stat?.value).toBe(expected);
    expect(snap.drawCalls.perFrame).toBe(expected);
  });

  it('memory comes from the capture allocations and no VRAM gauge is invented', () => {
    const session: ProfilingSession = {
      ...SAMPLE_SESSION,
      memoryAllocations: [alloc('Textures', 171), alloc('Meshes', 95), alloc('Audio', 38)],
    };
    const snap = projectDebugSnapshot(session, null);
    expect(snap.memory.totalMB).toBe(304);
    const pctSum = snap.memory.slices.reduce((s, sl) => s + sl.pct, 0);
    expect(Math.abs(pctSum - 100)).toBeLessThanOrEqual(1);
    expect(snap.memory.headroomMB).toBe(snap.memory.budgetMB - 304);
    expect(snap.gauges.map((g) => g.label)).not.toContain('VRAM_ALLOC');
    expect(snap.gauges.some((g) => /VRAM/i.test(g.label))).toBe(false);
  });

  it('GC interval and warn count are derived from the pauses', () => {
    const pause = (timestampMs: number, durationMs: number) => ({
      timestampMs, durationMs, objectsCollected: 100, memoryFreedMB: 1,
    });
    const session: ProfilingSession = {
      ...SAMPLE_SESSION,
      gcPauses: [pause(12400, 2.1), pause(58200, 3.8), pause(102600, 5.6)],
    };
    const snap = projectDebugSnapshot(session, null);
    expect(snap.gc.avgIntervalS).toBe(45.1);
    expect(snap.gc.warnThresholdMs).toBe(5);
    expect(snap.gc.warnCount).toBe(1);
  });
});

describe('deriveCrashRisk', () => {
  it('a 9 ms GC pause is a RED factor and makes the overall HIGH', () => {
    const risk = deriveCrashRisk({ ...SAMPLE_SESSION.summary, maxGcPauseMs: 9 }, DEBUG_BUDGETS);
    expect(risk.factors.find((f) => f.factor === 'GC Pause')?.risk).toBe('RED');
    expect(risk.overall).toBe('HIGH');
  });

  it('every factor GREEN -> overall LOW (overall is the worst factor)', () => {
    const risk = deriveCrashRisk({
      ...SAMPLE_SESSION.summary,
      maxGcPauseMs: 2,
      budgetHitRate: 98,
      totalMemoryMB: DEBUG_BUDGETS.memoryMB * 0.5,
    }, DEBUG_BUDGETS);
    expect(risk.factors.length).toBeGreaterThan(0);
    expect(risk.factors.every((f) => f.risk === 'GREEN')).toBe(true);
    expect(risk.overall).toBe('LOW');
  });
});
