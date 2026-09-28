/**
 * scan-sweep --challenge (holistic-quality-overview/B): a Module Health cell on the
 * Evaluator Summary tab opens a point-priced lift plan whose remedies are the doors
 * the app already has — a feature-review dispatched through useModuleCLI (on click
 * only, never on render), the Dependencies tab, or the module itself.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act, within } from '@testing-library/react';
import type { ModuleAggregate } from '@/lib/feature-matrix-db';
import type { SubModuleId } from '@/types/modules';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { MODULE_LABELS } from '@/lib/module-registry';
import { useNavigationStore } from '@/stores/navigationStore';

afterEach(cleanup);

const h = vi.hoisted(() => ({
  statuses: vi.fn(),
  aggregates: vi.fn(),
  execute: vi.fn(),
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
vi.mock('@/lib/api-utils', async (orig) => {
  const actual = await orig<typeof import('@/lib/api-utils')>();
  return {
    ...actual,
    tryApiFetch: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        totalSessions: 12,
        moduleStats: [{ moduleId: 'arpg-loot', totalSessions: 12, successRate: 1, avgDurationMs: 0 }],
      },
    }),
  };
});
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: h.execute, sendPrompt: vi.fn(), isRunning: false }),
}));

import { UnifiedSummaryView } from '@/components/modules/evaluator/UnifiedSummaryView';

const LOOT = 'arpg-loot' as SubModuleId;
const LOOT_LABEL = MODULE_LABELS[LOOT]!;

const lootAggregate: ModuleAggregate = {
  moduleId: LOOT,
  total: 8,
  implemented: 4,
  improved: 0,
  partial: 0,
  missing: 4,
  unknown: 0,
  avgQuality: null,
  lastReviewedAt: null,
} as unknown as ModuleAggregate;

async function settle() {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  h.execute.mockReset().mockResolvedValue(undefined);
  h.statuses.mockReturnValue({
    statusMap: new Map(), statuses: [], isLoading: false, loaded: true, failed: false,
    error: null, scope: null, refresh: vi.fn(),
  });
  h.aggregates.mockReturnValue({
    aggregates: [lootAggregate], isLoading: false, loaded: true, failed: false,
    error: null, scope: null, refresh: vi.fn(),
  });
});

async function openLootPlan(onNavigateTab = vi.fn()) {
  const utils = render(<UnifiedSummaryView onNavigateTab={onNavigateTab} />);
  await settle();
  expect(h.execute).not.toHaveBeenCalled();
  const cell = utils.getByRole('button', { name: new RegExp(`^${LOOT_LABEL} health`) });
  fireEvent.click(cell);
  const plan = utils.getByRole('region', { name: `${LOOT_LABEL} lift plan` });
  return { utils, plan, onNavigateTab };
}

describe('UnifiedSummaryView — module health cell becomes a lift plan', () => {
  it('dispatches nothing on render; Review dispatches one feature-review for the module', async () => {
    const { plan } = await openLootPlan();
    expect(h.execute).not.toHaveBeenCalled();
    fireEvent.click(within(plan).getByRole('button', { name: 'Review' }));
    expect(h.execute).toHaveBeenCalledTimes(1);
    expect(h.execute.mock.calls[0][0]).toMatchObject({
      type: 'feature-review',
      moduleId: LOOT,
      features: MODULE_FEATURE_DEFINITIONS[LOOT],
    });
  });

  it('the dependency lift opens the Dependencies tab; the coverage lift opens the module', async () => {
    const navigateToModule = vi.fn();
    const original = useNavigationStore.getState().navigateToModule;
    useNavigationStore.setState({ navigateToModule });
    try {
      const { plan, onNavigateTab } = await openLootPlan();
      fireEvent.click(within(plan).getByRole('button', { name: 'Dependencies tab' }));
      expect(onNavigateTab).toHaveBeenCalledWith('dependencies');
      fireEvent.click(within(plan).getByRole('button', { name: 'Open module' }));
      expect(navigateToModule).toHaveBeenCalledWith(LOOT);
      expect(h.execute).not.toHaveBeenCalled();
    } finally {
      useNavigationStore.setState({ navigateToModule: original });
    }
  });

  it('[guard] the composite sentence names the published weights', async () => {
    const utils = render(<UnifiedSummaryView onNavigateTab={vi.fn()} />);
    await settle();
    expect(utils.container.textContent).toContain(
      'quality (40%), dependencies (30%), coverage (20%), and activity (10%)',
    );
  });
});
