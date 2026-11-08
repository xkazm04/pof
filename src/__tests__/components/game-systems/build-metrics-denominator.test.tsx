/**
 * The Metrics row may not contradict the rate the server computed.
 *
 * `getBuildStats` rates success over DECIDED builds (success + failed); a cancelled
 * build is in neither half. The cards used to pair that rate with `x/totalBuilds`
 * and derive "Failed %" as `100 - successRate`, so an all-cancelled day read
 * "0/2 · Failed 0 · 100%".
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { BuildStats } from '@/lib/packaging/build-history-store';
import { MetricsRow } from '@/components/modules/game-systems/BuildHistoryDashboard/MetricsRow';

afterEach(cleanup);

function stats(over: Partial<BuildStats>): BuildStats {
  return {
    totalBuilds: 0, successCount: 0, failedCount: 0, decidedBuilds: 0, cancelledCount: 0,
    successRate: 0, avgDurationMs: null, avgSizeBytes: null, latestVersion: null, platforms: [],
    ...over,
  } as BuildStats;
}

function text(s: BuildStats): string {
  const { container } = render(<MetricsRow stats={s} version="0.1.0" nextVersion="0.1.1" onBump={() => {}} />);
  return container.textContent ?? '';
}

describe('MetricsRow keeps one denominator', () => {
  it('pairs the success rate with decided builds, not total', () => {
    const t = text(stats({ totalBuilds: 9, successCount: 7, decidedBuilds: 7, cancelledCount: 2, successRate: 100 }));
    expect(t).toContain('7/7');
    expect(t).not.toContain('7/9');
    expect(t).toContain('2 cancelled');
  });

  it('never claims a failure share when nothing was decided', () => {
    const t = text(stats({ totalBuilds: 2, cancelledCount: 2, decidedBuilds: 0, successRate: 0 }));
    expect(t).not.toContain('100%');
    expect(t).not.toMatch(/\b0%/);
  });

  it('reports the real failure share of decided builds', () => {
    const t = text(stats({ totalBuilds: 6, successCount: 3, failedCount: 1, decidedBuilds: 4, cancelledCount: 2, successRate: 75 }));
    expect(t).toContain('75%');
    expect(t).toContain('25%');
    expect(t).toContain('3/4');
  });
});
