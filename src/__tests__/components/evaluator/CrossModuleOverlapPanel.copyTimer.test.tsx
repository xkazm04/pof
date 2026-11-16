/**
 * scan-sweep night 2026-11-08 (module-topology-graph): handleCopy scheduled
 * setCopiedId(null) with a bare setTimeout that was never cleared, so leaving the
 * Conflicts tab inside the feedback window fired the timer against an unmounted panel.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
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
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('CrossModuleOverlapPanel — Copied-feedback timer', () => {
  it('no timer outlives the panel when it unmounts inside the feedback window', async () => {
    const utils = render(<CrossModuleOverlapPanel />);
    const copy = await screen.findByRole('button', { name: /Copy overlap details/ });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await act(async () => {
      fireEvent.click(copy);
      for (let i = 0; i < 5; i++) await Promise.resolve();
    });
    expect(vi.getTimerCount()).toBe(1);
    utils.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
