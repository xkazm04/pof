import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { CurveDeltaSummary } from '@/components/modules/core-engine/sub_progression/curves/CurveDeltaSummary';
import { MultiCurveOverlay } from '@/components/modules/core-engine/sub_progression/curves/MultiCurveOverlay';
import { MilestoneTimeline } from '@/components/modules/core-engine/sub_progression/curves/MilestoneTimeline';
import { TimeToLevelEstimator } from '@/components/modules/core-engine/sub_progression/rewards/TimeToLevelEstimator';
import {
  LEVEL_REWARDS, calculateXpForLevel, generateChartData,
} from '@/components/modules/core-engine/sub_progression/_shared/data';
import {
  evenSpacingSuggestion, pacingModel, pacingTimeline, respaceSchedule, rewardSchedule,
} from '@/components/modules/core-engine/sub_progression/_shared/rewardPacing';
import { xpOverlaySeries } from '@/components/modules/core-engine/sub_progression/_shared/curveModel';

afterEach(cleanup);

const renderDelta = () => render(
  <CurveDeltaSummary snapshotBaseXp={100} snapshotCurveExp={1.5} liveBaseXp={200} liveCurveExp={1.5} />,
);

const rowLevels = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[data-testid="milestone-row"]')].map((el) => Number(el.dataset.level));

describe('Curves tab figures come from the one curve model', () => {
  it('case 2: Delta Summary totals are the export totals, not the 11-point sample sum', () => {
    const { container } = renderDelta();
    const text = container.textContent ?? '';
    expect(text).toContain('724,849');
    expect(text).toContain('1,449,717');
    expect(text).not.toContain('159,609');
  });

  it('case 3: Delta Summary time-to-max reads the Rewards clock (3.98h / 7.97h), not XP(50)/1000', () => {
    const { container } = renderDelta();
    const text = container.textContent ?? '';
    expect(text).toContain('3.98h');
    expect(text).toContain('7.97h');
    expect(text).not.toContain('35m');
    expect(text).not.toContain('71m');
  });

  it('case 5: the overlay XP series follows the sliders (base 300 tops out at 106,066)', () => {
    const series = xpOverlaySeries(300, 1.5);
    expect(series.at(-1)).toEqual({ x: 50, y: 106066 });
    expect(series.at(-1)!.y).toBe(calculateXpForLevel(50, 300, 1.5));
    render(<MultiCurveOverlay baseXp={300} curveExp={1.5} />);
    expect(screen.getByText('106,066')).toBeTruthy();
    expect(screen.queryByText('35,355')).toBeNull();
  });

  it('case 6: Milestone Timeline renders the live reward schedule on the Rewards clock', () => {
    const schedule = rewardSchedule(LEVEL_REWARDS);
    const { container } = render(<MilestoneTimeline baseXp={100} curveExp={1.5} schedule={schedule} />);
    const rows = [...container.querySelectorAll<HTMLElement>('[data-testid="milestone-row"]')];
    expect(rows).toHaveLength(8);
    expect(rowLevels(container)).toEqual([5, 10, 15, 20, 25, 30, 40, 50]);
    const allText = rows.map((r) => r.textContent ?? '').join(' | ');
    LEVEL_REWARDS.forEach((r) => expect(allText).toContain(r.name));
    const timeline = pacingTimeline(pacingModel(100, 1.5), schedule);
    rows.forEach((row, i) => {
      expect(row.querySelector('[data-testid="milestone-hours"]')?.textContent)
        .toBe(`${timeline[i].hoursFromStart.toFixed(1)}h`);
    });
    expect(container.textContent).not.toContain('Ultimate Power');
  });

  it('case 7: a Rewards-tab re-space moves the Curves-tab timeline', () => {
    const shipped = rewardSchedule(LEVEL_REWARDS);
    const levels = evenSpacingSuggestion(pacingModel(100, 1.5), shipped);
    const respaced = respaceSchedule(shipped, levels);
    const { container } = render(<MilestoneTimeline baseXp={100} curveExp={1.5} schedule={respaced} />);
    expect(rowLevels(container)).toEqual(levels);
    expect(rowLevels(container)).not.toEqual([5, 10, 15, 20, 25, 30, 40, 50]);
  });

  it('case 8 [guard]: the XP law, chart sampling and the Rewards clock are unchanged', () => {
    expect(calculateXpForLevel(50, 100, 1.5)).toBe(35355);
    const chart = generateChartData(100, 1.5);
    expect(chart).toHaveLength(11);
    expect(chart.at(-1)!.level).toBe(50);
    render(<TimeToLevelEstimator baseXp={100} curveExp={1.5} />);
    expect(screen.getByTestId('ttl-row-casual').textContent).toContain('7.97 days to max');
  });
});
