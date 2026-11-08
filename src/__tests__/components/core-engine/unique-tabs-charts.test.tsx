import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DonutChart } from '@/components/modules/core-engine/unique-tabs/charts';
import { ACCENT_CYAN, ACCENT_EMERALD } from '@/lib/chart-colors';

afterEach(cleanup);

/** The outer arc of a segment path: "M x1 y1 A r r 0 large 1 x2 y2 ...". */
function outerArc(d: string) {
  const n = d.split(/[\sMALZ]+/).filter(Boolean).map(Number);
  return { start: [n[0], n[1]], end: [n[7], n[8]] };
}
const span = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('DonutChart — every segment is drawn', () => {
  it('a single 100% segment is a visible ring, not a zero-length arc SVG drops', () => {
    const { container } = render(<DonutChart segments={[{ label: 'All', pct: 100, color: ACCENT_CYAN }]} />);
    const d = container.querySelector('path')!.getAttribute('d')!;
    const { start, end } = outerArc(d);
    // Coincident arc endpoints are omitted by the SVG renderer (SVG 1.1 F.6.2).
    expect(span(start, end)).toBeGreaterThan(0.001);
  });

  it('[control] a 60/40 split draws two arcs with distinct endpoints', () => {
    const { container } = render(
      <DonutChart segments={[{ label: 'A', pct: 60, color: ACCENT_CYAN }, { label: 'B', pct: 40, color: ACCENT_EMERALD }]} />,
    );
    const paths = Array.from(container.querySelectorAll('path'));
    expect(paths).toHaveLength(2);
    for (const p of paths) {
      const { start, end } = outerArc(p.getAttribute('d')!);
      expect(span(start, end)).toBeGreaterThan(1);
    }
  });
});
