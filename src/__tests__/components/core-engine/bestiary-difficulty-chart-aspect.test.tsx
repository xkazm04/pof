import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DifficultyChart } from '@/components/modules/core-engine/sub_bestiary/encounters/DifficultyChart';

afterEach(cleanup);

describe('DifficultyChart letterboxing', () => {
  it('svg width/height aspect equals the viewBox aspect (no blank band)', () => {
    const series = [{ label: 'A', data: [{ level: 1, value: 50 }], color: 'var(--a)' }];
    const { container } = render(<DifficultyChart series={series} />);
    const svg = container.querySelector('svg[role="img"]') as SVGElement;
    const [, , vw, vh] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number);
    const w = Number(svg.getAttribute('width'));
    const h = Number(svg.getAttribute('height'));
    const blankPx = h - w * (vh / vw);
    expect(blankPx).toBe(0);
    expect(w / h).toBeCloseTo(vw / vh, 5);
  });
});
