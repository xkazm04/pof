import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { GenerationStep } from '@/lib/catalog/recipe';

/**
 * Acceptance (component half) for scan-sweep --challenge card game-ui-hud/B:
 * the Screen Flow tab's rows each drive their OWN catalog screen at the recipe's
 * next step, and the flow graph and the rows share one selection.
 */

const { calls } = vi.hoisted(() => ({
  calls: [] as { entityId: string; step: GenerationStep }[],
}));

vi.mock('@/hooks/useGeneration', () => ({
  useGeneration: (entity: StoredCatalogEntity) => ({
    generate: (step: GenerationStep) => { calls.push({ entityId: entity.id, step }); },
    isRunning: false,
  }),
}));

vi.mock('@/hooks/useTabFeatures', () => ({
  useTabFeatures: () => ({
    featureMap: new Map(),
    stats: { total: 0, implemented: 0, partial: 0, missing: 0 },
    defs: [],
    isLoading: false,
  }),
}));

import { ScreenFlowMap } from '@/components/modules/core-engine/sub_ui';
import { useCatalogStore } from '@/stores/catalogStore';
import { seedScreenEntries } from '@/lib/catalog/seed-screen-flow';
import { nextRecipeStep } from '@/components/modules/core-engine/sub_ui/flow/screenWorklist';
import type { SubModuleId } from '@/types/modules';

const STEPS: GenerationStep[] = ['scaffold-cpp', 'author-python', 'wire', 'verify'];
const MODULE = 'arpg-ui' as SubModuleId;

beforeEach(() => {
  calls.length = 0;
  useCatalogStore.getState().setEntities('screen-flow', seedScreenEntries());
});
afterEach(cleanup);

describe('Screen Flow tab - per-row catalog lifecycle', () => {
  it('case 5: a verified screen shows its badge and no run button', () => {
    expect(nextRecipeStep(STEPS, 'verified')).toBeNull();
    useCatalogStore.getState().setEntities(
      'screen-flow',
      seedScreenEntries().map((e) => (e.id === 'screen-Inventory' ? { ...e, lifecycle: 'verified' as const } : e)),
    );
    render(<ScreenFlowMap moduleId={MODULE} />);
    fireEvent.click(screen.getByRole('button', { name: /Inventory screen/ }));
    const cell = screen.getByTestId('screen-lifecycle-screen-Inventory');
    expect(within(cell).getByRole('img', { name: /Lifecycle: verified/ })).toBeTruthy();
    expect(within(cell).queryByRole('button')).toBeNull();
  });

  it('case 8: the Inventory row runs screen-Inventory at scaffold-cpp; the graph selects the same row', () => {
    render(<ScreenFlowMap moduleId={MODULE} />);
    expect(screen.getByTestId('screen-worklist').textContent).toContain('0/6');

    // Row expand -> its own entity, the recipe's first step.
    fireEvent.click(screen.getByRole('button', { name: /Inventory screen/ }));
    const cell = screen.getByTestId('screen-lifecycle-screen-Inventory');
    fireEvent.click(within(cell).getByRole('button'));
    expect(calls).toEqual([{ entityId: 'screen-Inventory', step: 'scaffold-cpp' }]);
    // ...and the expanded row highlights its flow-graph node.
    expect(screen.getByRole('button', { name: /Select Inventory node/ }).getAttribute('aria-pressed')).toBe('true');

    // Graph click -> the matching row expands (one selection).
    fireEvent.click(screen.getByRole('button', { name: /Select CharStats node/ }));
    expect(screen.getByTestId('screen-lifecycle-screen-CharStats')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Select CharStats node/ }).getAttribute('aria-pressed')).toBe('true');
  });
});
