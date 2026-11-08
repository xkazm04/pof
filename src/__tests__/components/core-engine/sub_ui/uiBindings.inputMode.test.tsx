import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { UIBindingsTab } from '@/components/modules/core-engine/sub_ui/ui/UIBindingsTab';

/**
 * scan-sweep night 2026-11-08 game-ui-hud: the Input Mode state machine's
 * nodes are a single-select. Their twin, the screen-flow graph, already says
 * which node is selected (aria-pressed); this one must too.
 */
describe('UIBindingsTab input-mode state machine', () => {
  afterEach(cleanup);

  it('exposes the current mode with aria-pressed on exactly one node', () => {
    render(<UIBindingsTab />);
    const game = screen.getByRole('button', { name: 'Switch to Game input mode' });
    const ui = screen.getByRole('button', { name: 'Switch to UI input mode' });
    expect(game.getAttribute('aria-pressed')).toBe('true');
    expect(ui.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(ui);
    expect(game.getAttribute('aria-pressed')).toBe('false');
    expect(ui.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('UIBindingsTab input-mode state machine geometry', () => {
  afterEach(cleanup);

  it.each(['Game', 'UI', 'GameAndUI'])('every circle fits the viewBox with %s active', (mode) => {
    const { container } = render(<UIBindingsTab />);
    fireEvent.click(screen.getByRole('button', { name: `Switch to ${mode} input mode` }));
    const svg = Array.from(container.querySelectorAll('svg')).find((s) => s.querySelector('g.sm-node'))!;
    const [, , vw, vh] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    const out = Array.from(svg.querySelectorAll('circle')).filter((c) => {
      const cx = Number(c.getAttribute('cx'));
      const cy = Number(c.getAttribute('cy'));
      const r = Number(c.getAttribute('r'));
      return cx - r < 0 || cy - r < 0 || cx + r > vw || cy + r > vh;
    });
    expect(out.length).toBe(0);
  });
});
