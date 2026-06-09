import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

import { SchematicPanel } from '@/components/ui/SchematicPanel';
import { ACCENT_VIOLET, ACCENT_CYAN } from '@/lib/chart-colors';

// jsdom serializes inline hex colors to rgb(...) — assert against that form.
// See reference_jsdom_inline_color_rgb.
function rgbOf(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

// Built non-literally so this regression guard doesn't itself trip no-hardcoded-hex.
const OLD_FLOOR = '#' + '03030a';

describe('SchematicPanel', () => {
  it('renders children and a tokenized panel surface (not the old hardcoded floor)', () => {
    const { container, getByText } = render(
      <SchematicPanel>
        <span>content</span>
      </SchematicPanel>,
    );
    expect(getByText('content')).toBeTruthy();
    const root = container.querySelector('[data-schematic-tone="panel"]') as HTMLElement;
    expect(root).toBeTruthy();
    // Floor reads the CSS token, never the old hardcoded #03030a.
    expect(root.style.backgroundColor).toContain('var(--schematic-surface)');
    expect(root.getAttribute('style') ?? '').not.toContain(OLD_FLOOR);
  });

  it('panel tone draws the accent grid + two corner glows by default', () => {
    const { container } = render(<SchematicPanel accent={ACCENT_VIOLET} accentSecondary={ACCENT_CYAN} />);
    const grid = container.querySelector('[data-schematic-grid]') as HTMLElement;
    expect(grid).toBeTruthy();
    // Grid lines are tinted from the accent prop (jsdom → rgb form).
    expect(grid.style.backgroundImage).toContain(rgbOf(ACCENT_VIOLET));
    const glows = container.querySelectorAll('[data-schematic-glow]');
    expect(glows.length).toBe(2);
  });

  it('well tone uses the recessed token surface and omits corner glows', () => {
    const { container } = render(<SchematicPanel tone="well" />);
    const root = container.querySelector('[data-schematic-tone="well"]') as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.style.backgroundColor).toContain('var(--schematic-well)');
    expect(container.querySelectorAll('[data-schematic-glow]').length).toBe(0);
  });

  it('grid can be disabled and a radial glow opted in', () => {
    const { container } = render(<SchematicPanel tone="well" grid={false} radial />);
    expect(container.querySelector('[data-schematic-grid]')).toBeNull();
    expect(container.querySelector('[data-schematic-radial]')).toBeTruthy();
  });

  it('forwards className/style and arbitrary props onto the root', () => {
    const { container } = render(
      <SchematicPanel className="custom-cls" style={{ height: 200 }} data-testid="sp" />,
    );
    const root = container.querySelector('[data-schematic-tone="panel"]') as HTMLElement;
    expect(root.className).toContain('custom-cls');
    expect(root.style.height).toBe('200px');
    expect(root.getAttribute('data-testid')).toBe('sp');
  });
});
