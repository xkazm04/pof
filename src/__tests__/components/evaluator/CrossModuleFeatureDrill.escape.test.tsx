/**
 * scan-sweep (cross-module-features/B): the drill Escape listener yields to a consumed Escape. A Features heatmap status cell
 * opens the features behind its count in place — ready vs blocked — and a ready
 * one builds through the ONE gated plan door (usePlanDispatch, mocked here). The
 * module name keeps navigating; the grid declares one track per status key.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { ProjectScopeReport, ModuleAggregate } from '@/lib/feature-matrix-db';
import type { SubModuleId } from '@/types/modules';
import { MODULE_LABELS } from '@/lib/module-registry';
import { useNavigationStore } from '@/stores/navigationStore';

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

describe('Cell drill Escape handling', () => {
  it('stays open when another surface consumed the Escape (defaultPrevented); closes on a bare Escape', () => {
    render(<CrossModuleFeatureDashboard />);
    fireEvent.click(missingCell());
    const input = document.createElement('input');
    document.body.appendChild(input);
    const consume = (e: KeyboardEvent) => { if (e.key === 'Escape') e.preventDefault(); };
    input.addEventListener('keydown', consume);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('pof-cell-drill')).not.toBeNull();
    input.removeEventListener('keydown', consume);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('pof-cell-drill')).toBeNull();
    input.remove();
  });
});
