/**
 * scan-sweep night 2026-11-08 (module-topology-graph): the Nexus legend showed ONE
 * green swatch for Pattern success while the node heat bar draws green / amber / red by
 * threshold. The legend now reads the same bands the bar does.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { mockFetchRoutes } from '@/__tests__/setup';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: null, isConnected: false, isLoading: false, error: null, refresh: async () => {} }),
}));

import { NexusView } from '@/components/modules/evaluator/NexusView';
import { patternHeatColor } from '@/components/modules/evaluator/NexusView/NexusGraph';
import { invalidateFeatureStatuses } from '@/hooks/useFeatureStatuses';

const ok = (data: unknown) => ({ body: { success: true, data } });

beforeEach(() => {
  invalidateFeatureStatuses();
  mockFetchRoutes([
    { match: '/api/feature-matrix/all-statuses', response: ok({ statuses: [{ moduleId: 'arpg-combat', featureName: 'core', status: 'implemented' }] }) },
    { match: '/api/pattern-library', response: ok({ patterns: [] }) },
    { match: '/api/evaluator/results', response: ok({ scans: [] }) },
    { match: '/api/session-analytics', response: ok({ totalSessions: 0, moduleStats: [] }) },
  ]);
});
afterEach(cleanup);

describe('NexusView — pattern-success legend', () => {
  it('has one swatch per distinct heat colour the bar can draw', async () => {
    const { container } = render(<NexusView />);
    await screen.findByRole('button', { name: 'Zoom in' });
    const drawn = new Set([0.95, 0.7, 0.55, 0.4, 0.1, 0].map(patternHeatColor));
    expect(drawn.size).toBe(3);
    expect(container.querySelectorAll('[data-pattern-legend-swatch]').length).toBe(drawn.size);
    expect(screen.getByText(/Pattern success 40-69%/)).toBeTruthy();
  });
});
