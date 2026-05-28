import { describe, it, expect } from 'vitest';
import {
  summarizeBuilds,
  buildDurationTrend,
  rankTargetsByDuration,
  detectRegressions,
  type HealthBuild,
} from '@/lib/ue5-bridge/build-health';

// ── Test fixtures ────────────────────────────────────────────────────────────

/** Build a HealthBuild with sensible defaults; override per case. */
function mk(overrides: Partial<HealthBuild> & { createdAt: string }): HealthBuild {
  return {
    buildId: overrides.buildId ?? `b-${overrides.createdAt}`,
    targetName: overrides.targetName ?? 'PoF',
    configuration: overrides.configuration ?? 'Development',
    platform: overrides.platform ?? 'Win64',
    status: overrides.status ?? 'success',
    durationMs: 'durationMs' in overrides ? overrides.durationMs! : 10_000,
    errorCount: overrides.errorCount ?? 0,
    warningCount: overrides.warningCount ?? 0,
    createdAt: overrides.createdAt,
  };
}

/** A chronological series of N stable successful builds, ~10s each, day apart. */
function stableSeries(n: number): HealthBuild[] {
  return Array.from({ length: n }, (_, i) =>
    mk({ createdAt: `2026-05-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`, durationMs: 10_000 }),
  );
}

// ── summarizeBuilds ──────────────────────────────────────────────────────────

describe('summarizeBuilds', () => {
  it('returns an empty summary for no builds', () => {
    const s = summarizeBuilds([]);
    expect(s.totalBuilds).toBe(0);
    expect(s.successRate).toBe(0);
    expect(s.avgDurationMs).toBeNull();
    expect(s.medianDurationMs).toBeNull();
    expect(s.totalErrors).toBe(0);
  });

  it('counts statuses and computes success rate', () => {
    const builds = [
      mk({ createdAt: '2026-05-01T10:00:00Z', status: 'success' }),
      mk({ createdAt: '2026-05-02T10:00:00Z', status: 'success' }),
      mk({ createdAt: '2026-05-03T10:00:00Z', status: 'failed', errorCount: 3 }),
      mk({ createdAt: '2026-05-04T10:00:00Z', status: 'aborted' }),
    ];
    const s = summarizeBuilds(builds);
    expect(s.totalBuilds).toBe(4);
    expect(s.successCount).toBe(2);
    expect(s.failedCount).toBe(1);
    expect(s.abortedCount).toBe(1);
    expect(s.successRate).toBe(50); // 2 of 4
    expect(s.totalErrors).toBe(3);
  });

  it('averages and medians duration over successful builds only', () => {
    const builds = [
      mk({ createdAt: '2026-05-01T10:00:00Z', status: 'success', durationMs: 10_000 }),
      mk({ createdAt: '2026-05-02T10:00:00Z', status: 'success', durationMs: 20_000 }),
      mk({ createdAt: '2026-05-03T10:00:00Z', status: 'success', durationMs: 30_000 }),
      // failed build's (huge) duration must not skew the average
      mk({ createdAt: '2026-05-04T10:00:00Z', status: 'failed', durationMs: 999_000 }),
    ];
    const s = summarizeBuilds(builds);
    expect(s.avgDurationMs).toBe(20_000);
    expect(s.medianDurationMs).toBe(20_000);
  });
});

// ── buildDurationTrend ───────────────────────────────────────────────────────

describe('buildDurationTrend', () => {
  it('returns points in chronological (oldest-first) order', () => {
    const builds = [
      mk({ createdAt: '2026-05-03T10:00:00Z', buildId: 'c' }),
      mk({ createdAt: '2026-05-01T10:00:00Z', buildId: 'a' }),
      mk({ createdAt: '2026-05-02T10:00:00Z', buildId: 'b' }),
    ];
    const trend = buildDurationTrend(builds);
    expect(trend.map((p) => p.buildId)).toEqual(['a', 'b', 'c']);
  });

  it('omits builds without a recorded duration', () => {
    const builds = [
      mk({ createdAt: '2026-05-01T10:00:00Z', buildId: 'a', durationMs: 5_000 }),
      mk({ createdAt: '2026-05-02T10:00:00Z', buildId: 'b', durationMs: null }),
    ];
    const trend = buildDurationTrend(builds);
    expect(trend.map((p) => p.buildId)).toEqual(['a']);
  });
});

