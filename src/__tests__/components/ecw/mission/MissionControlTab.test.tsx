import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MissionControlTab } from '@/components/ecw/mission/MissionControlTab';
import { useCatalogStore } from '@/stores/catalogStore';
import { useActivityFeedStore } from '@/stores/activityFeedStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';

describe('MissionControlTab', () => {
  beforeEach(() => {
    const seeded: Record<string, Record<string, never>> = {};
    for (const s of CATALOG_SECTIONS) seeded[s.catalogId] = {};
    useCatalogStore.setState({ entitiesByCatalog: seeded });
    useActivityFeedStore.setState({ events: [], isOpen: false });
  });
  afterEach(cleanup);

  it('renders the page heading', () => {
    render(<MissionControlTab />);
    expect(screen.getByRole('heading', { level: 1, name: /Mission Control/ })).toBeTruthy();
  });

  it('renders the three composed cards', () => {
    render(<MissionControlTab />);
    expect(screen.getByRole('heading', { level: 2, name: /Catalog Lifecycle/ })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Forecast/ })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /^Activity$/ })).toBeTruthy();
  });
});
