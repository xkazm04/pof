/**
 * scan-sweep night 2026-11-08 (module-topology-graph): the 'Modules by Overlap Count'
 * heatmap sliced moduleSummaries to 12 with no sign that more modules overlap.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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
import { SUB_MODULE_MAP } from '@/lib/module-registry';

const IDS = Object.keys(SUB_MODULE_MAP).slice(0, 20);

const report = (summaries: number): OverlapReport => ({
  totalOverlaps: 1,
  overlaps: [{
    moduleA: 'arpg-save', moduleB: 'save-load', featureA: 'Save versioning', featureB: 'Save versioning',
    descriptionA: 'a', descriptionB: 'b', similarity: 0.9, reason: 'name_match', suggestedOwner: 'arpg-save', ownershipReason: 'r',
  }],
  moduleSummaries: IDS.slice(0, summaries).map((moduleId, i) => ({
    moduleId, overlapCount: 20 - i, overlappingModules: ['arpg-save'], topOverlaps: [],
  })) as never,
  analyzedAt: 0,
});

beforeEach(() => apiFetch.mockReset());
afterEach(cleanup);

describe('CrossModuleOverlapPanel — heatmap cap disclosure', () => {
  it('15 summaries draw 12 bubbles and say "+3 more"', async () => {
    apiFetch.mockResolvedValue({ report: report(15) });
    const { container } = render(<CrossModuleOverlapPanel />);
    await screen.findByText('+3 more');
    expect(container.querySelectorAll('[title*="overlaps with"]')).toHaveLength(12);
  });

  it('12 summaries show no disclosure', async () => {
    apiFetch.mockResolvedValue({ report: report(12) });
    const { container } = render(<CrossModuleOverlapPanel />);
    await screen.findByText('Modules by Overlap Count');
    expect(container.querySelectorAll('[title*="overlaps with"]')).toHaveLength(12);
    expect(screen.queryByText(/^\+\d+ more$/)).toBeNull();
  });
});
