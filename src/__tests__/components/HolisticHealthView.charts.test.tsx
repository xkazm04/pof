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

describe('LineChartSimple — gridlines mean a value', () => {
  function geometry(values: number[]) {
    const { container } = render(
      <LineChartSimple data={values.map((v, i) => ({ label: `S${i}`, value: v }))} color="currentColor" />,
    );
    const tops = [...container.querySelectorAll<HTMLElement>('div.absolute.border-t')].map((el) => parseFloat(el.style.top));
    const cys = [...container.querySelectorAll('circle')].map((c) => parseFloat(c.getAttribute('cy') ?? 'NaN'));
    const result = { topGrid: Math.min(...tops), cys, text: container.textContent ?? '' };
    cleanup();
    return result;
  }

  it('a score of 100 sits on the top gridline', () => {
    const g = geometry([55, 100]);
    expect(g.cys[1]).toBe(g.topGrid);
  });

  it('a latest score of 60 is not on the top gridline, which is labelled 100', () => {
    const g = geometry([55, 60]);
    expect(g.cys[1]).toBeGreaterThan(g.topGrid);
    expect(g.text).toContain('100');
  });
});
