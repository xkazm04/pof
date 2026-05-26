import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, render, screen } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { useCatalogStore } from '@/stores/catalogStore';
import { useLabDetail } from '@/components/layout-lab/useLabCatalogData';
import { CatalogTree } from '@/components/layout-lab/CatalogTree';
import { LIGHT } from '@/components/layout-lab/theme';

describe('useLabDetail merges drafts', () => {
  beforeEach(() => {
    useCatalogStore.setState({ draftEntitiesByCatalog: {} });
  });

  it('includes draft entities in the entities list', () => {
    useCatalogStore.getState().addDraft('items', {
      id: 'draft-items-x', catalogId: 'items', name: 'X', categoryPath: [], tags: ['one-shot'], lifecycle: 'planned', data: {},
    });
    const { result } = renderHook(() => useLabDetail('items'));
    const ids = result.current?.entities.map((e) => e.id) ?? [];
    expect(ids).toContain('draft-items-x');
  });

  it('draft count is reflected in total', () => {
    const beforeRender = renderHook(() => useLabDetail('items'));
    const beforeTotal = beforeRender.result.current?.catalog.total ?? 0;
    useCatalogStore.getState().addDraft('items', {
      id: 'draft-items-counted', catalogId: 'items', name: 'Y', categoryPath: [], tags: [], lifecycle: 'planned', data: {},
    });
    const after = renderHook(() => useLabDetail('items'));
    expect(after.result.current?.catalog.total).toBe(beforeTotal + 1);
  });
});

describe('CatalogTree draft rendering', () => {
  beforeEach(() => {
    useCatalogStore.setState({ draftEntitiesByCatalog: {} });
  });

  it('renders a draft entity with a × discard button', () => {
    useCatalogStore.getState().addDraft('items', {
      id: 'draft-items-disc', catalogId: 'items', name: 'Draft With Discard',
      categoryPath: ['Weapon'], tags: ['one-shot'], lifecycle: 'planned', data: {},
    });
    render(
      <CatalogTree
        t={LIGHT}
        groups={[{ category: 'Core Existing', catalogs: [{ catalogId: 'items', label: 'Items', description: '', verified: 0, total: 1 }] }]}
        selectedCatalogId="items"
        entities={[{ id: 'draft-items-disc', name: 'Draft With Discard', lifecycle: 'planned', data: {} }]}
        selectedEntityId={null}
        onSelectCatalog={() => {}}
        onSelectEntity={() => {}}
      />,
    );
    expect(screen.getByText('Draft With Discard')).toBeTruthy();
    expect(screen.getByRole('button', { name: /discard draft/i })).toBeTruthy();
  });
});
