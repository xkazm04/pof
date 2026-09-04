import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { MatrixBatchDrain } from '@/components/layout-lab/MatrixBatchDrain';
import { emptyBatchSummary, type BatchDrainSummary } from '@/components/layout-lab/batchDrainModel';
import type { BatchDrainState } from '@/components/layout-lab/hooks/useBatchDrain';
import { drainLane } from '@/components/layout-lab/activityModel';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { LIGHT } from '@/components/layout-lab/theme';

afterEach(() => {
  cleanup();
  usePofBridgeStore.setState({ connectionStatus: 'disconnected' });
});

const idle = (summary: BatchDrainSummary | null, total = 3): BatchDrainState => ({
  running: false, cancelRequested: false, cancelEffect: null,
  activeEntityIds: new Set(), doneEntityIds: new Set(), summary, total,
});

const renderDrain = (state: BatchDrainState, deferredEntities = [{ id: 'e1', name: 'One' }]) =>
  render(
    <MatrixBatchDrain t={LIGHT} deferredEntities={deferredEntities} state={state}
      onStart={vi.fn()} onCancel={vi.fn()} onDismiss={vi.fn()} />,
  );

/**
 * The lab sends neither `executor` nor `allowSpawn`, so `buildExecutors` always builds the
 * BRIDGE executor: the drain runs THROUGH an already-running UE editor and can never boot one.
 * Copy that promises "one editor boot" describes a capability this button does not have.
 */
describe('MatrixBatchDrain — the copy describes the bridge, not a boot it cannot cause', () => {
  it('does not claim an editor boot while running', () => {
    renderDrain({
      running: true, cancelRequested: false, cancelEffect: null,
      activeEntityIds: new Set(['e1']), doneEntityIds: new Set(),
      summary: emptyBatchSummary(), total: 2,
    });
    const progress = screen.getByTestId('batch-drain-progress').textContent ?? '';
    expect(progress).not.toMatch(/boot/i);
    expect(progress).toMatch(/editor/i);
  });

  it('does not claim an uninterruptible boot in the cancel scope copy', () => {
    renderDrain({
      running: true, cancelRequested: false, cancelEffect: null,
      activeEntityIds: new Set(['e1']), doneEntityIds: new Set(),
      summary: emptyBatchSummary(), total: 2,
    });
    expect(screen.getByTestId('batch-drain-cancel-scope').textContent ?? '').not.toMatch(/boot/i);
  });

  it('discloses BEFORE the click that the drain needs a running UE editor — without disabling', () => {
    renderDrain(idle(null, 0));
    const note = screen.getByTestId('batch-drain-executor-note');
    expect(note.textContent ?? '').toMatch(/running UE editor/i);
    const btn = screen.getByTestId('batch-drain-start') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('says the editor is connected once the bridge is up', () => {
    usePofBridgeStore.setState({ connectionStatus: 'connected' });
    renderDrain(idle(null, 0));
    expect(screen.getByTestId('batch-drain-executor-note').textContent ?? '').toMatch(/connected/i);
  });
});

/**
 * "Never ran — no available executor" used to live ONLY in a hover `title`. A drain where
 * nothing ran at all is the loudest fact of the run, not a tooltip.
 */
describe('MatrixBatchDrain — a run with no executor says so first-class', () => {
  it('renders the no-executor line when nothing ran and every gate was skipped', () => {
    renderDrain(idle({ ...emptyBatchSummary(), ran: 0, skipped: 4 }));
    const line = screen.getByTestId('batch-drain-no-executor').textContent ?? '';
    expect(line).toMatch(/0 gates ran/i);
    expect(line).toMatch(/no UE executor was available/i);
  });

  it('does not claim a missing executor when gates actually ran', () => {
    renderDrain(idle({ ...emptyBatchSummary(), ran: 3, passed: 2, skipped: 1 }));
    expect(screen.queryByTestId('batch-drain-no-executor')).toBeNull();
  });

  it('says nothing about executors for a locked batch (the lease refused it, not the executor)', () => {
    renderDrain(idle({ ...emptyBatchSummary(), entitiesLocked: 2 }));
    expect(screen.queryByTestId('batch-drain-no-executor')).toBeNull();
  });
});

describe('activityModel.drainLane — the label stops asserting a boot', () => {
  it('names the bridge instead of an editor boot', () => {
    const lane = drainLane({ localDrain: 'items · 3 sets', leaseProbe: 'ok', lease: null });
    expect(lane.label).not.toMatch(/boot/i);
    expect(lane.label).toMatch(/bridge/i);
  });

  it('names the executor mode in the blind spot', () => {
    const lane = drainLane({ localDrain: null, leaseProbe: 'ok', lease: null });
    expect(lane.blindSpot).toMatch(/bridge/i);
  });
});
