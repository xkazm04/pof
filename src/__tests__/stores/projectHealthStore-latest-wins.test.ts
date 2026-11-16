/**
 * `fetchHealth` is latest-wins. Two views (HolisticHealthView, CalendarRoadmapView)
 * call it with different inputs, and HolisticHealthView re-fires as soon as the
 * crash stats arrive — so two POSTs overlap. Whichever resolved LAST used to win,
 * and the first to resolve cleared `isLoading` while the newer one was in flight.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const pending: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];
vi.mock('@/lib/api-utils', () => ({
  apiFetch: vi.fn(() => new Promise((resolve, reject) => { pending.push({ resolve, reject }); })),
}));

import { useProjectHealthStore } from '@/stores/projectHealthStore';
import type { ProjectHealthSummary } from '@/types/project-health';

function summary(tag: string): ProjectHealthSummary {
  return {
    tag, moduleHealth: [], velocityHistory: [], qualityHistory: [],
    milestones: [], burnChart: [], subsystemSignals: [],
  } as unknown as ProjectHealthSummary;
}

const call = () => useProjectHealthStore.getState().fetchHealth({}, [], null);

describe('projectHealthStore.fetchHealth — latest wins', () => {
  beforeEach(() => {
    pending.length = 0;
    useProjectHealthStore.setState({ summary: null, isLoading: false, error: null });
  });

  it('an older response that resolves last does not overwrite the newer one', async () => {
    const first = call();
    const second = call();
    pending[1].resolve(summary('newer'));
    await second;
    pending[0].resolve(summary('older'));
    await first;
    expect((useProjectHealthStore.getState().summary as unknown as { tag: string }).tag).toBe('newer');
  });

  it('an older response does not clear isLoading while the newer one is in flight', async () => {
    const first = call();
    void call();
    pending[0].resolve(summary('older'));
    await first;
    expect(useProjectHealthStore.getState().isLoading).toBe(true);
  });

  it('an older failure does not paint an error over the newer success', async () => {
    const first = call();
    const second = call();
    pending[1].resolve(summary('newer'));
    await second;
    pending[0].reject(new Error('stale boom'));
    await first;
    expect(useProjectHealthStore.getState().error).toBeNull();
  });
});
