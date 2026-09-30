/**
 * scan-sweep --challenge catalog-browser-ui/A — a lab-search step hit names a step by LABEL and
 * resolves its index against the TARGET entity's own step list (profile-scoped steps, D18).
 * It used to carry the index in the catalog-wide list, which opens a different step (or an
 * empty canvas) on an entity whose pipeline is scoped.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import '@/lib/catalog/pipelines/registry.generated';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { LabSearch } from '@/components/layout-lab/LabSearch';
import { resolveCatalogSteps } from '@/components/layout-lab/catalogManifest';
import { useCatalogStore } from '@/stores/catalogStore';

const onSelectCatalog = vi.fn();
const onNavigate = vi.fn();
const onClose = vi.fn();

const entity = (id: string, canonProfile?: string) => ({
  id, catalogId: 'dialog-trees', name: id, categoryPath: [], tags: [], lifecycle: 'planned', data: {},
  ...(canonProfile ? {
    provenance: {
      kind: 'ingest', sourceGame: 'Diablo I (1996)', sourceProject: 'p', sourceFile: 'f', sourceRow: id,
      licenceNote: 'n', ingestedAt: '2026-01-01', canonProfile,
    },
  } : {}),
});
const setDialogs = (...rows: ReturnType<typeof entity>[]) => {
  const prev = useCatalogStore.getState().entitiesByCatalog;
  useCatalogStore.setState({ entitiesByCatalog: { ...prev, 'dialog-trees': Object.fromEntries(rows.map((r) => [r.id, r])) } } as never);
};
const selectStep = (current: string | null, step: string) => {
  render(<LabSearch open onClose={onClose} currentEntityId={current} onSelectCatalog={onSelectCatalog} onNavigate={onNavigate} />);
  fireEvent.change(screen.getByTestId('lab-search-input'), { target: { value: `${step} dialog-trees`.toLowerCase() } });
  const hit = screen.queryAllByTestId('lab-search-option').find((o) => within(o).queryByText('step') && within(o).queryByText(step));
  expect(hit).toBeTruthy();
  fireEvent.click(hit!);
};

let saved: ReturnType<typeof useCatalogStore.getState>['entitiesByCatalog'];
beforeEach(() => {
  saved = useCatalogStore.getState().entitiesByCatalog;
  onSelectCatalog.mockReset(); onNavigate.mockReset(); onClose.mockReset();
});
afterEach(() => { cleanup(); useCatalogStore.setState({ entitiesByCatalog: saved }); });

describe('<LabSearch /> step hits resolve against the target entity\'s own steps', () => {
  it('opens "Test Gate" at the open diablo1 dialog\'s OWN index (8), not the catalog index (10)', () => {
    expect(resolveCatalogSteps('dialog-trees').indexOf('Test Gate')).toBe(10);
    setDialogs(entity('pof-a'), entity('d1-a', 'diablo1'));
    selectStep('d1-a', 'Test Gate');
    expect(onNavigate).toHaveBeenCalledWith('dialog-trees', 'd1-a', 8);
  });

  it('a step the open entity lacks ("Skill Checks") lands on the first entity whose pipeline has it', () => {
    setDialogs(entity('d1-a', 'diablo1'), entity('pof-a'));
    selectStep('d1-a', 'Skill Checks');
    expect(onNavigate).toHaveBeenCalledWith('dialog-trees', 'pof-a', resolveCatalogSteps('dialog-trees').indexOf('Skill Checks'));
  });

  it('no entity has the step → selects the catalog only', () => {
    setDialogs(entity('d1-a', 'diablo1'), entity('d1-b', 'diablo1'));
    selectStep('d1-a', 'Skill Checks');
    expect(onNavigate).not.toHaveBeenCalled();
    expect(onSelectCatalog).toHaveBeenCalledWith('dialog-trees');
  });
});
