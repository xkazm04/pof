import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CliRail } from '@/components/ecw/CliRail';
import { useEcwStore } from '@/stores/ecwStore';

describe('CliRail', () => {
  beforeEach(() => {
    useEcwStore.setState({ cliRailMode: 'auto', activeCatalogId: null, activeEntityId: null });
  });
  afterEach(cleanup);

  it('renders the rail header "CLI"', () => {
    render(<CliRail />);
    // Header has the exact text "CLI" (uppercase, in its own span); the body
    // contains "CLI sessions ..." too — match just the header span.
    expect(screen.getByText(/^CLI$/)).toBeTruthy();
  });

  it('shows "Project" scope when no entity is selected', () => {
    render(<CliRail />);
    expect(screen.getByText(/Project/)).toBeTruthy();
  });

  it('shows entity scope when entity is selected', () => {
    useEcwStore.setState({ activeCatalogId: 'spellbook', activeEntityId: 'ga-fireball' });
    render(<CliRail />);
    const scope = screen.getByText(/spellbook/);
    expect(scope).toBeTruthy();
    expect(scope.textContent).toContain('ga-fireball');
  });

  it('toggle button cycles rail mode', () => {
    render(<CliRail />);
    const btn = screen.getByRole('button', { name: /toggle CLI rail/i });
    expect(useEcwStore.getState().cliRailMode).toBe('auto');
    fireEvent.click(btn);
    expect(useEcwStore.getState().cliRailMode).toBe('wide');
    fireEvent.click(btn);
    expect(useEcwStore.getState().cliRailMode).toBe('collapsed');
  });

  it('collapsed mode hides the body', () => {
    useEcwStore.setState({ cliRailMode: 'collapsed' });
    render(<CliRail />);
    expect(screen.queryByTestId('cli-rail-body')).toBeNull();
  });
});
