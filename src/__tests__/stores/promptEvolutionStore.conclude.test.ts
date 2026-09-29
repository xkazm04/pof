import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePromptEvolutionStore } from '@/stores/promptEvolutionStore';

/**
 * A refused decide-now is an answer, not a failure of the view: `index.tsx` hides
 * every panel behind `store.error`, so a 409 "not enough trials" must come back to
 * the caller as a reason and leave the global error alone.
 */

const REASON = 'Not enough trials to pick a winner — each variant needs 3 (A has 2). Dispatch this checklist item a few more times.';

describe('promptEvolutionStore.concludeTest', () => {
  beforeEach(() => usePromptEvolutionStore.setState({ error: null, abTests: [] }));
  afterEach(() => vi.unstubAllGlobals());

  it('returns the refusal reason and keeps store.error null on a 409', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 409,
      json: async () => ({ success: false, error: REASON }),
    }));

    const outcome = await usePromptEvolutionStore.getState().concludeTest('ab-1');
    expect(outcome).toEqual({ ok: false, reason: REASON });
    expect(usePromptEvolutionStore.getState().error).toBeNull();
  });
});
