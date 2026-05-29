import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LayoutLab } from '@/components/layout-lab/LayoutLab';

vi.mock('next/font/google', () => { const f = () => ({ className: 'm', variable: '--m' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
afterEach(() => { cleanup(); localStorage.clear(); });

describe('view transitions', () => {
  it('swaps to Canon and back, with the active view present each time', () => {
    render(<LayoutLab />);
    fireEvent.click(screen.getByRole('button', { name: 'Canon' }));
    expect(screen.getByRole('button', { name: 'Canon' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Catalogs' }));
    expect(screen.getByRole('button', { name: 'Catalogs' }).getAttribute('aria-pressed')).toBe('true');
  });
});
