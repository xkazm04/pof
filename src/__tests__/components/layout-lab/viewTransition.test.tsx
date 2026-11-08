import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LayoutLab } from '@/components/layout-lab/LayoutLab';

vi.mock('next/font/google', () => { const f = () => ({ className: 'm', variable: '--m' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
afterEach(() => { cleanup(); localStorage.clear(); });

describe('view transitions', () => {
  it('swaps to Canon and back, with the active view present each time', () => {
    render(<LayoutLab />);
    fireEvent.click(screen.getByRole('button', { name: 'Canon' }));
    expect(screen.getByRole('button', { name: 'Canon' }).getAttribute('aria-current')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Catalogs' }));
    expect(screen.getByRole('button', { name: 'Catalogs' }).getAttribute('aria-current')).toBe('true');
  });

  it('the view switch is one selection: exactly one aria-current, and no member is a pressed toggle', () => {
    render(<LayoutLab />);
    const views = ['Catalogs', 'Matrix', 'Canon', 'Game'].map((n) => screen.getByRole('button', { name: n }));
    expect(views.filter((b) => b.getAttribute('aria-current') === 'true')).toHaveLength(1);
    expect(views.map((b) => b.getAttribute('aria-pressed'))).toEqual([null, null, null, null]);
  });
});
