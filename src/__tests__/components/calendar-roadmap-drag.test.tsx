import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { mockFetch } from '@/__tests__/setup';

/**
 * The deadline-drag handler attaches window mousemove/mouseup listeners. They
 * used to be removed only on mouseup, leaking (and firing setState after
 * unmount) if the component unmounted mid-drag. The fix scopes them to a
 * per-drag AbortController that the unmount effect aborts. These tests verify
 * that the listeners are signal-scoped and the signal is aborted on teardown.
 */

const state = vi.hoisted(() => ({
  milestones: [{
    id: 'ms-1',
    name: 'Combat',
    targetCompletion: 100,
    predictedDate: '2026-06-01T12:00:00.000Z',
    predictedWeeks: 1,
    currentProgress: 50,
    color: 'var(--color-module-core)',
  }],
  summary: { overallCompletion: 50 },
  fetchHealth: vi.fn(),
}));

vi.mock('@/stores/projectHealthStore', () => ({
  useProjectHealthStore: (sel: (s: unknown) => unknown) => sel(state),
}));
vi.mock('@/stores/moduleStore', () => ({
  useModuleStore: (sel: (s: unknown) => unknown) => sel({ checklistProgress: {} }),
}));
vi.mock('@/stores/evaluatorStore', () => ({
  useEvaluatorStore: (sel: (s: unknown) => unknown) => sel({ scanHistory: [], lastScan: null }),
}));

import { CalendarRoadmapView } from '@/components/modules/evaluator/CalendarRoadmapView';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

beforeEach(() => {
  mockFetch({ body: { success: true, data: { 'ms-1': { targetDate: '2026-06-01T12:00:00.000Z', label: '' } } } });
});

function signalFromDragStart(addSpy: ReturnType<typeof vi.spyOn>): AbortSignal {
  const moveCall = addSpy.mock.calls.find((c: unknown[]) => c[0] === 'mousemove');
  const upCall = addSpy.mock.calls.find((c: unknown[]) => c[0] === 'mouseup');
  expect(moveCall, 'mousemove listener registered on drag start').toBeTruthy();
  expect(upCall, 'mouseup listener registered on drag start').toBeTruthy();
  const moveOpts = moveCall![2] as AddEventListenerOptions;
  const upOpts = upCall![2] as AddEventListenerOptions;
  // Both listeners must share one abort signal so a single abort tears down both.
  expect(moveOpts?.signal).toBeInstanceOf(AbortSignal);
  expect(upOpts?.signal).toBe(moveOpts.signal);
  return moveOpts.signal!;
}

describe('CalendarRoadmapView — drag listener lifecycle', () => {
  it('aborts the drag listeners when the component unmounts mid-drag', async () => {
    const { findByTestId, unmount } = render(<CalendarRoadmapView />);
    const marker = await findByTestId('deadline-marker-ms-1');

    const addSpy = vi.spyOn(window, 'addEventListener');
    fireEvent.mouseDown(marker, { clientX: 300 });

    const signal = signalFromDragStart(addSpy);
    expect(signal.aborted).toBe(false);

    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('aborts the drag listeners on mouseup (normal drag end)', async () => {
    const { findByTestId } = render(<CalendarRoadmapView />);
    const marker = await findByTestId('deadline-marker-ms-1');

    const addSpy = vi.spyOn(window, 'addEventListener');
    fireEvent.mouseDown(marker, { clientX: 300 });
    const signal = signalFromDragStart(addSpy);

    fireEvent.mouseUp(window);
    await waitFor(() => expect(signal.aborted).toBe(true));
  });
});
