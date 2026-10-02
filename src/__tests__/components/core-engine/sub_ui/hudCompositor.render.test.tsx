import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HudCompositor } from '@/components/modules/core-engine/sub_ui/hud-compositor';
import { ACCENT_PINK } from '@/lib/chart-colors';

/**
 * game-ui-hud/A render half: the compositor resolves a context's widgets
 * through the registry, so the two contexts that drew nothing now draw their
 * rects, and the header counts rendered rects rather than names.
 */
describe('HudCompositor resolves contexts through the HUD registry', () => {
  afterEach(cleanup);

  it.each([
    ['Force Focus', ['Force Menu', 'Force Globe', 'Target Lock']],
    ['Lightsaber Combat', ['Combo Counter', 'Stamina Arc', 'Target Frame']],
  ])('%s draws its 3 visible widgets and says 3/7', (name, labels) => {
    render(<HudCompositor accent={ACCENT_PINK} />);
    fireEvent.click(screen.getByRole('button', { name }));
    expect(screen.getByText(`${name} Mode`)).toBeTruthy();
    expect(screen.getByText('3/7 widgets')).toBeTruthy();
    for (const label of labels) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByTestId('hud-unresolved')).toBeNull();
  });
});
