/**
 * MicroLabel — the shared de-emphasized micro-text primitive.
 *
 * Two guarantees that must hold for every caller (so the WCAG fix "lands once"):
 *   1. Size never drops below the 12px floor (`text-xs`); no `text-[9px]`/`text-[10px]`/
 *      `text-2xs` ever leaks through.
 *   2. Color is an AA-compliant tier token (`--text-subtle` / `--text-muted`), never an
 *      opacity-dimmed muted hack.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MicroLabel } from '@/components/ui/MicroLabel';

afterEach(cleanup);

const SUB_FLOOR = ['text-[9px]', 'text-[10px]', 'text-[11px]', 'text-2xs'];

describe('MicroLabel', () => {
  it('renders its children', () => {
    const { getByText } = render(<MicroLabel>SEQUENCE</MicroLabel>);
    expect(getByText('SEQUENCE')).toBeTruthy();
  });

  it('always carries the 12px floor (text-xs) and never a sub-floor size', () => {
    const { container } = render(<MicroLabel>x</MicroLabel>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('text-xs');
    for (const banned of SUB_FLOOR) expect(el.className).not.toContain(banned);
  });

  it('defaults to the AA subtle tier token', () => {
    const { container } = render(<MicroLabel>x</MicroLabel>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('text-text-subtle');
    // never an opacity-dimmed muted color
    expect(el.className).not.toMatch(/text-text-muted\/\d/);
  });

  it('tone="muted" uses the full-strength muted token (still AA)', () => {
    const { container } = render(<MicroLabel tone="muted">x</MicroLabel>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('text-text-muted');
    expect(el.className).not.toContain('text-text-subtle');
  });

  it('honors as / mono / uppercase / className', () => {
    const { container } = render(
      <MicroLabel as="p" mono uppercase className="ml-auto">x</MicroLabel>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.tagName).toBe('P');
    expect(el.className).toContain('font-mono');
    expect(el.className).toContain('uppercase');
    expect(el.className).toContain('ml-auto');
  });
});
