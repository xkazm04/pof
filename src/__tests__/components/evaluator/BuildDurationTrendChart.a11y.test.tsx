import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { BuildDurationTrendChart } from '@/components/modules/evaluator/BuildDurationTrendChart';
import type { DurationTrendPoint } from '@/lib/ue5-bridge/build-health';

afterEach(cleanup);

const pts: DurationTrendPoint[] = [
  { buildId: 'b1', createdAt: '2026-11-01T10:00:00Z', durationMs: 40_000, status: 'success', errorCount: 0, warningCount: 0 },
  { buildId: 'b2', createdAt: '2026-11-02T10:00:00Z', durationMs: 95_000, status: 'failed', errorCount: 3, warningCount: 0 },
  { buildId: 'b3', createdAt: '2026-11-03T10:00:00Z', durationMs: 42_000, status: 'aborted', errorCount: 0, warningCount: 0 },
];

describe('BuildDurationTrendChart text alternative (pair: FrameTimeChart sr-only summary)', () => {
  it('names the build count, range and latest build in its accessible name', () => {
    const { container } = render(<BuildDurationTrendChart data={pts} baselineMs={59_000} />);
    const label = container.querySelector('svg[role="img"]')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('3 builds');
    expect(label).toContain('40s');
    expect(label).toContain('1.6m');
    expect(label).toContain('latest 42s, aborted');
  });
});
