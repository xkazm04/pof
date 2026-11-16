import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { FlowGraph } from '@/components/modules/core-engine/sub_ui/flow/FlowGraph';

/**
 * scan-sweep night 2026-11-08 game-ui-hud: the screen-flow ring must sit
 * inside its own viewBox. It was centred at (200,200) in a 340x340 box, so the
 * right and bottom nodes painted past the SVG onto the legend below it.
 */
describe('FlowGraph ring stays inside its viewBox', () => {
  afterEach(cleanup);

  it.each([null, 'HUD', 'DamageNumbers'])('every node circle fits the viewBox (highlight %s)', (hl) => {
    const { container } = render(<FlowGraph highlightedFlowNode={hl} onToggleNode={() => {}} />);
    const svg = Array.from(container.querySelectorAll('svg')).find((s) => s.querySelector('g.flow-node'))!;
    const [, , vw, vh] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    const circles = Array.from(svg.querySelectorAll('circle'));
    expect(circles.length).toBeGreaterThan(0);
    const out = circles.filter((c) => {
      const cx = Number(c.getAttribute('cx'));
      const cy = Number(c.getAttribute('cy'));
      const r = Number(c.getAttribute('r'));
      return cx - r < 0 || cy - r < 0 || cx + r > vw || cy + r > vh;
    });
    expect(out.length).toBe(0);
  });
});

/**
 * scan-sweep game-ui-hud: an Input Action screen has an open edge and a dashed
 * close edge. They used to share one chord and one label midpoint, so the same
 * text was painted twice on one spot and the return line hid under the open one.
 */
describe('FlowGraph draws each transition direction once, on its own line', () => {
  afterEach(cleanup);

  const flowSvg = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('svg')).find((s) => s.querySelector('g.flow-node'))!;
  const dupCount = (keys: string[]) => keys.length - new Set(keys).size;

  it('no two edge labels share a position, and no label text is repeated per pair', () => {
    const { container } = render(<FlowGraph highlightedFlowNode={null} onToggleNode={() => {}} />);
    const labels = Array.from(flowSvg(container).querySelectorAll('text:not(.pointer-events-none)'));
    expect(labels.length).toBeGreaterThan(0);
    expect(dupCount(labels.map((t) => `${t.getAttribute('x')},${t.getAttribute('y')}`))).toBe(0);
    expect(dupCount(labels.map((t) => t.textContent ?? ''))).toBe(0);
  });

  it('no two edge lines lie on the same chord', () => {
    const { container } = render(<FlowGraph highlightedFlowNode={null} onToggleNode={() => {}} />);
    const lines = Array.from(flowSvg(container).querySelectorAll('line:not([stroke-dasharray="6 10"])'));
    const key = (l: Element) => {
      const p = ['x1', 'y1', 'x2', 'y2'].map((a) => Number(l.getAttribute(a)).toFixed(2));
      return [`${p[0]},${p[1]}`, `${p[2]},${p[3]}`].sort().join('|');
    };
    expect(lines.length).toBeGreaterThan(0);
    expect(dupCount(lines.map(key))).toBe(0);
  });
});
