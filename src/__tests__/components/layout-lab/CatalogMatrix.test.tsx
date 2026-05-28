import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

// Server artifacts for our synthetic catalog: varied statuses across 2 entities × 3 steps.
// Defined inside the factory because vi.mock is hoisted above top-level consts.
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: vi.fn().mockResolvedValue([
    { catalogId: 'fixtures', entityId: 'e1', step: 'StepA', data: {}, ueAssets: [], status: 'pass', tier: 'L0' },
    { catalogId: 'fixtures', entityId: 'e1', step: 'StepB', data: {}, ueAssets: [], status: 'fail', tier: 'L0', reason: 'price/power 1.43x' },
    { catalogId: 'fixtures', entityId: 'e2', step: 'StepA', data: {}, ueAssets: [], status: 'pass', tier: 'L0' },
    { catalogId: 'fixtures', entityId: 'e2', step: 'StepC', data: {}, ueAssets: [], status: 'deferred', tier: 'L3' },
  ]),
}));

// Synthetic catalog detail (2 entities). Steps come from the registered pipeline below.
vi.mock('@/components/layout-lab/useLabCatalogData', () => ({
  useLabDetail: (id: string) => (id === 'fixtures' ? {
    catalog: { catalogId: 'fixtures', label: 'Fixtures', description: '', total: 2, verified: 0 },
    entities: [
      { id: 'e1', name: 'Entity One', lifecycle: 'planned', data: {} },
      { id: 'e2', name: 'Entity Two', lifecycle: 'planned', data: {} },
    ],
    steps: ['StepA', 'StepB', 'StepC'],
  } : null),
}));

// Synthetic pipeline so steps + resolveAccept (for blocker reasons) resolve. Partial mock
// so registerCatalogPipeline (used at import by the generated barrel) stays intact.
vi.mock('@/lib/catalog/pipeline-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog/pipeline-registry')>();
  const view = { kind: 'prose', field: 'x', emptyText: '' } as const;
  const produce = () => ({ data: {}, ueAssets: [] });
  return {
    ...actual,
    getCatalogPipeline: (id: string) => ({
      catalogId: id,
      steps: [
        { archetype: 'brief', label: 'StepA', view, produce, accept: () => ({ label: 'a', status: 'pass', tier: 'L0', detail: '' }) },
        { archetype: 'gate', label: 'StepB', view, produce, accept: () => ({ label: 'b', status: 'fail', tier: 'L0', detail: 'price/power 1.43x', reason: 'price/power 1.43x out of band' }) },
        { archetype: 'gate', label: 'StepC', view, produce, accept: () => ({ label: 'c', status: 'deferred', tier: 'L3', detail: '', reason: 'runner not run' }) },
      ],
    }),
  };
});

import { CatalogMatrix } from '@/components/layout-lab/CatalogMatrix';
import { LIGHT } from '@/components/layout-lab/theme';

const groups = [{ category: 'Test', catalogs: [{ catalogId: 'fixtures', label: 'Fixtures', description: '', total: 2, verified: 0 }] }];

function renderMatrix(onOpenStep = vi.fn()) {
  const utils = render(<CatalogMatrix t={LIGHT} groups={groups} catalogId="fixtures" onOpenStep={onOpenStep} />);
  return { ...utils, onOpenStep };
}

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const statusOf = (c: HTMLElement, cell: string) =>
  c.querySelector(`[data-cell="${cell}"]`)?.getAttribute('data-status');

describe('CatalogMatrix', () => {
  it('colors each cell by its server-derived acceptance status (and pending where no artifact)', async () => {
    const { container } = renderMatrix();
    await waitFor(() => expect(statusOf(container, 'e1::StepA')).toBe('pass'));
    expect(statusOf(container, 'e1::StepB')).toBe('fail');
    expect(statusOf(container, 'e1::StepC')).toBe('pending'); // no artifact → pending
    expect(statusOf(container, 'e2::StepA')).toBe('pass');
    expect(statusOf(container, 'e2::StepB')).toBe('pending');
    expect(statusOf(container, 'e2::StepC')).toBe('deferred');
  });

  it('summarizes "X/N done" per entity via summarizeEntity', async () => {
    const { container } = renderMatrix();
    await waitFor(() => expect(statusOf(container, 'e1::StepA')).toBe('pass'));
    expect(container.querySelector('[data-testid="matrix-progress-e1"]')?.textContent).toContain('1/3 done');
    expect(container.querySelector('[data-testid="matrix-progress-e2"]')?.textContent).toContain('1/3 done');
  });

  it('flags a blocker on the entity with a failed gate, using the accept() reason', async () => {
    const { container } = renderMatrix();
    await waitFor(() => expect(statusOf(container, 'e1::StepB')).toBe('fail'));
    const blocker = container.querySelector('[data-testid="matrix-blocker-e1"]');
    expect(blocker).toBeTruthy();
    expect(blocker?.getAttribute('title')).toContain('price/power 1.43x out of band');
    // The clean entity (e2) has no blocker badge.
    expect(container.querySelector('[data-testid="matrix-blocker-e2"]')).toBeNull();
  });

  it('shows catalog-wide config-complete / blocked counts', async () => {
    const { container } = renderMatrix();
    await waitFor(() => expect(statusOf(container, 'e1::StepB')).toBe('fail'));
    expect(container.querySelector('[data-testid="matrix-complete-count"]')?.textContent).toBe('0');
    expect(container.querySelector('[data-testid="matrix-blocked-count"]')?.textContent).toBe('1');
  });

  it('clicking a cell jumps to that entity + step index', async () => {
    const { container, onOpenStep } = renderMatrix();
    await waitFor(() => expect(statusOf(container, 'e1::StepB')).toBe('fail'));
    fireEvent.click(container.querySelector('[data-cell="e1::StepB"]') as HTMLElement);
    expect(onOpenStep).toHaveBeenCalledWith('fixtures', 'e1', 1);
    fireEvent.click(container.querySelector('[data-cell="e2::StepC"]') as HTMLElement);
    expect(onOpenStep).toHaveBeenCalledWith('fixtures', 'e2', 2);
  });
});
