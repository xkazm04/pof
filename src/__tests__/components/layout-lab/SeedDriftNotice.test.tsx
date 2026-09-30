/**
 * SeedDriftNotice (scan-sweep --challenge challenge-2026-09-30b, catalog-seed-data/A): the
 * store's seed-drift findings are a DISPLAY and a decision, never a silent rewrite. It names how
 * many entities in this browser differ from the shipped seed, why each one asks, and offers the
 * two bulk decisions.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'm', variable: '--m' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { SeedDriftNotice } from '@/components/layout-lab/SeedDriftNotice';
import { LIGHT } from '@/components/layout-lab/theme';
import { useCatalogStore } from '@/stores/catalogStore';
import { seedAllCatalogs } from '@/lib/catalog/sections';
import type { SeedFinding } from '@/lib/catalog/seedSync';

const seeded = seedAllCatalogs();
const ITEM = Object.keys(seeded.items)[0];

function finding(entityId: string, verdict: SeedFinding['verdict'], name = entityId): SeedFinding {
  return { catalogId: 'items', entityId, verdict, name, mine: { ...seeded.items[ITEM], id: entityId, name }, removed: false };
}

afterEach(() => {
  cleanup();
  useCatalogStore.setState({ entitiesByCatalog: seedAllCatalogs(), seedDrift: [], seedHashes: {} });
});

describe('SeedDriftNotice', () => {
  it('renders nothing when this browser holds no drift', () => {
    useCatalogStore.setState({ seedDrift: [] });
    const { container } = render(<SeedDriftNotice t={LIGHT} />);
    expect(container.innerHTML).toBe('');
  });

  it('states how many entities differ from the shipped seed and why each asks', () => {
    useCatalogStore.setState({ seedDrift: [finding(ITEM, 'unrecorded', 'Renamed locally'), finding('item-x', 'conflict')] });
    render(<SeedDriftNotice t={LIGHT} />);
    const notice = screen.getByTestId('seed-drift-notice');
    expect(notice.textContent).toContain('2 entities in this browser differ from the shipped seed');
    expect(notice.textContent).toContain('Renamed locally');
    expect(notice.textContent).toMatch(/unrecorded/i);
    expect(notice.textContent).toMatch(/conflict/i);
  });

  it('Adopt shipped hands every finding to adoptShippedSeeds and the notice clears', () => {
    useCatalogStore.setState({
      entitiesByCatalog: { ...seedAllCatalogs(), items: { ...seedAllCatalogs().items, [ITEM]: { ...seeded.items[ITEM], name: 'Renamed locally' } } },
      seedDrift: [finding(ITEM, 'unrecorded', 'Renamed locally')],
    });
    render(<SeedDriftNotice t={LIGHT} />);
    fireEvent.click(screen.getByTestId('seed-drift-adopt'));
    expect(useCatalogStore.getState().entitiesByCatalog.items[ITEM].name).toBe(seeded.items[ITEM].name);
    expect(screen.queryByTestId('seed-drift-notice')).toBeNull();
  });

  it('Keep mine keeps the local copy and the notice clears', () => {
    useCatalogStore.setState({
      entitiesByCatalog: { ...seedAllCatalogs(), items: { ...seedAllCatalogs().items, [ITEM]: { ...seeded.items[ITEM], name: 'Renamed locally' } } },
      seedDrift: [finding(ITEM, 'unrecorded', 'Renamed locally')],
    });
    render(<SeedDriftNotice t={LIGHT} />);
    fireEvent.click(screen.getByTestId('seed-drift-keep'));
    expect(useCatalogStore.getState().entitiesByCatalog.items[ITEM].name).toBe('Renamed locally');
    expect(screen.queryByTestId('seed-drift-notice')).toBeNull();
  });
});
