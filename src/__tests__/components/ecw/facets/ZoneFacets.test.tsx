import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ZoneAnalysisFacet } from '@/components/ecw/facets/zone-map/ZoneAnalysisFacet';
import { ZoneAuthorFacet } from '@/components/ecw/facets/zone-map/ZoneAuthorFacet';
import { useCatalogStore } from '@/stores/catalogStore';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import type { CatalogEntityBase } from '@/lib/catalog/types';

const { execute } = vi.hoisted(() => ({ execute: vi.fn((_t: unknown) => Promise.resolve()) }));
vi.mock('@/hooks/useModuleCLI', () => ({ useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }) }));

function zoneEntity(id: string, type: string, levelMin: number, levelMax: number, connections: string[]): CatalogEntityBase {
  return {
    id, catalogId: 'zone-map', name: id, categoryPath: ['Zones'], tags: [], lifecycle: 'planned',
    data: { id, displayName: id, type, status: 'active', levelMin, levelMax, connections },
  } as CatalogEntityBase;
}

function seed(entities: CatalogEntityBase[]) {
  const seeded: Record<string, Record<string, CatalogEntityBase>> = {};
  for (const s of CATALOG_SECTIONS) seeded[s.catalogId] = {};
  for (const e of entities) seeded['zone-map'][e.id] = e;
  useCatalogStore.setState({ entitiesByCatalog: seeded });
}

describe('ZoneAnalysisFacet', () => {
  beforeEach(() => seed([]));
  afterEach(cleanup);

  it('renders the level range and link count', () => {
    const e = zoneEntity('z1', 'hub', 1, 3, ['z2']);
    seed([e, zoneEntity('z2', 'combat', 1, 3, ['z1'])]);
    render(<ZoneAnalysisFacet entity={e} />);
    expect(screen.getByText(/Zone Analysis/i)).toBeTruthy();
    expect(screen.getByText(/Lv 1.*3/)).toBeTruthy();
  });

  it('surfaces a dangling-connection error', () => {
    const e = zoneEntity('z1', 'combat', 1, 3, ['zMissing']);
    seed([e]);
    render(<ZoneAnalysisFacet entity={e} />);
    expect(screen.getByText(/unknown zone/i)).toBeTruthy();
  });

  it('shows a fallback for non-zone data', () => {
    const bad = { id: 'x', catalogId: 'zone-map', name: 'x', categoryPath: [], tags: [], lifecycle: 'planned', data: { id: 'x' } } as CatalogEntityBase;
    seed([bad]);
    render(<ZoneAnalysisFacet entity={bad} />);
    expect(screen.getByText(/no zone data to analyse/i)).toBeTruthy();
  });
});

describe('ZoneAuthorFacet', () => {
  beforeEach(() => execute.mockClear());
  afterEach(cleanup);

  it('dispatches a quick-action carrying the zone name + instruction', () => {
    const e = zoneEntity('Crystal Caves', 'combat', 2, 4, []);
    render(<ZoneAuthorFacet entity={e} />);
    fireEvent.change(screen.getByPlaceholderText(/hidden side-path/i), { target: { value: 'raise level range' } });
    fireEvent.click(screen.getByRole('button', { name: /author zone with claude/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as { type: string; prompt: string };
    expect(task.type).toBe('quick-action');
    expect(task.prompt).toContain('Crystal Caves');
    expect(task.prompt).toContain('raise level range');
  });
});
