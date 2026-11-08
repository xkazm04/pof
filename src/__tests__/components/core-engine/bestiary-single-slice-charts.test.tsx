import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { DeathCausesPie } from '@/components/modules/core-engine/sub_bestiary/encounters/KillDeathStats';
import { CardsMetric } from '@/components/modules/core-engine/sub_bestiary/metrics/CardsMetric';
import { DifficultyChart } from '@/components/modules/core-engine/sub_bestiary/encounters/DifficultyChart';

afterEach(cleanup);

/** A drawable slice is a circle, or a path whose arc start and end differ. */
function drawable(el: Element): boolean {
  if (el.tagName.toLowerCase() === 'circle') return true;
  const nums = (el.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  // pie: M cx cy L x1 y1 A rx ry rot large sweep x2 y2 Z
  const x1 = nums[2], y1 = nums[3], x2 = nums[9], y2 = nums[10];
  return Math.abs(x1 - x2) > 1e-6 || Math.abs(y1 - y2) > 1e-6;
}

describe('degenerate chart inputs', () => {
  it('death-cause pie with one 100% cause paints a visible circle', () => {
    const { container } = render(<DeathCausesPie causes={[{ cause: 'Sword', pct: 100, color: 'var(--x)' }]} />);
    const marks = Array.from(container.querySelectorAll('svg > path, svg > circle'));
    expect(marks.length).toBe(1);
    expect(marks.every(drawable)).toBe(true);
  });

  it('role donut with one 100% role paints a visible ring', () => {
    const { container } = render(<CardsMetric roleSegments={[{ role: 'melee', pct: 100, color: 'var(--x)' }]} />);
    const marks = Array.from(container.querySelectorAll('svg > path, svg > circle'));
    expect(marks.length).toBe(1);
    expect(marks[0].tagName.toLowerCase()).toBe('circle');
  });

  it('difficulty chart tolerates an empty series on hover', () => {
    const series = [{ label: 'Empty', data: [], color: 'var(--x)' }];
    const { container } = render(<DifficultyChart series={series} />);
    const rect = container.querySelectorAll('svg rect')[container.querySelectorAll('svg rect').length - 1];
    expect(() => fireEvent.mouseEnter(rect)).not.toThrow();
  });
});
