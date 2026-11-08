import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CumulativeDamageSvg } from '@/components/modules/core-engine/sub_combat/metrics/CumulativeDamageSvg';

// Every mark a combat-metrics chart draws sits inside its own viewBox, so the
// axis labels are not painted over whatever follows the chart
// (scan-sweep night 2026-11-08, ui-perfectionist).

afterEach(() => cleanup());

function viewBoxOf(svg: SVGSVGElement) {
  const [x, y, w, h] = (svg.getAttribute('viewBox') ?? '').split(/\s+/).map(Number);
  return { x, y, w, h };
}

describe('CumulativeDamageSvg stays inside its viewBox', () => {
  it('labels, gridlines, curves and points all fit', () => {
    const { container } = render(<CumulativeDamageSvg />);
    const svg = container.querySelector('svg') as SVGSVGElement;
    const vb = viewBoxOf(svg);
    const ys: number[] = [];
    container.querySelectorAll('text').forEach((t) => ys.push(Number(t.getAttribute('y'))));
    container.querySelectorAll('line').forEach((l) => ys.push(Number(l.getAttribute('y1')), Number(l.getAttribute('y2'))));
    container.querySelectorAll('circle').forEach((c) => ys.push(Number(c.getAttribute('cy'))));
    expect(ys.length).toBeGreaterThan(10);
    const outside = ys.filter((y) => !(y >= vb.y && y <= vb.y + vb.h));
    expect(outside).toEqual([]);
  });
});
