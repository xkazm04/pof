import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { CategoryView } from '@/components/status/CategoryView';
import { useCatalogStore } from '@/stores/catalogStore';
import type { CatalogEntityBase } from '@/lib/catalog/types';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

// 25 entities so pagination (20/page) kicks in. Only 'strong' has a gate-verified
// (L3) pass → it must sort LAST; the rest tie at 0% and sort by name ascending.
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: vi.fn(() =>
    Promise.resolve([{ catalogId: 'items', entityId: 'strong', step: 'Economy', data: {}, ueAssets: [], status: 'pass', tier: 'L3' }]),
  ),
}));

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return { ...actual, tryApiFetch: vi.fn().mockResolvedValue({ ok: true, data: [] }) };
});

vi.mock('@/lib/catalog/pipeline-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog/pipeline-registry')>();
  const view = { kind: 'prose', field: 'x', emptyText: '' } as const;
  const produce = () => ({ data: {}, ueAssets: [] });
  const accept = () => ({ label: 'a', status: 'pass' as const, tier: 'L0' as const, detail: '' });
  return {
    ...actual,
    getCatalogPipeline: (id: string) =>
      id === 'items'
        ? { catalogId: id, steps: [
            { archetype: 'brief', label: 'Economy', engine: 'Claude', view, produce, accept },
            { archetype: 'brief', label: '3D-Mesh', engine: 'Tripo', view, produce, accept },
          ] }
        : null,
  };
});

function ent(id: string, name: string): CatalogEntityBase {
  return { id, catalogId: 'items', name, categoryPath: [], tags: [], lifecycle: 'planned', links: [] };
}

beforeEach(() => {
  const byId: Record<string, CatalogEntityBase> = {};
  // 24 zero-coverage entities named Item 01..24, plus one gate-verified 'strong'.
  for (let i = 1; i <= 24; i += 1) {
    const n = String(i).padStart(2, '0');
    byId[`e${n}`] = ent(`e${n}`, `Item ${n}`);
  }
  byId.strong = ent('strong', 'Zebra Verified');
  useCatalogStore.setState({ entitiesByCatalog: { items: byId } });
});

afterEach(cleanup);

describe('CategoryView', () => {
  it('lists 20 rows on the first page and paginates the remaining 5', async () => {
    const { container, getByText } = render(
      <CategoryView catalogId="items" onFocusEntity={vi.fn()} onPickCatalog={vi.fn()} />,
    );
    await waitFor(() => expect(container.textContent).toContain('25 entities'));
    // page 1: Item 01..20 present, Item 24 not yet
    expect(container.textContent).toContain('Item 01');
    expect(container.textContent).toContain('Item 20');
    expect(container.textContent).not.toContain('Item 21');
    expect(container.textContent).toContain('page 1 of 2');

    fireEvent.click(getByText('next →'));
    await waitFor(() => expect(container.textContent).toContain('page 2 of 2'));
    expect(container.textContent).toContain('Item 24');
    // the sole gate-verified entity sorts LAST (weakest-first) → last page
    expect(container.textContent).toContain('Zebra Verified');
  });

  it('orders weakest first: zero-coverage entities (name asc) before the verified one', async () => {
    const { container } = render(
      <CategoryView catalogId="items" onFocusEntity={vi.fn()} onPickCatalog={vi.fn()} />,
    );
    await waitFor(() => expect(container.textContent).toContain('Item 01'));
    const firstLabel = container.querySelector('button span');
    expect(firstLabel?.textContent).toContain('Item 01'); // lowest name among the 0% ties
  });

  it('clicking a row focuses that entity', async () => {
    const onFocusEntity = vi.fn();
    const { container, getByText } = render(
      <CategoryView catalogId="items" onFocusEntity={onFocusEntity} onPickCatalog={vi.fn()} />,
    );
    await waitFor(() => expect(container.textContent).toContain('Item 01'));
    fireEvent.click(getByText('Item 01'));
    expect(onFocusEntity).toHaveBeenCalledWith('items', 'e01');
  });

  it('shows the catalog picker when no catalog is selected', () => {
    const { container } = render(
      <CategoryView catalogId={null} onFocusEntity={vi.fn()} onPickCatalog={vi.fn()} />,
    );
    expect(container.textContent).toContain('Pick a catalog');
  });
});
