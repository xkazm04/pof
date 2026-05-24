import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EcwCommandPalette } from '@/components/ecw/EcwCommandPalette';
import { useEcwStore } from '@/stores/ecwStore';

describe('EcwCommandPalette', () => {
  beforeEach(() => {
    useEcwStore.setState({ isPaletteOpen: false, activeL1Tab: 'catalogs' });
  });
  afterEach(cleanup);

  it('is hidden when isPaletteOpen=false', () => {
    render(<EcwCommandPalette />);
    expect(screen.queryByRole('dialog', { name: /command palette/i })).toBeNull();
  });

  it('shows the 3 L1 tabs as "jump to" rows when open', () => {
    useEcwStore.setState({ isPaletteOpen: true });
    render(<EcwCommandPalette />);
    expect(screen.getByText(/Jump to Catalogs/i)).toBeTruthy();
    expect(screen.getByText(/Jump to Mission Control/i)).toBeTruthy();
    expect(screen.getByText(/Jump to Live State/i)).toBeTruthy();
  });

  it('clicking a jump row sets the L1 tab and closes the palette', () => {
    useEcwStore.setState({ isPaletteOpen: true });
    render(<EcwCommandPalette />);
    fireEvent.click(screen.getByText(/Jump to Mission Control/i));
    expect(useEcwStore.getState().activeL1Tab).toBe('mission-control');
    expect(useEcwStore.getState().isPaletteOpen).toBe(false);
  });

  it('Escape closes the palette', () => {
    useEcwStore.setState({ isPaletteOpen: true });
    render(<EcwCommandPalette />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useEcwStore.getState().isPaletteOpen).toBe(false);
  });
});
