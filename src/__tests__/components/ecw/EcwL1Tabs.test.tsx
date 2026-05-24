import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EcwL1Tabs } from '@/components/ecw/EcwL1Tabs';
import { useEcwStore } from '@/stores/ecwStore';

describe('EcwL1Tabs', () => {
  beforeEach(() => {
    useEcwStore.setState({ activeL1Tab: 'catalogs' });
  });
  afterEach(cleanup);

  it('renders the 3 tabs', () => {
    render(<EcwL1Tabs />);
    expect(screen.getByRole('tab', { name: /Catalogs/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Mission Control/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Live State/ })).toBeTruthy();
  });

  it('catalogs tab is selected by default', () => {
    render(<EcwL1Tabs />);
    expect(screen.getByRole('tab', { name: /Catalogs/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('clicking a tab updates the store', () => {
    render(<EcwL1Tabs />);
    fireEvent.click(screen.getByRole('tab', { name: /Mission Control/ }));
    expect(useEcwStore.getState().activeL1Tab).toBe('mission-control');
  });
});
