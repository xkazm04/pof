/**
 * The draft × button removed the local draft whether or not the server deletes succeeded.
 * When one failed, the toast said "discarded incompletely" — and the tree row that is the
 * ONLY handle on the leftover server rows was already gone, so there was nothing to retry
 * from. A failed discard must keep the draft listed; a clean one still drops it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'm', variable: '--m' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import { CatalogTree } from '@/components/layout-lab/CatalogTree';
import { LIGHT } from '@/components/layout-lab/theme';
import { useCatalogStore } from '@/stores/catalogStore';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useCatalogStore.setState({ draftEntitiesByCatalog: {} });
});

const groups = [{ category: 'Core', catalogs: [{ catalogId: 'items', label: 'Items', description: '', total: 1 }] }];
const DRAFT_ID = 'draft-items-1700000000001';

function seedAndRender() {
  useCatalogStore.setState({
    draftEntitiesByCatalog: {
      items: { [DRAFT_ID]: { id: DRAFT_ID, catalogId: 'items', name: 'Iron Hatchet', categoryPath: [], tags: [], lifecycle: 'planned' } },
    },
  });
  render(
    <CatalogTree t={LIGHT} groups={groups} selectedCatalogId="items"
      entities={[{ id: DRAFT_ID, name: 'Iron Hatchet', lifecycle: 'planned', data: {} }]}
      selectedEntityId={null} onSelectCatalog={() => {}} onSelectEntity={() => {}} />,
  );
}

function stubDeletes(artifactsOk: boolean) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true, status: 200,
    json: async () => (url.startsWith('/api/pipeline-artifacts') && !artifactsOk
      ? { success: false, error: 'purge failed' }
      : { success: true, data: { deleted: 1 } }),
  } as unknown as Response)));
}

const draftInStore = () => useCatalogStore.getState().draftEntitiesByCatalog.items?.[DRAFT_ID];

describe('CatalogTree discard keeps a draft whose server delete failed', () => {
  it('a failed delete leaves the draft listed and says so', async () => {
    stubDeletes(false);
    seedAndRender();
    fireEvent.click(screen.getByLabelText('discard draft'));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(draftInStore()).toBeDefined();
    expect(String(vi.mocked(toast.error).mock.calls[0][0])).toMatch(/kept in the tree/i);
  });

  it('a clean delete still drops the draft', async () => {
    stubDeletes(true);
    seedAndRender();
    fireEvent.click(screen.getByLabelText('discard draft'));
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(draftInStore()).toBeUndefined();
  });
});
