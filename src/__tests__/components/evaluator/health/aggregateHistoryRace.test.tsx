/** Two overlapping history loads: the newest request's answer stays on screen. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react';
import type { ModuleAggregate } from '@/lib/feature-matrix-db';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';

afterEach(cleanup);

const moduleId = Object.keys(MODULE_FEATURE_DEFINITIONS)[0];
const h = vi.hoisted(() => ({ tryApiFetch: vi.fn() }));
vi.mock('@/lib/api-utils', () => ({ apiFetch: vi.fn(async () => ({ batch: null })), tryApiFetch: h.tryApiFetch }));
vi.mock('@/hooks/useModuleAggregates', () => {
  const aggregates = [{ moduleId: 'x', total: 1, implemented: 1, improved: 0, partial: 0, missing: 0, unknown: 0, avgQuality: 4, lastReviewedAt: null } as unknown as ModuleAggregate];
  return { useModuleAggregates: () => ({ aggregates, byModule: new Map(), isLoading: false, error: null, scope: null, refresh: vi.fn() }) };
});
vi.mock('@/stores/projectStore', () => ({
  useProjectStore: (sel: (s: unknown) => unknown) => sel({ projectPath: '/p' }),
}));

import { AggregateQualityDashboard } from '@/components/modules/evaluator/AggregateQualityDashboard';

type Res = { ok: true; data: { history: Record<string, unknown[]> } };
const answer = (n: number): Res => ({ ok: true, data: { history: { [moduleId]: Array.from({ length: n }, () => ({})) } } });

describe('AggregateQualityDashboard history', () => {
  it('ignores an older load that settles after the newer one', async () => {
    const resolvers: ((r: Res) => void)[] = [];
    h.tryApiFetch.mockImplementation((url: string) =>
      url.startsWith('/api/feature-matrix/history')
        ? new Promise<Res>((resolve) => resolvers.push(resolve))
        : Promise.resolve({ ok: true, data: [] }));
    render(<AggregateQualityDashboard />);
    fireEvent.click(screen.getByTestId(`heatmap-cell-${moduleId}`));
    fireEvent.click(screen.getByTitle('Refresh data'));
    expect(resolvers).toHaveLength(2);
    await act(async () => { resolvers[1](answer(1)); });
    await act(async () => { resolvers[0](answer(9)); });
    expect(document.body.textContent).toContain('1 snapshots');
    expect(document.body.textContent).not.toContain('9 snapshots');
  });
});
