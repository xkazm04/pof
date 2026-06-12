import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

const apiFetch = vi.fn();
vi.mock('@/lib/api-utils', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));
vi.mock('@/stores/projectStore', () => ({
  useProjectStore: (sel: (s: unknown) => unknown) =>
    sel({ projectPath: '/proj', projectName: 'P', ueVersion: '5.5' }),
}));

import { BatchReviewPanel } from '@/components/modules/evaluator/BatchReviewPanel';

const runningBatch = {
  batchId: 'b1', status: 'running', startedAt: '2026-06-12T00:00:00Z', completedAt: null,
  currentIndex: 0,
  modules: [{ moduleId: 'arpg-combat', label: 'Combat', featureCount: 3, status: 'running', executionId: 'e', startedAt: null, completedAt: null, error: null }],
};

beforeEach(() => { apiFetch.mockReset(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('BatchReviewPanel poll lifecycle', () => {
  it('resumes polling on mount when a running batch is observed (not only after startBatch)', async () => {
    // GET /batch-review always reports a running batch — as if the user
    // remounted / reloaded mid-run without ever clicking Start in this mount.
    apiFetch.mockResolvedValue({ batch: runningBatch });

    render(<BatchReviewPanel />);

    // Initial fetch from the mount effect.
    await vi.advanceTimersByTimeAsync(0);
    const afterMount = apiFetch.mock.calls.length;
    expect(afterMount).toBeGreaterThanOrEqual(1);

    // The interval is armed off the observed `running` status — advancing past
    // the 3s poll period must trigger another fetch. The old code only created
    // the interval inside startBatch, so this would never fire.
    await vi.advanceTimersByTimeAsync(3100);
    expect(apiFetch.mock.calls.length).toBeGreaterThan(afterMount);
  });
});