// ── rankTargetsByDuration ────────────────────────────────────────────────────

describe('rankTargetsByDuration', () => {
  it('groups by target and ranks slowest-average first', () => {
    const builds = [
      mk({ createdAt: '2026-05-01T10:00:00Z', targetName: 'Fast', durationMs: 5_000 }),
      mk({ createdAt: '2026-05-02T10:00:00Z', targetName: 'Fast', durationMs: 7_000 }),
      mk({ createdAt: '2026-05-03T10:00:00Z', targetName: 'Slow', durationMs: 60_000 }),
    ];
    const ranked = rankTargetsByDuration(builds);
    expect(ranked[0].targetName).toBe('Slow');
    expect(ranked[0].avgDurationMs).toBe(60_000);
    expect(ranked[0].maxDurationMs).toBe(60_000);
    expect(ranked[1].targetName).toBe('Fast');
    expect(ranked[1].avgDurationMs).toBe(6_000);
    expect(ranked[1].builds).toBe(2);
  });

  it('computes per-target success rate and last status', () => {
    const builds = [
      mk({ createdAt: '2026-05-01T10:00:00Z', targetName: 'PoF', status: 'success' }),
      mk({ createdAt: '2026-05-02T10:00:00Z', targetName: 'PoF', status: 'failed' }),
    ];
    const ranked = rankTargetsByDuration(builds);
    expect(ranked[0].successRate).toBe(50);
    expect(ranked[0].lastStatus).toBe('failed'); // most recent by createdAt
  });
});

// ── detectRegressions ────────────────────────────────────────────────────────

describe('detectRegressions', () => {
  it('reports nothing without enough baseline samples', () => {
    const builds = stableSeries(2); // too few priors
    expect(detectRegressions(builds)).toEqual([]);
  });

  it('reports nothing when the latest build matches the baseline', () => {
    expect(detectRegressions(stableSeries(6))).toEqual([]);
  });

  it('flags a duration spike on the latest build vs the rolling baseline', () => {
    const builds = [
      ...stableSeries(5), // ~10s baseline
      mk({ createdAt: '2026-05-06T10:00:00Z', buildId: 'spike', durationMs: 30_000 }),
    ];
    const alerts = detectRegressions(builds);
    const dur = alerts.find((a) => a.kind === 'duration');
    expect(dur).toBeDefined();
    expect(dur!.buildId).toBe('spike');
    expect(dur!.baseline).toBe(10_000);
    expect(dur!.current).toBe(30_000);
    expect(dur!.deltaPct).toBe(200); // 30s is 200% over 10s
    expect(dur!.severity).toBe('critical');
  });

  it('does not flag a duration improvement (latest faster than baseline)', () => {
    const builds = [
      ...stableSeries(5),
      mk({ createdAt: '2026-05-06T10:00:00Z', durationMs: 4_000 }),
    ];
    expect(detectRegressions(builds).some((a) => a.kind === 'duration')).toBe(false);
  });

  it('flags an error-count spike on the latest build vs the rolling baseline', () => {
    const builds = [
      ...stableSeries(5), // 0 errors baseline
      mk({ createdAt: '2026-05-06T10:00:00Z', buildId: 'errspike', status: 'failed', errorCount: 7 }),
    ];
    const alerts = detectRegressions(builds);
    const errs = alerts.find((a) => a.kind === 'errors');
    expect(errs).toBeDefined();
    expect(errs!.buildId).toBe('errspike');
    expect(errs!.current).toBe(7);
    expect(errs!.baseline).toBe(0);
    expect(errs!.severity).toBe('critical');
  });

  it('respects a custom duration spike factor', () => {
    const builds = [
      ...stableSeries(5),
      mk({ createdAt: '2026-05-06T10:00:00Z', durationMs: 12_000 }), // 20% slower
    ];
    // default factor (1.3) would NOT flag 20%; a 1.1 factor should
    expect(detectRegressions(builds).some((a) => a.kind === 'duration')).toBe(false);
    expect(
      detectRegressions(builds, { durationSpikeFactor: 1.1 }).some((a) => a.kind === 'duration'),
    ).toBe(true);
  });
});
