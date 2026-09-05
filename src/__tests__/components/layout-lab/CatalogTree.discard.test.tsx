/**
 * Discarding a user-created entity used to call `removeDraft` alone — deleting the browser
 * record and ORPHANING every `pipeline_artifacts` row the one-shot run had written, while
 * `DELETE /api/pipeline-artifacts` existed for exactly that. And a draft the server never
 * accepted looked identical to a durable entity in the tree, though none of its gates can run.
 *
 * These pin both: the discard removes BOTH server records and reports the REAL counts, and a
 * browser-only draft says so on its row.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'm', variable: '--m' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import { CatalogTree, discardDraftEntity, describeDiscard } from '@/components/layout-lab/CatalogTree';
import { LIGHT } from '@/components/layout-lab/theme';
import { useCatalogStore } from '@/stores/catalogStore';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useCatalogStore.setState({ draftEntitiesByCatalog: {} });
});

const groups = [{ category: 'Core', catalogs: [{ catalogId: 'items', label: 'Items', description: '', total: 1 }] }];
const DRAFT_ID = 'draft-items-1700000000000';

function renderTree(entities: Array<{ id: string; name: string }>) {
  render(
    <CatalogTree
      t={LIGHT} groups={groups} selectedCatalogId="items"
      entities={entities.map((e) => ({ ...e, lifecycle: 'planned' as const, data: {} }))}
      selectedEntityId={null}
      onSelectCatalog={() => {}} onSelectEntity={() => {}}
    />,
  );
}

function mockDeletes(artifacts: number, entityRows: number) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    calls.push(url);
    const deleted = url.startsWith('/api/pipeline-artifacts') ? artifacts : entityRows;
    return { ok: true, status: 200, json: async () => ({ success: true, data: { deleted } }) } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

describe('discardDraftEntity', () => {
  it('deletes the artifacts AND the entity row, reporting the real counts', async () => {
    const calls = mockDeletes(11, 1);
    const res = await discardDraftEntity('items', DRAFT_ID);

    expect(calls[0]).toContain('/api/pipeline-artifacts?catalogId=items');
    expect(calls[0]).toContain(`entityId=${encodeURIComponent(DRAFT_ID)}`);
    expect(calls[1]).toContain('/api/catalog-entities?catalogId=items');
    expect(res).toEqual({ artifacts: 11, entityRows: 1, errors: [] });
  });

  it('names a failed delete instead of reporting a clean discard', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => (url.startsWith('/api/pipeline-artifacts')
        ? { success: false, error: 'purge failed' }
        : { success: true, data: { deleted: 1 } }),
    } as unknown as Response)));

    const res = await discardDraftEntity('items', DRAFT_ID);
    expect(res.artifacts).toBe(0);
    expect(res.errors).toEqual(['artifacts: purge failed']);
    expect(describeDiscard('Draft', res)).toContain('incompletely');
  });
});

describe('describeDiscard', () => {
  it('states what was removed, not what was attempted', () => {
    expect(describeDiscard('Iron Hatchet', { artifacts: 11, entityRows: 1, errors: [] }))
      .toBe('Discarded “Iron Hatchet” — 11 artifact row(s) and 1 entity row(s) removed.');
  });
});

describe('CatalogTree draft rows', () => {
  it('the × button purges the server rows before dropping the local cache', async () => {
    useCatalogStore.setState({
      draftEntitiesByCatalog: {
        items: {
          [DRAFT_ID]: { id: DRAFT_ID, catalogId: 'items', name: 'Iron Hatchet', categoryPath: [], tags: [], lifecycle: 'planned' },
        },
      },
    });
    const calls = mockDeletes(11, 1);
    renderTree([{ id: DRAFT_ID, name: 'Iron Hatchet' }]);

    fireEvent.click(screen.getByLabelText('discard draft'));
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    await vi.waitFor(() =>
      expect(useCatalogStore.getState().draftEntitiesByCatalog.items?.[DRAFT_ID]).toBeUndefined());
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('11 artifact row(s) and 1 entity row(s) removed'));
  });

  it('a browser-only draft SAYS its gates cannot run', () => {
    useCatalogStore.setState({
      draftEntitiesByCatalog: {
        items: {
          [DRAFT_ID]: {
            id: DRAFT_ID, catalogId: 'items', name: 'Iron Hatchet', categoryPath: [], tags: [],
            lifecycle: 'planned', browserOnly: true, persistError: 'catalog_entities unwritable',
          },
        },
      },
    });
    renderTree([{ id: DRAFT_ID, name: 'Iron Hatchet' }]);

    const badge = screen.getByTestId(`entity-browser-only-${DRAFT_ID}`);
    expect(badge.textContent).toBe('BROWSER-ONLY');
    expect(badge.getAttribute('title')).toMatch(/gates can run/i);
    expect(badge.getAttribute('title')).toContain('catalog_entities unwritable');
  });

  it('a persisted draft carries no browser-only badge', () => {
    useCatalogStore.setState({
      draftEntitiesByCatalog: {
        items: {
          [DRAFT_ID]: { id: DRAFT_ID, catalogId: 'items', name: 'Iron Hatchet', categoryPath: [], tags: [], lifecycle: 'planned' },
        },
      },
    });
    renderTree([{ id: DRAFT_ID, name: 'Iron Hatchet' }]);
    expect(screen.queryByTestId(`entity-browser-only-${DRAFT_ID}`)).toBeNull();
  });
});
