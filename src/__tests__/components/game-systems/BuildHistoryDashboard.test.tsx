import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BuildHistoryDashboard } from '@/components/modules/game-systems/BuildHistoryDashboard';

afterEach(cleanup);

/** Mock the single composite /api/packaging/history?action=dashboard GET the dashboard fires on mount. */
function mockHistory() {
  const dashboard = {
    builds: [],
    stats: {
      totalBuilds: 4,
      successCount: 3,
      failedCount: 1,
      successRate: 75,
      avgDurationMs: 120000,
      avgSizeBytes: 1073741824,
      latestVersion: '0.2.0',
      platforms: [
        { platform: 'Windows', total: 4, success: 3, failed: 1, successRate: 75, avgDurationMs: 120000, avgSizeBytes: 1073741824, latestSizeBytes: 1073741824 },
      ],
    },
    trend: [],
    version: '0.2.0',
    parsed: { major: 0, minor: 2, patch: 0 },
  };
  globalThis.fetch = vi.fn().mockImplementation(() => {
    const body = { success: true, data: dashboard };
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  }) as unknown as typeof fetch;
}

describe('BuildHistoryDashboard — accessibility', () => {
  it('marks the platform success-rate bar as a labelled progressbar', async () => {
    mockHistory();
    render(<BuildHistoryDashboard />);
    const bar = await screen.findByRole('progressbar', { name: /Windows success rate/i });
    expect(bar.getAttribute('aria-valuenow')).toBe('75');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });
});
