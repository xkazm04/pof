import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ArpgHudPreview } from '@/components/modules/core-engine/sub_ui/systems/ArpgHudPreview';
import { arpgPreviewLayout } from '@/components/modules/core-engine/sub_ui/_shared/hudRegistry';
import { STATUS_WARNING } from '@/lib/chart-colors';

/**
 * scan-sweep night 2026-11-08 game-ui-hud: every ARPG preview widget is a
 * selectable button, so each must be named by its registry label (not by a
 * "+" glyph or nothing at all), expose its selection, and keep a focus ring.
 */
describe('ArpgHudPreview widget buttons', () => {
  afterEach(cleanup);

  it('names every widget button by its registry label', () => {
    render(<ArpgHudPreview />);
    for (const p of arpgPreviewLayout()) {
      expect(screen.getByRole('button', { name: p.label })).toBeTruthy();
    }
  });

  it('exposes selection with aria-pressed and keeps a visible focus ring', () => {
    render(<ArpgHudPreview />);
    const btn = screen.getByRole('button', { name: 'MiniMap' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.className).toContain('focus-ring');
    expect(btn.className).not.toContain('focus:outline-none');
  });
});

function rgbOf(hex: string): string {
  const h = hex.replace('#', '');
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
}

describe('ArpgHudPreview legend', () => {
  afterEach(cleanup);

  it('paints the Skill Bar swatch in the colour the skill bar is drawn with', () => {
    render(<ArpgHudPreview />);
    const swatch = screen.getByText('Skill Bar').previousElementSibling as HTMLElement;
    expect(swatch.style.backgroundColor).toBe(rgbOf(STATUS_WARNING));
  });
});
