/**
 * scan-sweep night 2026-11-08 (module-topology-graph): FeatureConstellation and the
 * Conflicts panel rendered a bare spinning icon on first load - no live region, no
 * label - while DependencyGraph and Nexus announce "Loading feature statuses".
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { FeatureStatusesResult } from '@/hooks/useFeatureStatuses';

vi.mock('@/lib/api-utils', async (orig) => ({
  ...(await orig<typeof import('@/lib/api-utils')>()),
  apiFetch: () => new Promise(() => {}),
}));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(), isRunning: false, sendPrompt: vi.fn() }),
}));
vi.mock('@/hooks/useModuleAggregates', () => ({ invalidateFeatureData: vi.fn() }));
const loading: FeatureStatusesResult = {
  statusMap: new Map(), statuses: [], isLoading: true, loaded: false, failed: false, error: null, scope: null, refresh: vi.fn(),
};
vi.mock('@/hooks/useFeatureStatuses', () => ({ useFeatureStatuses: () => loading }));

import { FeatureConstellation } from '@/components/modules/evaluator/FeatureConstellation';
import { CrossModuleOverlapPanel } from '@/components/modules/evaluator/CrossModuleOverlapPanel';

afterEach(cleanup);

describe('topology views announce their first load', () => {
  it('FeatureConstellation exposes a labelled polite status while loading', () => {
    render(<FeatureConstellation />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect((status.textContent ?? '').trim().length).toBeGreaterThan(0);
  });

  it('CrossModuleOverlapPanel exposes a labelled polite status while loading', () => {
    render(<CrossModuleOverlapPanel />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect((status.textContent ?? '').trim().length).toBeGreaterThan(0);
  });
});
