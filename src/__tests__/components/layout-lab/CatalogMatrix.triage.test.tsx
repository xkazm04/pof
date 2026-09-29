/**
 * scan-sweep --challenge catalog-browser-ui/B — the Matrix renders its triage: rows ranked by the
 * coach ladder, a rung chip filters the board (the caption carries the predicate), and the
 * filtered set opens as a work queue. With no predicate the board is every row, every cell.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

// Five entities over StepA/B/C. Each artifact's `data.__status` is what the checker reads.
vi.mock('@/components/layout-lab/labArtifactClient', () => {
  const a = (entityId: string, step: string, status: string) =>
    ({ catalogId: 'fixtures', entityId, step, data: { __status: status }, ueAssets: [], status, tier: 'L0' });
  const arts = [
    // e1: nothing produced → unproduced
    a('e2', 'StepA', 'pass'), a('e2', 'StepB', 'pass'), a('e2', 'StepC', 'deferred'),
    a('e3', 'StepA', 'fail'),
    a('e4', 'StepA', 'pass'), a('e4', 'StepB', 'pass'), a('e4', 'StepC', 'pass'),
    a('e5', 'StepA', 'pass'), a('e5', 'StepC', 'deferred'),
  ];
  return {
    fetchArtifacts: vi.fn().mockResolvedValue(arts),
    fetchArtifactsResult: vi.fn().mockResolvedValue({ ok: true, data: arts }),
  };
});

// Storage order deliberately scrambled: the board must not depend on it.
vi.mock('@/components/layout-lab/useLabCatalogData', () => ({
  useLabDetail: (id: string) => (id === 'fixtures' ? {
    catalog: { catalogId: 'fixtures', label: 'Fixtures', description: '', total: 5, verified: 0 },
    entities: ['e4', 'e1', 'e5', 'e2', 'e3'].map((e) => ({ id: e, name: `Entity ${e}`, lifecycle: 'planned', data: {} })),
    steps: ['StepA', 'StepB', 'StepC'],
  } : null),
}));

vi.mock('@/lib/catalog/pipeline-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog/pipeline-registry')>();
  const view = { kind: 'prose', field: 'x', emptyText: '' } as const;
  const produce = () => ({ data: {}, ueAssets: [] });
  const accept = (label: string) => (data: Record<string, unknown>) =>
    ({ label, status: (data.__status as string) ?? 'pass', tier: 'L0', detail: '', reason: 'fixture' });
  return {
    ...actual,
    getCatalogPipeline: (id: string) => ({
      catalogId: id,
      steps: ['StepA', 'StepB', 'StepC'].map((label) => ({ archetype: 'gate', label, view, produce, accept: accept(label) })),
    }),
  };
});

import { CatalogMatrix } from '@/components/layout-lab/CatalogMatrix';
import { LIGHT } from '@/components/layout-lab/theme';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';

const groups = [{ category: 'Test', catalogs: [{ catalogId: 'fixtures', label: 'Fixtures', description: '', total: 5, verified: 0 }] }];

function renderMatrix() {
  const onOpenStep = vi.fn();
  const onOpenQueue = vi.fn();
  const utils = render(<CatalogMatrix t={LIGHT} groups={groups} catalogId="fixtures" onSelectCatalog={vi.fn()} onOpenStep={onOpenStep} onOpenQueue={onOpenQueue} />);
  return { ...utils, onOpenStep, onOpenQueue };
}
const bodyRows = (c: HTMLElement) => [...c.querySelectorAll('tbody tr')] as HTMLElement[];
const rowIds = (c: HTMLElement) => bodyRows(c).map((tr) => tr.querySelector('[data-cell]')?.getAttribute('data-cell')?.split('::')[0]);
const ready = (c: HTMLElement) => waitFor(() => expect(c.querySelector('[data-cell="e3::StepA"]')?.getAttribute('data-status')).toBe('fail'));

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); _resetArtifactCache(); });

describe('CatalogMatrix triage', () => {
  it('ranks the board by the coach ladder, then entity id — never storage order', async () => {
    const { container } = renderMatrix();
    await ready(container);
    expect(rowIds(container)).toEqual(['e3', 'e2', 'e5', 'e1', 'e4']);
  });

  it('the "deferred 2" chip filters the board to 2 rows, captioned; "Work these 2" opens the queue at item 1', async () => {
    const { container, onOpenQueue } = renderMatrix();
    await ready(container);
    const chip = container.querySelector('[data-testid="triage-chip-deferred"]') as HTMLElement;
    expect(chip.textContent).toContain('deferred');
    expect(chip.textContent).toContain('2');
    fireEvent.click(chip);
    expect(bodyRows(container)).toHaveLength(2);
    expect(rowIds(container)).toEqual(['e2', 'e5']);
    expect(container.querySelector('[data-testid="matrix-triage-caption"]')?.textContent).toBe('2 of 5 · deferred');

    const work = container.querySelector('[data-testid="matrix-work-queue"]') as HTMLElement;
    expect(work.textContent).toBe('Work these 2');
    fireEvent.click(work);
    expect(onOpenQueue).toHaveBeenCalledTimes(1);
    const queue = onOpenQueue.mock.calls[0][0];
    expect(queue.items).toHaveLength(2);
    expect({ catalogId: queue.catalogId, entityId: queue.items[0].entityId, stepIndex: queue.items[0].stepIndex })
      .toEqual({ catalogId: 'fixtures', entityId: 'e2', stepIndex: 2 });
  });

  it('[guard] with no predicate: every row and every cell button, and a cell click opens that step', async () => {
    const { container, onOpenStep } = renderMatrix();
    await ready(container);
    expect(bodyRows(container)).toHaveLength(5);
    expect(container.querySelectorAll('button[data-cell]')).toHaveLength(15);
    fireEvent.click(container.querySelector('[data-cell="e5::StepC"]') as HTMLElement);
    expect(onOpenStep).toHaveBeenCalledWith('fixtures', 'e5', 2);
  });
});
