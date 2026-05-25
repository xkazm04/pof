import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, renderHook } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { LayoutLab } from '@/components/layout-lab/LayoutLab';
import { useLabDetail } from '@/components/layout-lab/useLabCatalogData';

describe('UI identity lab (Blueprint baseline)', () => {
  afterEach(cleanup);

  it('useLabDetail returns entities + the fine pipeline steps for spellbook', () => {
    const { result } = renderHook(() => useLabDetail('spellbook'));
    expect(result.current?.entities.length).toBeGreaterThan(0);
    expect(result.current?.steps).toContain('Concept Brief & Fantasy');
    expect(result.current?.steps).toContain('UE Ability Asset Packaging');
  });

  it('renders the Light/Dark theme toggle (Forge/Studio/Atelier/Soft tabs gone)', () => {
    render(<LayoutLab />);
    expect(screen.getByRole('button', { name: 'Blueprint' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Studio Dark' })).toBeTruthy();
    for (const gone of ['Forge', 'Atelier', 'Soft', 'Studio']) {
      expect(screen.queryByRole('button', { name: gone })).toBeNull();
    }
  });

  it('opens on the spellbook detail with the pipeline + header stats', () => {
    render(<LayoutLab />);
    // default catalog = spellbook; pipeline steps render in the sidebar
    expect(screen.getByText('Concept Brief & Fantasy')).toBeTruthy();
    expect(screen.getAllByText(/Pipeline/).length).toBeGreaterThan(0);
    // header stat strip carries lifecycle (moved title-block)
    expect(screen.getAllByText('lifecycle').length).toBeGreaterThan(0);
  });

  it('selecting a pipeline step opens its work canvas in the main content', () => {
    render(<LayoutLab />);
    fireEvent.click(screen.getByText('Combat Test Gate'));
    expect(screen.getByText('Compose')).toBeTruthy();
  });
});
