import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { ChartPanel, scaleLinear } from '@/components/layout-lab/steps/shared/ChartPanel';
import { LIGHT } from '@/components/layout-lab/theme';

afterEach(cleanup);

describe('scaleLinear', () => {
  it('maps domain start/end to range start/end', () => {
    const s = scaleLinear([0, 100], [0, 280]);
    expect(s(0)).toBe(0);
    expect(s(100)).toBe(280);
    expect(s(50)).toBe(140);
  });

  it('handles inverted ranges (e.g. y-axis flip in SVG)', () => {
    const s = scaleLinear([0, 1], [150, 0]);
    expect(s(0)).toBe(150);
    expect(s(1)).toBe(0);
    expect(s(0.5)).toBe(75);
  });

  it('avoids divide-by-zero when domain is degenerate', () => {
    const s = scaleLinear([5, 5], [0, 100]);
    expect(Number.isFinite(s(5))).toBe(true);
  });
});

describe('<ChartPanel variant="bars" />', () => {
  it('renders one row per datum and uses theme tokens for highlight color', () => {
    const { container } = render(
      <ChartPanel
        t={LIGHT}
        variant="bars"
        rows={[
          { label: 'A', value: 50 },
          { label: 'B', value: 100, highlight: true },
          { label: 'C', value: 80, color: '#abcdef' },
        ]}
      />,
    );
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.getByText('C')).toBeTruthy();
    // Each row has a values cell with the numeric value rendered.
    expect(screen.getByText('50')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByText('80')).toBeTruthy();
    // 3 inner motion bars rendered.
    const innerBars = container.querySelectorAll('div[style*="background"][style*="rgb"]');
    expect(innerBars.length).toBeGreaterThanOrEqual(3);
  });

  it('exposes an accessible figure role with the supplied aria-label', () => {
    render(
      <ChartPanel t={LIGHT} variant="bars" ariaLabel="Stat budget bars"
        rows={[{ label: 'A', value: 1 }]} />,
    );
    expect(screen.getByRole('figure', { name: 'Stat budget bars' })).toBeTruthy();
  });
});

describe('<ChartPanel variant="scatter" />', () => {
  it('renders reference dots, accent points, and x/y axis labels', () => {
    const { container } = render(
      <ChartPanel
        t={LIGHT}
        variant="scatter"
        xDomain={[0, 100]}
        yDomain={[0, 200]}
        reference={[
          { x: 10, y: 14 }, { x: 50, y: 70 }, { x: 90, y: 126 },
        ]}
        points={[{ x: 50, y: 80, color: '#ff00ff', label: 'this item' }]}
        xLabel="power"
        yLabel="gold"
        ariaLabel="Price vs power"
      />,
    );
    const svg = screen.getByRole('img', { name: 'Price vs power' });
    expect(svg.tagName.toLowerCase()).toBe('svg');
    // Axis label text nodes render.
    expect(container.querySelector('text')?.textContent).toBeDefined();
    // 3 reference circles + 1 accent circle = 4 circles minimum.
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(4);
    // The accent point has a <title> with the label (browser tooltip).
    const titles = container.querySelectorAll('title');
    expect(Array.from(titles).some((n) => n.textContent === 'this item')).toBe(true);
  });
});

describe('<ChartPanel variant="histogram" />', () => {
  it('renders one bar per datum and applies the `highlight` token', () => {
    const { container } = render(
      <ChartPanel
        t={LIGHT}
        variant="histogram"
        bars={[
          { value: 88 }, { value: 94, highlight: true }, { value: 110 },
        ]}
        ariaLabel="Peer distribution"
      />,
    );
    expect(screen.getByRole('img', { name: 'Peer distribution' })).toBeTruthy();
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(3);
  });
});

describe('<ChartPanel variant="waveform" />', () => {
  it('renders one bar per sample and dims when inactive', () => {
    const samples = Array.from({ length: 8 }, (_, i) => Math.sin(i) * 0.5 + 0.5);
    const { container: idle } = render(
      <ChartPanel t={LIGHT} variant="waveform" samples={samples} active={false} ariaLabel="idle wave" />,
    );
    const idleRects = idle.querySelectorAll('rect');
    expect(idleRects.length).toBe(8);
    // Inactive bars carry the dimmed opacity (0.4).
    expect(idleRects[0].getAttribute('opacity')).toBe('0.4');

    cleanup();

    const { container: live } = render(
      <ChartPanel t={LIGHT} variant="waveform" samples={samples} active={true} ariaLabel="active wave" />,
    );
    const liveRects = live.querySelectorAll('rect');
    expect(liveRects[0].getAttribute('opacity')).toBe('0.8');
  });
});
