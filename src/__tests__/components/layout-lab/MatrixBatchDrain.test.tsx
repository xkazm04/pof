import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { MatrixBatchDrain } from '@/components/layout-lab/MatrixBatchDrain';
import { emptyBatchSummary, summarizeBatchDrain, type BatchDrainSummary } from '@/components/layout-lab/batchDrainModel';
import type { BatchDrainState } from '@/components/layout-lab/hooks/useBatchDrain';
import { LIGHT } from '@/components/layout-lab/theme';

afterEach(cleanup);

const idleState = (summary: BatchDrainSummary | null, total = 3): BatchDrainState => ({
  running: false, activeEntityIds: new Set(), doneEntityIds: new Set(), summary, total,
});

const renderDrain = (state: BatchDrainState, onDismiss = vi.fn()) => {
  const utils = render(
    <MatrixBatchDrain
      t={LIGHT}
      deferredEntities={[{ id: 'e1', name: 'One' }]}
      state={state}
      onStart={vi.fn()}
      onCancel={vi.fn()}
      onDismiss={onDismiss}
    />,
  );
  return { ...utils, onDismiss };
};

describe('MatrixBatchDrain — summary is dismissible', () => {
  it('renders a dismiss control for a finished run and calls onDismiss', () => {
    const { onDismiss } = renderDrain(idleState({ ...emptyBatchSummary(), ran: 1, passed: 1 }));
    const btn = screen.getByTestId('batch-drain-dismiss');
    fireEvent.click(btn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('offers no dismiss while the batch is still running (a live run cannot be dismissed)', () => {
    renderDrain({
      running: true, activeEntityIds: new Set(['e1']), doneEntityIds: new Set(),
      summary: emptyBatchSummary(), total: 1,
    });
    expect(screen.queryByTestId('batch-drain-dismiss')).toBeNull();
  });

  it('renders nothing at all with no deferred entities and no run to report', () => {
    const { container } = render(
      <MatrixBatchDrain t={LIGHT} deferredEntities={[]} state={idleState(null, 0)}
        onStart={vi.fn()} onCancel={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('MatrixBatchDrain — a mixed drain result reaches the human', () => {
  // A REAL runner summary through the REAL model, not a hand-built UI fixture.
  const mixed = summarizeBatchDrain(
    [{ id: 'e1', name: 'One' }, { id: 'e2', name: 'Two' }],
    {
      kind: 'ok',
      summary: {
        ran: 3, passed: 1, failed: 1, deferred: 1, skipped: 2,
        screenshots: ['/tmp/pof_l4_scn_7/shot_02.png'],
        results: [
          { job: { catalogId: 'c', entityId: 'e1', step: 'A', tier: 'L3' }, verdict: { status: 'pass', detail: 'ok' } },
          { job: { catalogId: 'c', entityId: 'e1', step: 'B', tier: 'L3' }, verdict: { status: 'fail', detail: 'price/power 1.43x' } },
          { job: { catalogId: 'c', entityId: 'e2', step: 'C', tier: 'L4' }, verdict: { status: 'deferred', detail: 'judge unavailable' } },
          { job: { catalogId: 'c', entityId: 'e2', step: 'D', tier: 'L3' }, skipped: 'limit reached' },
          { job: { catalogId: 'c', entityId: 'e2', step: 'E', tier: 'L3' }, skipped: 'no L3 executor' },
        ],
      },
    },
  );

  it('labels deferred and skipped as the DIFFERENT things they are', () => {
    renderDrain(idleState(mixed));
    const text = screen.getByTestId('batch-drain-summary').textContent ?? '';
    expect(text).toContain('1 passed');
    expect(text).toContain('1 failed');
    expect(text).toContain('1 deferred');
    expect(text).toContain('2 skipped');
    // The old copy called SKIPPED gates "still deferred" — two lies in three words.
    expect(text).not.toContain('still deferred');
  });

  it('surfaces the deferral reason, separately from the fail reason', () => {
    renderDrain(idleState(mixed));
    expect(screen.getByTestId('batch-drain-fails').textContent).toContain('price/power 1.43x');
    const deferrals = screen.getByTestId('batch-drain-deferrals').textContent ?? '';
    expect(deferrals).toContain('judge unavailable');
    expect(deferrals).toContain('Two');
    expect(deferrals).toContain('C');
  });

  it('makes every captured frame reachable through the path-jailed frame route', () => {
    renderDrain(idleState(mixed));
    const link = screen.getByTestId('batch-drain-frame-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(
      `/api/pipeline-artifacts/drain/frame?path=${encodeURIComponent('/tmp/pof_l4_scn_7/shot_02.png')}`,
    );
    // A relative URL (repo law) and a real thumbnail, not just a path printed as text.
    expect(link.getAttribute('href')?.startsWith('/api/')).toBe(true);
    const img = link.querySelector('img');
    expect(img?.getAttribute('alt')).toContain('pof_l4_scn_7/shot_02.png');
  });

  it('shows no frame / deferral sections when the drain produced none', () => {
    renderDrain(idleState({ ...emptyBatchSummary(), ran: 1, passed: 1 }));
    expect(screen.queryByTestId('batch-drain-frames')).toBeNull();
    expect(screen.queryByTestId('batch-drain-deferrals')).toBeNull();
  });

  it('holds the reason lists and frames back while the batch is still in flight', () => {
    renderDrain({
      running: true, activeEntityIds: new Set(['e1']), doneEntityIds: new Set(),
      summary: mixed, total: 2,
    });
    expect(screen.queryByTestId('batch-drain-fails')).toBeNull();
    expect(screen.queryByTestId('batch-drain-deferrals')).toBeNull();
    expect(screen.queryByTestId('batch-drain-frames')).toBeNull();
  });
});
