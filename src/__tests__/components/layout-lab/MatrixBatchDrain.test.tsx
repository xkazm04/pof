import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { MatrixBatchDrain } from '@/components/layout-lab/MatrixBatchDrain';
import { emptyBatchSummary, type BatchDrainSummary } from '@/components/layout-lab/batchDrainModel';
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
