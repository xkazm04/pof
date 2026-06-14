import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { STATUS_GLYPH, STATUS_WORD, statusAriaLabel } from '@/components/layout-lab/statusLanguage';
import { LayoutLab } from '@/components/layout-lab/LayoutLab';

describe('Color-independent status language', () => {
  afterEach(cleanup);

  it('maps every status to a distinct glyph + spoken word (WCAG 1.4.1)', () => {
    // glyphs are unique so status survives grayscale
    const glyphs = Object.values(STATUS_GLYPH);
    expect(new Set(glyphs).size).toBe(glyphs.length);
    expect(STATUS_GLYPH).toEqual({ pass: '✓', fail: '✕', deferred: '⏸', pending: '○' });
    expect(STATUS_WORD.fail).toBe('failed');
    expect(statusAriaLabel('Economy', 'fail', 'L2')).toBe('Economy: failed, tier L2');
    expect(statusAriaLabel('Concept Brief', 'pending')).toBe('Concept Brief: pending');
  });

  it('Baseline timeline nodes share the same status language (status in the accessible name)', () => {
    render(<LayoutLab />);
    // The real Items pipeline opens with pending steps; the node button announces the status
    // word so a screen-reader / grayscale user can tell steps apart without relying on color.
    const concept = screen.getByRole('button', { name: /Concept Brief: pending/ });
    expect(concept).toBeTruthy();
    // the ✓ checkmark glyph is reserved for passed nodes — a pending node must not show it
    expect(within(concept).queryByText('✓')).toBeNull();
  });
});
