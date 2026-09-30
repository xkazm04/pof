import { describe, it, expect } from 'vitest';
import {
  getRecipe, COMBAT_MAP_RECIPE, STATE_GRAPH_RECIPE, SPELLBOOK_RECIPE, type GenerationStep,
} from '@/lib/catalog/recipe';
import type { LifecycleState } from '@/lib/catalog/types';
import { nextGenerationStep, transitionOutcome } from '@/lib/catalog/generationPlan';
import { nextRecipeStep } from '@/components/modules/core-engine/sub_ui/flow/screenWorklist';

/**
 * Acceptance for scan-sweep --challenge card catalog-core-infrastructure/A
 * (run challenge-2026-09-29d): the step a cell offers is DERIVED from the
 * catalog's own recipe, never a hand-copied lifecycle ternary. ONE next-step
 * rule — the Screen Flow tab's nextRecipeStep is the same function.
 */

const RECIPE_CATALOGS = [
  'spellbook', 'items', 'loot-tables', 'bestiary', 'combat-map', 'screen-flow',
  'zone-map', 'state-graph', 'materials', 'characters', 'currencies',
] as const;
const START: LifecycleState[] = ['planned', 'scaffolded', 'generated', 'wired'];
const ALL: LifecycleState[] = [...START, 'verified', 'failed'];

describe('nextGenerationStep - the next step comes from the recipe', () => {
  it('case 1: combat-map (steps wire, verify) at scaffolded offers wire, not author-python', () => {
    expect(COMBAT_MAP_RECIPE.steps).toEqual(['wire', 'verify']);
    expect(nextGenerationStep(COMBAT_MAP_RECIPE.steps, 'scaffolded')).toBe('wire');
  });

  it('case 2: state-graph generated -> verify; spellbook scaffolded -> author-python; verified and failed -> null', () => {
    expect(nextGenerationStep(STATE_GRAPH_RECIPE.steps, 'generated')).toBe('verify');
    expect(nextGenerationStep(SPELLBOOK_RECIPE.steps, 'scaffolded')).toBe('author-python');
    // coordinator revision: adopt the landed nextRecipeStep contract (game-ui-hud/B)
    expect(nextGenerationStep(SPELLBOOK_RECIPE.steps, 'verified')).toBeNull();
    for (const id of RECIPE_CATALOGS) {
      expect(nextGenerationStep(getRecipe(id)!.steps, 'failed')).toBeNull();
    }
  });

  it('case 3: 11 recipes x 4 start states -> always a member of the recipe own steps (44 pairs)', () => {
    let pairs = 0;
    for (const id of RECIPE_CATALOGS) {
      const recipe = getRecipe(id);
      expect(recipe, id).toBeDefined();
      for (const state of START) {
        const step = nextGenerationStep(recipe!.steps, state);
        expect(step, `${id}@${state}`).not.toBeNull();
        expect(recipe!.steps, `${id}@${state}`).toContain(step as GenerationStep);
        pairs++;
      }
    }
    expect(pairs).toBe(44);
  });

  it('one rule: the Screen Flow nextRecipeStep agrees with nextGenerationStep on every recipe x state', () => {
    for (const id of RECIPE_CATALOGS) {
      const steps = getRecipe(id)!.steps;
      for (const state of ALL) expect(nextRecipeStep(steps, state), `${id}@${state}`).toBe(nextGenerationStep(steps, state));
    }
  });
});

describe('transitionOutcome - why a requested lifecycle was held', () => {
  const ev = (summary: string) => ({ summary });

  it('names the drained L3/L4 gate when verified was requested and the derivation is below it', () => {
    const held = transitionOutcome('verified', { lifecycle: 'wired', evidence: ev('config-complete') });
    expect(held).toMatch(/drained L3\/L4 gate/);
  });

  it('says nothing when the derivation reached (or passed) what the step asked for', () => {
    expect(transitionOutcome('generated', { lifecycle: 'generated', evidence: ev('x') })).toBeUndefined();
    expect(transitionOutcome('generated', { lifecycle: 'wired', evidence: ev('x') })).toBeUndefined();
  });

  it('holds with the evidence sentence when the derivation is below the request, and on no derivation at all', () => {
    expect(transitionOutcome('generated', { lifecycle: 'planned', evidence: ev('no step has produced') }))
      .toMatch(/planned.*no step has produced/);
    expect(transitionOutcome('wired', null)).toMatch(/no pipeline/i);
  });
});
