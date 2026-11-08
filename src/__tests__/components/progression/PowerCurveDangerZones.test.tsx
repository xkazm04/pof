import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PowerCurveDangerZones } from '@/components/modules/core-engine/sub_progression/analysis/PowerCurveDangerZones';
import { STATUS_TOKENS } from '@/lib/status-token';

afterEach(cleanup);

describe('PowerCurveDangerZones', () => {
  it('renders the real-data chart with polylines and no NaN coordinates', () => {
    const { container } = render(<PowerCurveDangerZones />);
    expect(container.querySelectorAll('polyline').length).toBeGreaterThan(0);
    expect(container.innerHTML).not.toContain('NaN');
  });

  it('shows an empty state for empty series instead of NaN coordinates', () => {
    const { container } = render(
      <PowerCurveDangerZones playerPower={[]} enemyDifficulty={[]} />,
    );
    expect(container.querySelector('[role="status"]')).toBeTruthy();
    expect(container.querySelector('polyline')).toBeNull();
    expect(container.innerHTML).not.toContain('NaN');
  });

  it('shows an empty state for a single-point series (avoids divide-by-zero on x)', () => {
    const { container } = render(
      <PowerCurveDangerZones playerPower={[100]} enemyDifficulty={[120]} />,
    );
    expect(container.querySelector('[role="status"]')).toBeTruthy();
    expect(container.querySelector('polyline')).toBeNull();
    expect(container.innerHTML).not.toContain('NaN');
  });

  it('shows an empty state for an all-zero series (no spread on y)', () => {
    const { container } = render(
      <PowerCurveDangerZones playerPower={[0, 0, 0]} enemyDifficulty={[0, 0, 0]} />,
    );
    expect(container.querySelector('[role="status"]')).toBeTruthy();
    expect(container.querySelector('polyline')).toBeNull();
    expect(container.innerHTML).not.toContain('NaN');
  });
});

describe('PowerCurveDangerZones zone bands', () => {
  it('a Hard final sample colours the last band; it is not dropped', () => {
    const { container } = render(<PowerCurveDangerZones playerPower={[100, 100, 10]} enemyDifficulty={[100, 100, 100]} />);
    const fills = Array.from(container.querySelectorAll('rect')).map((r) => r.getAttribute('fill'));
    expect(fills).toHaveLength(2);
    expect(fills[0]).toBe(STATUS_TOKENS.warn.color);
    expect(fills[1]).toBe(STATUS_TOKENS.bad.color);
  });
});
