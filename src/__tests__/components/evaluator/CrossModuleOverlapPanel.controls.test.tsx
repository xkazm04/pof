/**
 * scan-sweep night 2026-11-08 (module-topology-graph): the Conflicts tab's controls.
 * - The "All" filter chip was given `color="var(--text-muted)"`, which FilterChip suffixes
 *   with a hex alpha (`var(--text-muted)18`) — invalid CSS, so the ACTIVE "All" chip
 *   painted no background and no border, indistinguishable from an inactive one. The
 *   chips also exposed their pressed state to nobody.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { OverlapReport } from '@/lib/overlap-detection';
import type { FeatureStatusesResult } from '@/hooks/useFeatureStatuses';

const apiFetch = vi.fn();
vi.mock('@/lib/api-utils', async (orig) => ({
  ...(await orig<typeof import('@/lib/api-utils')>()),
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(), isRunning: false, sendPrompt: vi.fn() }),
}));
vi.mock('@/hooks/useModuleAggregates', () => ({ invalidateFeatureData: vi.fn() }));
const statuses: FeatureStatusesResult = {
  statusMap: new Map(), statuses: [], isLoading: false, loaded: true, failed: false, error: null, scope: null, refresh: vi.fn(),
};
vi.mock('@/hooks/useFeatureStatuses', () => ({ useFeatureStatuses: () => statuses }));

import { CrossModuleOverlapPanel } from '@/components/modules/evaluator/CrossModuleOverlapPanel';

const REPORT: OverlapReport = {
  totalOverlaps: 1,
  overlaps: [{
    moduleA: 'arpg-save', moduleB: 'save-load', featureA: 'Save versioning', featureB: 'Save versioning',
    descriptionA: 'a', descriptionB: 'b', similarity: 0.9, reason: 'name_match', suggestedOwner: 'arpg-save', ownershipReason: 'r',
  }],
  moduleSummaries: [],
  analyzedAt: 0,
};

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({ report: REPORT });
});
afterEach(cleanup);

describe('CrossModuleOverlapPanel filter chips', () => {
  it('the active chip — including "All" — paints a background and border and reports aria-pressed', async () => {
    render(<CrossModuleOverlapPanel />);
    const all = (await screen.findByRole('button', { name: 'All' })) as HTMLButtonElement;
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(all.style.backgroundColor).not.toBe('');
    expect(all.style.borderColor).not.toBe('');

    const nameMatch = screen.getByRole('button', { name: /^Name Match/ });
    expect(nameMatch.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(nameMatch);
    expect(nameMatch.getAttribute('aria-pressed')).toBe('true');
    expect(nameMatch.style.backgroundColor).not.toBe('');
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('false');
  });
});
