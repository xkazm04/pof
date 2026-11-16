/**
 * A step scoped to other canon profiles renders as a "·" span with an aria-label — but a
 * <span> with no role is a generic element, on which aria-label is prohibited and which
 * screen readers do not announce. The cell's whole meaning ("not part of this entity's
 * pipeline") lived in a name nothing reads. Every other cell is a named <button>.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

// Server artifacts for our synthetic catalog: varied statuses across 2 entities × 3 steps.
// Defined inside the factory because vi.mock is hoisted above top-level consts.
vi.mock('@/components/layout-lab/labArtifactClient', () => {
  const arts = [
    { catalogId: 'fixtures', entityId: 'e1', step: 'StepA', data: {}, ueAssets: [], status: 'pass', tier: 'L0' },
    { catalogId: 'fixtures', entityId: 'e1', step: 'StepB', data: {}, ueAssets: [], status: 'fail', tier: 'L0', reason: 'price/power 1.43x' },
    { catalogId: 'fixtures', entityId: 'e2', step: 'StepA', data: {}, ueAssets: [], status: 'pass', tier: 'L0' },
    { catalogId: 'fixtures', entityId: 'e2', step: 'StepC', data: {}, ueAssets: [], status: 'deferred', tier: 'L3' },
  ];
  return {
    fetchArtifacts: vi.fn().mockResolvedValue(arts),
    // The cache reads the Result form, so a failed GET can be told apart from an empty one.
    fetchArtifactsResult: vi.fn().mockResolvedValue({ ok: true, data: arts }),
  };
});

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

// e2's pipeline does not include StepB (a profile-scoped step), so its cell is not-applicable.
vi.mock('@/components/layout-lab/matrixRows', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/layout-lab/matrixRows')>();
  return {
    ...actual,
    buildMatrixRows: (...args: Parameters<typeof actual.buildMatrixRows>) =>
      actual.buildMatrixRows(...args).map((r) => (r.id === 'e2' ? { ...r, applies: (s: string) => s !== 'StepB' } : r)),
  };
});

import { CatalogMatrix } from '@/components/layout-lab/CatalogMatrix';
import { LIGHT } from '@/components/layout-lab/theme';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';

const groups = [{ category: 'Test', catalogs: [{ catalogId: 'fixtures', label: 'Fixtures', description: '', total: 2, verified: 0 }] }];

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); _resetArtifactCache(); });

describe('CatalogMatrix not-applicable cell is announced', () => {
  it('the cell carries a role that permits its aria-label', async () => {
    const { container } = render(<CatalogMatrix t={LIGHT} groups={groups} catalogId="fixtures" onSelectCatalog={vi.fn()} onOpenStep={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('[data-cell="e2::StepB"]')).toBeTruthy());
    const cells = Array.from(container.querySelectorAll<HTMLElement>('[data-status="not-applicable"]'));
    expect(cells.length).toBe(1);
    for (const c of cells) {
      expect(c.getAttribute('role')).toBe('img');
      expect(c.getAttribute('aria-label')).toMatch(/not part of this entity's pipeline/);
    }
  });
});
