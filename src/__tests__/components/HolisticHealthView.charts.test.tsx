/**
 * scan-sweep Lane B (holistic-quality-overview): the Project Health charts expose a
 * text alternative, plot gridlines that mean a value, and say so when they are empty.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  BarChartSimple, LineChartSimple, AreaChartSimple, BurndownChart,
} from '@/components/modules/evaluator/HolisticHealthView/charts';
import type { BurnChartPoint } from '@/types/project-health';

afterEach(cleanup);

const BURN: BurnChartPoint[] = [
  { weekLabel: 'W1', weekStart: '2026-01-01', remaining: 90, completed: 10, idealRemaining: 80 },
  { weekLabel: 'W2', weekStart: '2026-01-08', remaining: 70, completed: 30, idealRemaining: 60 },
];

function charts() {
  return [
    <BarChartSimple key="b" data={[{ label: 'W1', value: 3 }, { label: 'W2', value: 7 }]} color="currentColor" />,
    <LineChartSimple key="l" data={[{ label: 'S1', value: 55 }, { label: 'S2', value: 60 }]} color="currentColor" />,
    <AreaChartSimple key="a" data={[{ label: 'W1', completed: 10, ideal: 20 }, { label: 'W2', completed: 30, ideal: 40 }]} total={100} />,
    <BurndownChart key="d" data={BURN} total={100} />,
  ];
}

describe('Project Health charts — text alternatives', () => {
  it('every chart has a role=img with a non-empty aria-label naming its last value', () => {
    const lastValues = ['7', '60', '30', '70'];
    const named = charts().map((el, i) => {
      const { container } = render(el);
      const img = container.querySelector('[role="img"]');
      cleanup();
      const label = img?.getAttribute('aria-label') ?? '';
      return label.length > 0 && label.includes(lastValues[i]);
    });
    expect(named.filter(Boolean).length).toBe(4);
  });
});
