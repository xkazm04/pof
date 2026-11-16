/**
 * The lifecycle vocabulary is declared ONCE.
 *
 * It used to be hand-written four times: the `LifecycleState` union (types.ts), the zod enum the
 * catalog route validates `nextLifecycle` with (validation.ts), and the forward ladder twice —
 * `lifecycle.ts` (the derivation gate) and `generationPlan.ts` (the next-recipe-step rule). A
 * state added to one and not the others is either refused by the route or ranked -1 by a ladder.
 */
import { describe, it, expect } from 'vitest';
import { LIFECYCLE_STATES } from '@/lib/catalog/types';
import { LIFECYCLE_LADDER, canTransition } from '@/lib/catalog/lifecycle';
import { lifecycleStateSchema } from '@/lib/catalog/validation';
import { nextGenerationStep } from '@/lib/catalog/generationPlan';

describe('lifecycle vocabulary — one declaration', () => {
  it('the route schema accepts exactly the declared states', () => {
    expect(lifecycleStateSchema.options).toEqual([...LIFECYCLE_STATES]);
  });

  it('the forward ladder is the declared states minus the failed sink, in order', () => {
    expect([...LIFECYCLE_LADDER]).toEqual(LIFECYCLE_STATES.filter((s) => s !== 'failed'));
    for (let i = 0; i + 1 < LIFECYCLE_LADDER.length; i++) {
      expect(canTransition(LIFECYCLE_LADDER[i], LIFECYCLE_LADDER[i + 1])).toBe(true);
    }
  });

  it('the recipe next-step rule ranks on the same ladder', () => {
    expect(nextGenerationStep(['scaffold-cpp', 'author-python', 'wire', 'verify'], 'planned')).toBe('scaffold-cpp');
    expect(nextGenerationStep(['scaffold-cpp', 'author-python', 'wire', 'verify'], 'wired')).toBe('verify');
  });
});
