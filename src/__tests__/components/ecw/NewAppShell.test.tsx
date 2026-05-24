import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NewAppShell } from '@/components/ecw/NewAppShell';
import { useEcwStore } from '@/stores/ecwStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCatalogStore } from '@/stores/catalogStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';

// Stub heavy SetupWizard so we don't boot project-setup machinery in the test.
vi.mock('@/components/modules/project-setup/SetupWizard', () => ({
  SetupWizard: () => <div data-testid="setup-wizard">setup</div>,
}));

describe('NewAppShell', () => {
  beforeEach(() => {
    useEcwStore.setState({
      activeL1Tab: 'catalogs',
      cliRailMode: 'auto',
      isPaletteOpen: false,
      activeCatalogId: null,
      activeEntityId: null,
    });
    useProjectStore.setState({ isSetupComplete: true });
    // Reset catalog store to known empty state (the Catalog Hub now reads it).
    const seeded: Record<string, Record<string, never>> = {};
    for (const s of CATALOG_SECTIONS) seeded[s.catalogId] = {};
    useCatalogStore.setState({ entitiesByCatalog: seeded });
  });
  afterEach(cleanup);

  it('renders the top bar with brand "PoF"', () => {
    render(<NewAppShell />);
    expect(screen.getByText('PoF')).toBeTruthy();
  });

  it('renders the Catalog Hub root by default', () => {
    render(<NewAppShell />);
    // Phase 3: catalogs tab now shows the real Catalog Hub root, not the placeholder.
    expect(screen.getByRole('heading', { level: 1, name: /^Catalogs$/ })).toBeTruthy();
  });

  it('switching tab swaps the body', () => {
    useEcwStore.setState({ activeL1Tab: 'mission-control' });
    render(<NewAppShell />);
    expect(screen.getByRole('heading', { level: 1, name: /Mission Control/ })).toBeTruthy();
  });

  it('renders the CLI Rail', () => {
    render(<NewAppShell />);
    expect(screen.getByTestId('cli-rail')).toBeTruthy();
  });

  it('shows SetupWizard if project setup not complete', () => {
    useProjectStore.setState({ isSetupComplete: false });
    render(<NewAppShell />);
    expect(screen.getByTestId('setup-wizard')).toBeTruthy();
    // Shell chrome should NOT render in this state.
    expect(screen.queryByText('PoF')).toBeNull();
  });
});
