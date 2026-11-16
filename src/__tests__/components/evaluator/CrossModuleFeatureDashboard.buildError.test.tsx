/**
 * scan-sweep (cross-module-features): 'Buildable now' and the cell drill share one
 * plan-dispatch door, but its refusal (`lastError`) was rendered only inside the
 * drill. A Build clicked in 'Buildable now' with no drill open failed silently.
 * The reason must reach the surface the click came from — exactly once.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import type { ProjectScopeReport, ModuleAggregate } from '@/lib/feature-matrix-db';
import type { SubModuleId } from '@/types/modules';
import { MODULE_LABELS } from '@/lib/module-registry';

afterEach(cleanup);

const REFUSAL = 'Refused: another Features build is still running';

const h = vi.hoisted(() => ({ statuses: vi.fn(), aggregates: vi.fn() }));

vi.mock('@/hooks/useFeatureStatuses', () => ({
  useFeatureStatuses: h.statuses,
  invalidateFeatureStatuses: vi.fn(),
}));
vi.mock('@/hooks/useModuleAggregates', () => ({
  useModuleAggregates: h.aggregates,
  invalidateModuleAggregates: vi.fn(),
  invalidateFeatureData: vi.fn(),
}));
vi.mock('@/hooks/usePlanDispatch', () => ({
  usePlanDispatch: () => ({ dispatch: vi.fn(), isRunning: false, lastError: REFUSAL }),
}));

import { CrossModuleFeatureDashboard } from '@/components/modules/evaluator/CrossModuleFeatureDashboard';

const ROWS: [string, string][] = [
  ['arpg-combat::Melee attack ability', 'missing'],
  ['arpg-combat::Hit detection', 'missing'],
];
const OWN: ProjectScopeReport = {
  projectId: 'p', unscoped: false, moduleId: null, totalRows: 2, legacyRows: 0, ownedRows: 2,
  foreignRows: 0, projects: [], distinctProjects: 1,
  snapshots: { totalRows: 0, legacyRows: 0, ownedRows: 0, foreignRows: 0 }, note: '',
};
const AGGS = [{
  moduleId: 'arpg-combat' as SubModuleId, total: 2, implemented: 0, improved: 0, partial: 0,
  missing: 2, unknown: 0, avgQuality: null, lastReviewedAt: null,
}] as unknown as ModuleAggregate[];

beforeEach(() => {
  h.statuses.mockReturnValue({
    statusMap: new Map(ROWS),
    statuses: [], isLoading: false, loaded: true, failed: false, error: null, scope: OWN, refresh: vi.fn(),
  });
  h.aggregates.mockReturnValue({
    aggregates: AGGS, byModule: new Map(AGGS.map((r) => [r.moduleId as string, r])),
    isLoading: false, loaded: true, failed: false, error: null, scope: OWN, refresh: vi.fn(),
  });
});

const alertsWith = (text: string) => screen.queryAllByRole('alert').filter((a) => a.textContent?.includes(text));

describe('Features tab — a refused Build says why', () => {
  it("shows the refusal under 'Buildable now' when no drill is open", () => {
    render(<CrossModuleFeatureDashboard />);
    const card = screen.getByTestId('pof-buildable-now');
    expect(within(card).getByRole('alert').textContent).toContain(REFUSAL);
    expect(alertsWith(REFUSAL)).toHaveLength(1);
  });

  it('shows it once, in the drill, while a drill is open', () => {
    render(<CrossModuleFeatureDashboard />);
    const combat = MODULE_LABELS['arpg-combat'];
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${combat}: 2/2 missing`) }));
    expect(within(screen.getByTestId('pof-cell-drill')).getByRole('alert').textContent).toContain(REFUSAL);
    expect(alertsWith(REFUSAL)).toHaveLength(1);
  });
});
