import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { LayoutLab } from '@/components/layout-lab/LayoutLab';

afterEach(() => { cleanup(); localStorage.clear(); });

describe('Lab chrome v2', () => {
  it('exposes data-theme on the lab root and the theme toggle flips it', () => {
    render(<LayoutLab />);
    const root = screen.getByTestId('harness-lab-ready');
    expect(root.getAttribute('data-theme')).toBe('blueprint');
    fireEvent.click(screen.getByRole('button', { name: /studio dark/i }));
    expect(root.getAttribute('data-theme')).toBe('studio');
  });
  it('has a density toggle that flips data-density', () => {
    render(<LayoutLab />);
    const root = screen.getByTestId('harness-lab-ready');
    expect(root.getAttribute('data-density')).toBe('comfortable');
    fireEvent.click(screen.getByRole('button', { name: /density/i }));
    expect(root.getAttribute('data-density')).toBe('compact');
  });
  it('still renders the view switcher + One-shot + Legacy', () => {
    render(<LayoutLab />);
    expect(screen.getByRole('button', { name: 'Catalogs' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Matrix' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Canon' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /one-shot/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /legacy/i })).toBeTruthy();
  });
});
