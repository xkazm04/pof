import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NewAppShell } from '@/components/ecw/NewAppShell';
import { useEcwStore } from '@/stores/ecwStore';
import { useProjectStore } from '@/stores/projectStore';

// Stub heavy SetupWizard so we don't boot project-setup machinery in the test.
vi.mock('@/components/modules/project-setup/SetupWizard', () => ({
  SetupWizard: () => <div data-testid="setup-wizard">setup</div>,
}));

describe('NewAppShell', () => {
  beforeEach(() => {
    useEcwStore.setState({ activeL1Tab: 'catalogs', cliRailMode: 'auto', isPaletteOpen: false });
    useProjectStore.setState({ isSetupComplete: true });
  });
  afterEach(cleanup);

  it('renders the top bar with brand "PoF"', () => {
    render(<NewAppShell />);
    expect(screen.getByText('PoF')).toBeTruthy();
  });

  it('renders the catalogs placeholder by default', () => {
    render(<NewAppShell />);
    expect(screen.getByRole('heading', { level: 1, name: /Catalogs/ })).toBeTruthy();
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
