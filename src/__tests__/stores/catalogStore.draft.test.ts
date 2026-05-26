import { describe, it, expect, beforeEach } from 'vitest';
import { useCatalogStore } from '@/stores/catalogStore';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const draftItem = (): StoredCatalogEntity => ({
  id: 'draft-items-test1',
  catalogId: 'items',
  name: 'Test Draft Item',
  categoryPath: ['Weapon', 'Sword', 'Common'],
  tags: ['one-shot'],
  lifecycle: 'planned',
  data: { rarity: 'Common', type: 'Weapon' },
});

describe('catalogStore.draftEntitiesByCatalog', () => {
  beforeEach(() => {
    useCatalogStore.setState({ draftEntitiesByCatalog: {} });
  });

  it('starts empty', () => {
    expect(useCatalogStore.getState().draftEntitiesByCatalog).toEqual({});
  });

  it('addDraft inserts under the catalog key', () => {
    const d = draftItem();
    useCatalogStore.getState().addDraft('items', d);
    expect(useCatalogStore.getState().draftEntitiesByCatalog.items[d.id]).toEqual(d);
  });

  it('removeDraft deletes only that entity', () => {
    const a = { ...draftItem(), id: 'draft-items-a' };
    const b = { ...draftItem(), id: 'draft-items-b' };
    useCatalogStore.getState().addDraft('items', a);
    useCatalogStore.getState().addDraft('items', b);
    useCatalogStore.getState().removeDraft('items', a.id);
    expect(useCatalogStore.getState().draftEntitiesByCatalog.items[a.id]).toBeUndefined();
    expect(useCatalogStore.getState().draftEntitiesByCatalog.items[b.id]).toEqual(b);
  });

  it('drafts are scoped to their catalog', () => {
    useCatalogStore.getState().addDraft('items', draftItem());
    expect(useCatalogStore.getState().draftEntitiesByCatalog.bestiary).toBeUndefined();
  });
});
