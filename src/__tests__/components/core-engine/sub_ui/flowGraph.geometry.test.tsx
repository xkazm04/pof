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
