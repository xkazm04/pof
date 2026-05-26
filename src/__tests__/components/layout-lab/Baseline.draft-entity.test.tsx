import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCatalogStore } from '@/stores/catalogStore';
import { useLabDetail } from '@/components/layout-lab/useLabCatalogData';

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
