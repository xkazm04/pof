/**
 * `computeVelocityForecast` had zero production callers — a wall-clock-sensitive
 * function whose only exercise was a flaky test. It is now the engine behind the
 * health trend's "days to healthy at the current rate" line, fed by the series
 * the chart already draws, anchored to the last session's timestamp (not the
 * wall clock), and qualified by the same provenance as the trend itself.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { HealthTrendChart } from '@/components/modules/game-director/HealthTrendChart';
import {
  forecastHealthRecovery, HEALTHY_SCORE,
} from '@/components/modules/game-director/HealthTrendChart/helpers';
import type { HealthTrendPoint } from '@/lib/game-director-db';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 10, 9, 0, 0);

function point(over: Partial<HealthTrendPoint> & { overallScore: number; dayOffset: number }): HealthTrendPoint {
  const { dayOffset, ...rest } = over;
  return {
    sessionId: `s-${dayOffset}`,
    sessionName: `Session ${dayOffset}`,
    createdAt: new Date(T0 + dayOffset * DAY).toISOString(),
    findingsCount: 3,
    criticalCount: 0,
    regressionCount: 0,
    source: 'simulated',
    ...rest,
  };
}

describe('forecastHealthRecovery', () => {
  it('projects days to a healthy score at the observed rate', () => {
    // 60 → 70 across 4 days = 2.5 points/day; 10 points to 80 → 4 days.
    const result = forecastHealthRecovery([
      point({ overallScore: 60, dayOffset: 0 }),
      point({ overallScore: 70, dayOffset: 4 }),
    ]);
    expect(result).not.toBeNull();
    expect(result!.velocityPerDay).toBe(2.5);
    expect(result!.daysRemaining).toBe(4);
  });

  it('is anchored to the last session, not the wall clock — repeated calls agree', () => {
    const data = [
      point({ overallScore: 60, dayOffset: 0 }),
      point({ overallScore: 70, dayOffset: 4 }),
    ];
    const runs = Array.from({ length: 20 }, () => forecastHealthRecovery(data));
    expect(new Set(runs.map(r => JSON.stringify(r))).size).toBe(1);
  });

  it('refuses to project where a projection would be a guess', () => {
    // Already healthy.
    expect(forecastHealthRecovery([
      point({ overallScore: 80, dayOffset: 0 }),
      point({ overallScore: HEALTHY_SCORE + 10, dayOffset: 3 }),
    ])).toBeNull();
    // Declining.
    expect(forecastHealthRecovery([
      point({ overallScore: 70, dayOffset: 0 }),
      point({ overallScore: 55, dayOffset: 3 }),
    ])).toBeNull();
    // Flat.
    expect(forecastHealthRecovery([
      point({ overallScore: 55, dayOffset: 0 }),
      point({ overallScore: 55, dayOffset: 3 }),
    ])).toBeNull();
    // Single session.
    expect(forecastHealthRecovery([point({ overallScore: 40, dayOffset: 0 })])).toBeNull();
    // Unparseable timestamp.
    expect(forecastHealthRecovery([
      { ...point({ overallScore: 40, dayOffset: 0 }), createdAt: 'not-a-date' },
      point({ overallScore: 60, dayOffset: 3 }),
    ])).toBeNull();
  });
});

describe('HealthTrendChart renders the projection with the trend’s provenance', () => {
  const rising = [
    point({ overallScore: 60, dayOffset: 0 }),
    point({ overallScore: 70, dayOffset: 4 }),
  ];

  it('shows the projection and marks it simulated when every session is', () => {
    render(<HealthTrendChart data={rising} />);
    expect(screen.getByText(/Simulated projection/)).toBeTruthy();
    expect(screen.getByText('4 days')).toBeTruthy();
    const svg = screen.getByRole('img');
    expect(svg.getAttribute('aria-label')).toContain('reaches a healthy 80 in about 4 days');
  });

  it('drops the simulated qualifier once the series is measured', () => {
    render(
      <HealthTrendChart data={rising.map(p => ({ ...p, source: 'external' as const }))} />,
    );
    expect(screen.queryByText(/Simulated projection/)).toBeNull();
    expect(screen.getByText('4 days')).toBeTruthy();
  });

  it('renders no projection line when the trend cannot support one', () => {
    render(
      <HealthTrendChart data={[
        point({ overallScore: 70, dayOffset: 0 }),
        point({ overallScore: 55, dayOffset: 4 }),
      ]} />,
    );
    expect(screen.queryByText(/points\/day/)).toBeNull();
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toContain('healthy');
  });
});
