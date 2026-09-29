import { describe, it, expect } from 'vitest';
import { seedScreenEntries } from '@/lib/catalog/seed-screen-flow';
import { getRecipe, type GenerationStep } from '@/lib/catalog/recipe';
import type { LifecycleState, ScreenEntry } from '@/lib/catalog/types';
import {
  screenEntityFor, nextRecipeStep, screenWorklist,
} from '@/components/modules/core-engine/sub_ui/flow/screenWorklist';

/**
 * Acceptance (pure half) for scan-sweep --challenge card game-ui-hud/B:
 * every Screen Flow row resolves to its OWN screen-flow catalog entity, and the
 * step it dispatches is the recipe's real next step (never one the recipe lacks,
 * never one the /api/catalog transition gate would refuse).
 */

const STEPS: GenerationStep[] = ['scaffold-cpp', 'author-python', 'wire', 'verify'];

const withLifecycle = (
  entries: ScreenEntry[], id: string, lifecycle: LifecycleState,
): ScreenEntry[] => entries.map((e) => (e.id === id ? { ...e, lifecycle } : e));

describe('screenWorklist - screen rows bind to their own entity at the recipe step', () => {
  it('case 1: an expandable screen-node id resolves to its own entity (no screen-HUD fallback)', () => {
    const entries = seedScreenEntries();
    expect(screenEntityFor('inventory', entries)?.id).toBe('screen-Inventory');
    expect(screenEntityFor('char-stats', entries)?.id).toBe('screen-CharStats');
    expect(screenEntityFor('damage-numbers', entries)?.id).toBe('screen-DamageNumbers');
  });

  it('case 2: HUD rows resolve to screen-HUD, and an unknown id resolves to nothing', () => {
    const entries = seedScreenEntries();
    expect(screenEntityFor('hud-root', entries)?.id).toBe('screen-HUD');
    expect(screenEntityFor('hud-abilities', entries)?.id).toBe('screen-HUD');
    expect(screenEntityFor('nope', entries)).toBeUndefined();
  });

  it('case 3: a planned screen starts at the recipe first step, scaffold-cpp', () => {
    expect(getRecipe('screen-flow')?.steps).toEqual(STEPS);
    expect(nextRecipeStep(STEPS, 'planned')).toBe('scaffold-cpp');
  });

  it('case 4: each mid-pipeline state advances one step; failed has no legal step and is skipped', () => {
    expect(nextRecipeStep(STEPS, 'scaffolded')).toBe('author-python');
    expect(nextRecipeStep(STEPS, 'generated')).toBe('wire');
    expect(nextRecipeStep(STEPS, 'wired')).toBe('verify');
    // failed -> planned is the only legal retry transition (lifecycle.ts), so no
    // recipe step may be dispatched from failed: scaffold-cpp would post
    // 'scaffolded' and /api/catalog 409s it.
    expect(nextRecipeStep(STEPS, 'failed')).toBeNull();
    const entries = withLifecycle(seedScreenEntries(), 'screen-HUD', 'failed');
    expect(screenWorklist(entries, STEPS).next).toEqual({ entityId: 'screen-Inventory', step: 'scaffold-cpp' });
  });

  it('case 6: the rule never returns a step that is not in the recipe', () => {
    expect(nextRecipeStep(['author-python', 'verify'], 'generated')).toBe('verify');
    expect(nextRecipeStep(['author-python', 'verify'], 'planned')).toBe('author-python');
  });

  it('case 7: the worklist counts verified screens and names the next action', () => {
    const entries = seedScreenEntries();
    expect(screenWorklist(entries, STEPS)).toMatchObject({
      total: 6, verified: 0, next: { entityId: 'screen-HUD', step: 'scaffold-cpp' },
    });
    const hudDone = withLifecycle(entries, 'screen-HUD', 'verified');
    expect(screenWorklist(hudDone, STEPS)).toMatchObject({
      total: 6, verified: 1, next: { entityId: 'screen-Inventory', step: 'scaffold-cpp' },
    });
  });
});
