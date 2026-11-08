import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { PowerCurveDangerZones } from '@/components/modules/core-engine/sub_progression/analysis/PowerCurveDangerZones';
import { XpSourceBreakdown } from '@/components/modules/core-engine/sub_progression/builds/XpSourceBreakdown';
import { MultiCurveOverlay } from '@/components/modules/core-engine/sub_progression/curves/MultiCurveOverlay';

afterEach(cleanup);

describe('charts of authored sample figures say so', () => {
  it('Danger Zones: its shipped series is sample data, not the live curve', () => {
    render(<PowerCurveDangerZones />);
    expect(screen.getByText(/sample figures/i)).toBeTruthy();
  });

  it('Danger Zones: real series passed in are not labelled sample', () => {
    render(<PowerCurveDangerZones playerPower={[10, 20]} enemyDifficulty={[12, 18]} />);
    expect(screen.queryByText(/sample figures/i)).toBeNull();
  });

  it('XP Source Breakdown: the fixed split is sample data', () => {
    render(<XpSourceBreakdown />);
    expect(screen.getByText(/sample figures/i)).toBeTruthy();
  });

  it('Multi-Curve Overlay: names the one series the sliders move', () => {
    render(<MultiCurveOverlay baseXp={100} curveExp={1.5} />);
    expect(screen.getByText(/only xp required follows the sliders/i)).toBeTruthy();
  });
});
