/**
 * scan-sweep --challenge (module-topology-graph/B): the Evaluator's Conflicts tab shows
 * each overlap as a pair of twins with both matrix statuses, puts diverged twins first,
 * and dispatches a one-feature review of the lagging twin ON CLICK only. A failed
 * overlap read is an error with Retry, never 'No Overlaps Detected'; a failed status
 * read is "statuses unavailable", never a row of unreviewed twins with review buttons.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { OverlapReport, OverlapPair } from '@/lib/overlap-detection';
import type { FeatureStatusesResult } from '@/hooks/useFeatureStatuses';
import type { CLITask, FeatureReviewTask } from '@/lib/cli-task';

const apiFetch = vi.fn();
vi.mock('@/lib/api-utils', async (orig) => ({
  ...(await orig<typeof import('@/lib/api-utils')>()),
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

const execute = vi.fn<(task: CLITask) => Promise<void>>(async () => {});
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute, isRunning: false, sendPrompt: vi.fn() }),
}));

vi.mock('@/hooks/useModuleAggregates', () => ({ invalidateFeatureData: vi.fn() }));

const refresh = vi.fn();
let statuses: FeatureStatusesResult;
vi.mock('@/hooks/useFeatureStatuses', () => ({ useFeatureStatuses: () => statuses }));

import { CrossModuleOverlapPanel } from '@/components/modules/evaluator/CrossModuleOverlapPanel';

function statusResult(rows: Record<string, string>, failed = false): FeatureStatusesResult {
  return {
    statusMap: new Map(Object.entries(rows)),
    statuses: [],
    isLoading: false,
    loaded: true,
    failed,
    error: failed ? 'all-statuses read failed' : null,
    scope: null,
    refresh,
  };
}

function pair(moduleA: string, moduleB: string, featureName: string, similarity: number): OverlapPair {
  return {
    moduleA, moduleB, featureA: featureName, featureB: featureName,
    descriptionA: `${moduleA} desc`, descriptionB: `${moduleB} desc`, similarity,
    reason: 'name_match', suggestedOwner: moduleA, ownershipReason: 'heuristic',
  };
}

// The report lists the agreed-done pair first (equal similarity); divergence must still lead.
const REPORT: OverlapReport = {
  totalOverlaps: 2,
  overlaps: [
    pair('arpg-save', 'save-load', 'Save versioning', 1),
    pair('arpg-animation', 'animations', 'Animation state machine', 1),
  ],
  moduleSummaries: [],
  analyzedAt: 0,
};

const TWIN_STATUSES = {
  'arpg-animation::Animation state machine': 'implemented',
  'arpg-save::Save versioning': 'implemented',
  'save-load::Save versioning': 'improved',
};

beforeEach(() => {
  apiFetch.mockReset();
  execute.mockClear();
  refresh.mockClear();
  statuses = statusResult(TWIN_STATUSES);
});
afterEach(() => cleanup());

describe('CrossModuleOverlapPanel twins', () => {
  it('a failed overlap read shows an error with Retry, never the clean-separation empty state; Retry refetches', async () => {
    apiFetch.mockRejectedValue(new Error('overlap route exploded'));
    render(<CrossModuleOverlapPanel />);

    expect((await screen.findByRole('alert')).textContent).toContain('overlap route exploded');
    expect(screen.queryByText('No Overlaps Detected')).toBeNull();
    expect(screen.queryByText(/clean separation/)).toBeNull();
    expect(apiFetch).toHaveBeenCalledTimes(1);

    apiFetch.mockResolvedValue({ report: REPORT });
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    expect(apiFetch.mock.calls[1][0]).toBe('/api/feature-matrix/overlap');
    expect(await screen.findAllByText('Save versioning')).not.toHaveLength(0);
  });

  it('diverged twin sorts first; clicking its review dispatches ONE single-feature review of the lagging twin', async () => {
    apiFetch.mockResolvedValue({ report: REPORT });
    render(<CrossModuleOverlapPanel />);

    const reviews = await screen.findAllByRole('button', { name: /^Review in / });
    // The agreed-done pair (both implemented/improved) renders no review action.
    expect(reviews).toHaveLength(1);
    expect(reviews[0].textContent?.trim()).toBe('Review in Animations');
    expect(execute).not.toHaveBeenCalled();

    const toggles = screen.getAllByRole('button', { name: /overlap between/ });
    expect(toggles[0].getAttribute('aria-label')).toContain('Animation state machine');
    expect(toggles[0].getAttribute('aria-label')).toContain('Diverged: implemented | no status');

    fireEvent.click(reviews[0]);
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as FeatureReviewTask;
    expect(task.type).toBe('feature-review');
    expect(task.moduleId).toBe('animations');
    expect(task.features).toHaveLength(1);
    expect(task.features[0].featureName).toBe('Animation state machine');
  });

  it('a failed status read says statuses unavailable (with Retry) and offers no review action', async () => {
    statuses = statusResult({}, true);
    apiFetch.mockResolvedValue({ report: REPORT });
    render(<CrossModuleOverlapPanel />);

    expect((await screen.findByRole('alert')).textContent).toContain('Twin statuses unavailable');
    expect(screen.queryAllByRole('button', { name: /^Review in / })).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
