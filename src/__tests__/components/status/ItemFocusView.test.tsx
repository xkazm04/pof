import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { ItemFocusView } from '@/components/status/ItemFocusView';
import { useCatalogStore } from '@/stores/catalogStore';
import type { CatalogEntityBase } from '@/lib/catalog/types';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

// Per-catalog artifacts: the sword produced Economy but NOT 3D-Mesh; the loot table
// produced its one step.
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: vi.fn((catalogId: string) => {
    const byCatalog: Record<string, unknown[]> = {
      items: [{ catalogId: 'items', entityId: 'sword', step: 'Economy', data: {}, ueAssets: [], status: 'pass', tier: 'L0' }],
      'loot-tables': [{ catalogId: 'loot-tables', entityId: 'lt1', step: 'Drop-Rates', data: {}, ueAssets: [], status: 'pass', tier: 'L0' }],
      'icon-sets': [],
    };
    return Promise.resolve(byCatalog[catalogId] ?? []);
  }),
}));

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return { ...actual, tryApiFetch: vi.fn().mockResolvedValue({ ok: true, data: [] }) };
});

// Fixed tiny pipelines so cells are deterministic (keep registerCatalogPipeline intact).
vi.mock('@/lib/catalog/pipeline-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog/pipeline-registry')>();
  const view = { kind: 'prose', field: 'x', emptyText: '' } as const;
  const produce = () => ({ data: {}, ueAssets: [] });
  const accept = () => ({ label: 'a', status: 'pass' as const, tier: 'L0' as const, detail: '' });
  const steps: Record<string, { label: string; engine: string }[]> = {
    items: [{ label: 'Economy', engine: 'Claude' }, { label: '3D-Mesh', engine: 'Tripo' }],
    'loot-tables': [{ label: 'Drop-Rates', engine: 'Claude' }],
    'icon-sets': [{ label: 'Icon', engine: 'Leonardo' }],
  };
  return {
    ...actual,
    getCatalogPipeline: (id: string) =>
      steps[id] ? { catalogId: id, steps: steps[id].map((s) => ({ archetype: 'brief', label: s.label, engine: s.engine, view, produce, accept })) } : null,
  };
});

function ent(catalogId: string, id: string, name: string, links: CatalogEntityBase['links'] = []): CatalogEntityBase {
  return { id, catalogId, name, categoryPath: [], tags: [], lifecycle: 'planned', links };
}

beforeEach(() => {
  useCatalogStore.setState({
    entitiesByCatalog: {
      items: { sword: ent('items', 'sword', 'Vael Blade', [{ catalogId: 'icon-sets', entityId: 'icon1', role: 'icon' }]) },
      'icon-sets': { icon1: ent('icon-sets', 'icon1', 'Sword Icon') },
      'loot-tables': { lt1: ent('loot-tables', 'lt1', 'Brute Loot', [{ catalogId: 'items', entityId: 'sword', role: 'loot' }]) },
    },
  });
});

afterEach(cleanup);

describe('ItemFocusView', () => {
  it('renders the focus entity, its reverse dependent, and its forward binding', async () => {
    const { container } = render(<ItemFocusView focus={{ catalogId: 'items', entityId: 'sword' }} onFocus={vi.fn()} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Vael Blade');
      expect(container.textContent).toContain('Brute Loot'); // reverse dependent
      expect(container.textContent).toContain('Sword Icon');  // forward binding
    });
  });

  it('grades the focus entity by its OWN realization (3D-Mesh never produced → unwired)', async () => {
    const { container } = render(<ItemFocusView focus={{ catalogId: 'items', entityId: 'sword' }} onFocus={vi.fn()} />);
    await waitFor(() => {
      const cells = Array.from(container.querySelectorAll('[role="img"]'));
      const mesh = cells.find((c) => (c.getAttribute('aria-label') ?? '').startsWith('3D-Mesh'));
      expect(mesh).toBeTruthy();
      expect(mesh!.getAttribute('aria-label')).toContain('unwired');
    });
  });

  it('clicking a connected node refocuses onto it', async () => {
    const onFocus = vi.fn();
    const { container } = render(<ItemFocusView focus={{ catalogId: 'items', entityId: 'sword' }} onFocus={onFocus} />);
    await waitFor(() => expect(container.textContent).toContain('Brute Loot'));
    const lootBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.getAttribute('title') ?? '').includes('loot-tables · lt1'),
    );
    expect(lootBtn).toBeTruthy();
    fireEvent.click(lootBtn!);
    expect(onFocus).toHaveBeenCalledWith('loot-tables', 'lt1');
  });

  it('shows the empty prompt when no entity is focused', () => {
    const { container } = render(<ItemFocusView focus={null} onFocus={vi.fn()} />);
    expect(container.textContent).toContain('Search an entity');
  });
});
