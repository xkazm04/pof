import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LiveStateTab } from '@/components/ecw/live/LiveStateTab';
import { useCatalogStore } from '@/stores/catalogStore';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';

describe('LiveStateTab', () => {
  beforeEach(() => {
    const seeded: Record<string, Record<string, never>> = {};
    for (const s of CATALOG_SECTIONS) seeded[s.catalogId] = {};
    useCatalogStore.setState({ entitiesByCatalog: seeded });
    usePofBridgeStore.setState({ pluginInfo: null, connectionStatus: 'disconnected' });
  });
  afterEach(cleanup);

  it('renders the heading', () => {
    render(<LiveStateTab />);
    expect(screen.getByRole('heading', { level: 1, name: /Live State/ })).toBeTruthy();
  });

  it('composes Bridge + Asset Manifest cards', () => {
    render(<LiveStateTab />);
    expect(screen.getByRole('heading', { level: 2, name: /^Bridge$/ })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Asset Manifest/ })).toBeTruthy();
  });

  it('shows the Phase 6b/P10 placeholder cards', () => {
    render(<LiveStateTab />);
    expect(screen.getByRole('heading', { level: 3, name: /Live UObject Inspector/ })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: /Crash Watchtower/ })).toBeTruthy();
  });
});
