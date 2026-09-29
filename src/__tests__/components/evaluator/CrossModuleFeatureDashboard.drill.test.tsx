/**
 * scan-sweep --challenge (cross-module-features/B): a Features heatmap status cell
 * opens the features behind its count in place — ready vs blocked — and a ready
 * one builds through the ONE gated plan door (usePlanDispatch, mocked here). The
 * module name keeps navigating; the grid declares one track per status key.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import type { ProjectScopeReport, ModuleAggregate } from '@/lib/feature-matrix-db';
import type { SubModuleId } from '@/types/modules';
import { MODULE_LABELS } from '@/lib/module-registry';
import { useNavigationStore } from '@/stores/navigationStore';
import { generatePlan } from '@/lib/implementation-planner/plan-generator';
import { buildableNow } from '@/lib/evaluator/feature-cell-drill';
import { STATUS_KEYS } from '@/components/modules/evaluator/CrossModuleFeatureDashboard/constants';

afterEach(cleanup);

const h = vi.hoisted(() => ({
  statuses: vi.fn(),
  aggregates: vi.fn(),
  dispatch: vi.fn(),
}));

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
  usePlanDispatch: () => ({ dispatch: h.dispatch, isRunning: false, lastError: null }),
}));

import { CrossModuleFeatureDashboard } from '@/components/modules/evaluator/CrossModuleFeatureDashboard';

const C = (name: string) => `arpg-combat::${name}`;
const COMBAT = MODULE_LABELS['arpg-combat'];

const ROWS: [string, string][] = [
  ['arpg-gas::Base GameplayAbility', 'improved'],
  ['arpg-animation::Attack montages', 'implemented'],
  ['arpg-animation::Anim Notify classes', 'implemented'],
  [C('Melee attack ability'), 'missing'],
  [C('Hit detection'), 'missing'],
  [C('Combo system'), 'missing'],
  [C('GAS damage application'), 'missing'],
  [C('Death flow'), 'partial'],
  [C('Combat feedback'), 'unknown'],
];
const STATUS_MAP = new Map(ROWS);

const OWN: ProjectScopeReport = {
  projectId: 'p', unscoped: false, moduleId: null, totalRows: 9, legacyRows: 0, ownedRows: 9,
  foreignRows: 0, projects: [], distinctProjects: 1,
  snapshots: { totalRows: 0, legacyRows: 0, ownedRows: 0, foreignRows: 0 }, note: '',
};

function agg(moduleId: string, c: Partial<ModuleAggregate>): ModuleAggregate {
  const base = { implemented: 0, improved: 0, partial: 0, missing: 0, unknown: 0, ...c };
  return {
    moduleId: moduleId as SubModuleId,
    total: base.implemented + base.improved + base.partial + base.missing + base.unknown,
    avgQuality: null, lastReviewedAt: null, ...base,
  } as ModuleAggregate;
}

const AGGS = [
  agg('arpg-combat', { missing: 4, partial: 1, unknown: 1 }),
  agg('arpg-gas', { improved: 1 }),
  agg('arpg-animation', { implemented: 2 }),
];

const navigateToModule = vi.fn();

beforeEach(() => {
  h.dispatch.mockReset();
  navigateToModule.mockReset();
  useNavigationStore.setState({ navigateToModule });
  h.statuses.mockReturnValue({
    statusMap: STATUS_MAP,
    statuses: ROWS.map(([k, status]) => ({ moduleId: k.split('::')[0], featureName: k.split('::')[1], status })),
    isLoading: false, loaded: true, failed: false, error: null, scope: OWN, refresh: vi.fn(),
  });
  h.aggregates.mockReturnValue({
    aggregates: AGGS,
    byModule: new Map(AGGS.map((r) => [r.moduleId as string, r])),
    isLoading: false, loaded: true, failed: false, error: null, scope: OWN, refresh: vi.fn(),
  });
});

const missingCell = () => screen.getByRole('button', { name: new RegExp(`^${COMBAT}: 4/6 missing`) });

describe('Features heatmap — a status cell opens its features in place', () => {
  it("clicking Combat's 'missing' cell opens the drill with its 4 features and does NOT navigate", () => {
    render(<CrossModuleFeatureDashboard />);
    fireEvent.click(missingCell());
    const panel = screen.getByTestId('pof-cell-drill');
    expect(within(panel).getAllByRole('group')).toHaveLength(4);
    expect(navigateToModule).not.toHaveBeenCalled();
    // a second click on the same cell closes it; Esc closes it too
    fireEvent.click(missingCell());
    expect(screen.queryByTestId('pof-cell-drill')).toBeNull();
    fireEvent.click(missingCell());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('pof-cell-drill')).toBeNull();
  });

  it('[guard] clicking the module name still navigates to the module', () => {
    render(<CrossModuleFeatureDashboard />);
    fireEvent.click(screen.getAllByText(COMBAT)[0]);
    expect(navigateToModule).toHaveBeenCalledWith('arpg-combat');
  });

  it("Build on a ready row dispatches its PlanItem; a blocked row has no Build and lists 'build first'", () => {
    render(<CrossModuleFeatureDashboard />);
    fireEvent.click(missingCell());
    const panel = screen.getByTestId('pof-cell-drill');

    const hit = within(panel).getByRole('group', { name: 'Hit detection' });
    fireEvent.click(within(hit).getByRole('button', { name: 'Build Hit detection' }));
    expect(h.dispatch).toHaveBeenCalledTimes(1);
    expect(h.dispatch.mock.calls[0][0].key).toBe(C('Hit detection'));
    expect(h.dispatch.mock.calls[0][0].isReady).toBe(true);

    const combo = within(panel).getByRole('group', { name: 'Combo system' });
    expect(within(combo).queryByRole('button', { name: 'Build Combo system' })).toBeNull();
    expect(combo.textContent).toMatch(/build first/i);
    fireEvent.click(within(combo).getByRole('button', { name: 'Build Melee attack ability' }));
    expect(h.dispatch).toHaveBeenCalledTimes(2);
    expect(h.dispatch.mock.calls[1][0].key).toBe(C('Melee attack ability'));
  });

  it("'Buildable now' replaces 'Most Missing Features' and builds the top ready feature", () => {
    render(<CrossModuleFeatureDashboard />);
    expect(screen.queryByText(/Most Missing Features/i)).toBeNull();
    const card = screen.getByTestId('pof-buildable-now');
    const expected = buildableNow(generatePlan(STATUS_MAP), 8);
    const groups = within(card).getAllByRole('group');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(expected.map((i) => i.featureName));
    fireEvent.click(within(groups[0]).getByRole('button', { name: `Build ${expected[0].featureName}` }));
    expect(h.dispatch.mock.calls[0][0].key).toBe(expected[0].key);
  });

  it('[guard] header, module rows and footer share one grid template with one track per status key', () => {
    const { container } = render(<CrossModuleFeatureDashboard />);
    const templates = [...container.querySelectorAll<HTMLElement>('div')]
      .map((el) => el.style.gridTemplateColumns)
      .filter(Boolean);
    expect(templates.length).toBeGreaterThanOrEqual(3);
    expect(new Set(templates)).toEqual(new Set([`180px repeat(${STATUS_KEYS.length}, 1fr) 80px`]));
  });
});
