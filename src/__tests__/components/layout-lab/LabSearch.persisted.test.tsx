/**
 * Lab search indexed `entitiesByCatalog` (the code seeds) only, while the tree lists seeds +
 * persisted rows (`labEntitiesOf`). So a hydrated `/diablo` ingest or another session's
 * one-shot sat in the tree and could not be searched — and a non-default game, whose entities
 * are ALL persisted rows, had no searchable entity at all and every step hit fell back to the
 * catalog.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { LabSearch } from '@/components/layout-lab/LabSearch';
import { useCatalogStore } from '@/stores/catalogStore';
import { useActiveGameStore } from '@/stores/activeGameStore';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const onSelectCatalog = vi.fn();
const onNavigate = vi.fn();
const type = (v: string) => fireEvent.change(screen.getByTestId('lab-search-input'), { target: { value: v } });
const entityHits = () => screen.queryAllByTestId('lab-search-option').filter((o) => within(o).queryByText('entity'));

const gtaiQuest: StoredCatalogEntity = {
  id: 'gtai-first-hit', catalogId: 'quests', name: 'Zorblax First Hit', categoryPath: [], tags: [], lifecycle: 'planned',
  provenance: { kind: 'authored', canonProfile: 'gtai', authoredVia: 'intake', authoredAt: '2026-11-01T00:00:00Z' },
} as StoredCatalogEntity;

beforeEach(() => {
  onSelectCatalog.mockReset(); onNavigate.mockReset();
  act(() => { useCatalogStore.getState().hydratePersisted([{ catalogId: 'quests', entityId: gtaiQuest.id, source: 'intake', entity: gtaiQuest }]); });
});
afterEach(() => {
  cleanup();
  useCatalogStore.setState({ draftEntitiesByCatalog: {} });
  useActiveGameStore.setState({ gameId: 'pof', showAllPipelines: false });
});

describe('<LabSearch /> — finds the entities the tree lists', () => {
  it('a persisted entity of the active game is a searchable entity hit', () => {
    act(() => { useActiveGameStore.setState({ gameId: 'gtai', showAllPipelines: false }); });
    render(<LabSearch open onClose={() => {}} currentEntityId={null} onSelectCatalog={onSelectCatalog} onNavigate={onNavigate} />);
    type('zorblax');
    expect(entityHits()).toHaveLength(1);
    fireEvent.click(entityHits()[0]);
    expect(onNavigate).toHaveBeenCalledWith('quests', 'gtai-first-hit', 0);
  });

  it('stays game-scoped: the gtai entity is not a hit under pof', () => {
    render(<LabSearch open onClose={() => {}} currentEntityId={null} onSelectCatalog={onSelectCatalog} onNavigate={onNavigate} />);
    type('zorblax');
    expect(entityHits()).toHaveLength(0);
  });
});
