/**
 * scan-sweep night 2026-11-08 (module-topology-graph): Nexus's three zoom buttons were
 * icon-only with no accessible name, and never disabled at the clamp (50% / 150%), so
 * a click there did nothing silently. The DependencyGraph twin (GraphControls) names
 * them, disables them at the bounds and announces the level — Nexus must match.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { mockFetchRoutes } from '@/__tests__/setup';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: null, isConnected: false, isLoading: false, error: null, refresh: async () => {} }),
}));

import { NexusView } from '@/components/modules/evaluator/NexusView';
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

describe('NexusView zoom controls', () => {
  it('are named, announce the level, and disable at the clamp bounds', async () => {
    render(<NexusView />);
    const zoomIn = (await screen.findByRole('button', { name: 'Zoom in' })) as HTMLButtonElement;
    const zoomOut = screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement;
    expect(screen.getByRole('button', { name: 'Reset zoom to 100%' })).toBeTruthy();

    for (let i = 0; i < 10; i++) fireEvent.click(zoomOut);
    expect(zoomOut.disabled).toBe(true);
    expect(screen.getByText('50%').getAttribute('aria-live')).toBe('polite');

    for (let i = 0; i < 20; i++) fireEvent.click(zoomIn);
    expect(zoomIn.disabled).toBe(true);
    expect(screen.getByText('150%')).toBeTruthy();
  });
});
