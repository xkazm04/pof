import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';

describe('oneShotJobStore', () => {
  beforeEach(() => {
    useOneShotJobStore.getState().reset();
  });

  afterEach(() => {
    localStorage.removeItem('pof-one-shot-job');
  });

  it('starts idle', () => {
    expect(useOneShotJobStore.getState().phase).toBe('idle');
    expect(useOneShotJobStore.getState().refinementTurns).toBe(0);
  });

  it('transitions on setPhase + records the catalogId', () => {
    useOneShotJobStore.getState().setPhase('analyzing', { catalogId: 'items' });
    expect(useOneShotJobStore.getState().phase).toBe('analyzing');
    expect(useOneShotJobStore.getState().catalogId).toBe('items');
  });

  it('canStart is true only in {idle, completed, failed}', () => {
    const s = useOneShotJobStore;
    s.getState().setPhase('idle');         expect(s.getState().canStart()).toBe(true);
    s.getState().setPhase('analyzing');    expect(s.getState().canStart()).toBe(false);
    s.getState().setPhase('proposing');    expect(s.getState().canStart()).toBe(false);
    s.getState().setPhase('running');      expect(s.getState().canStart()).toBe(false);
    s.getState().setPhase('completed');    expect(s.getState().canStart()).toBe(true);
    s.getState().setPhase('failed');       expect(s.getState().canStart()).toBe(true);
  });

  it('incRefinementTurn caps at 3 unless forceMore', () => {
    useOneShotJobStore.getState().setPhase('proposing');
    expect(useOneShotJobStore.getState().incRefinementTurn(false)).toBe(true);   // 1
    expect(useOneShotJobStore.getState().incRefinementTurn(false)).toBe(true);   // 2
    expect(useOneShotJobStore.getState().incRefinementTurn(false)).toBe(true);   // 3
    expect(useOneShotJobStore.getState().incRefinementTurn(false)).toBe(false);  // blocked
    expect(useOneShotJobStore.getState().incRefinementTurn(true)).toBe(true);    // overridden
    expect(useOneShotJobStore.getState().refinementTurns).toBe(4);
  });

  it('recordStep appends to stepResults and updates currentStepIndex', () => {
    useOneShotJobStore.getState().setPhase('running');
    useOneShotJobStore.getState().recordStep({ step: 'Brief', outcome: 'pass' });
    useOneShotJobStore.getState().recordStep({ step: 'Attributes', outcome: 'fail', reason: 'err' });
    const st = useOneShotJobStore.getState();
    expect(st.stepResults.length).toBe(2);
    expect(st.currentStepIndex).toBe(2);
  });

  it('summarize counts outcomes', () => {
    useOneShotJobStore.getState().recordStep({ step: 'a', outcome: 'pass' });
    useOneShotJobStore.getState().recordStep({ step: 'b', outcome: 'pass' });
    useOneShotJobStore.getState().recordStep({ step: 'c', outcome: 'fail' });
    useOneShotJobStore.getState().recordStep({ step: 'd', outcome: 'skipped' });
    useOneShotJobStore.getState().recordStep({ step: 'e', outcome: 'deferred' });
    const sum = useOneShotJobStore.getState().summarize();
    expect(sum).toEqual({ ran: 3, passed: 2, failed: 1, skipped: 1, deferred: 1 });
  });

  it('setDistribution stores distribution and reset clears it', () => {
    const fixture = {
      catalogId: 'items',
      total: 5,
      byAttribute: { tier: { uncommon: 3, rare: 2 } },
      underrepresented: [],
      sample: [],
    };
    useOneShotJobStore.getState().setDistribution(fixture);
    expect(useOneShotJobStore.getState().distribution).toEqual(fixture);
    useOneShotJobStore.getState().reset();
    expect(useOneShotJobStore.getState().distribution).toBeNull();
  });

  it('setTotalSteps stores count and reset clears it', () => {
    useOneShotJobStore.getState().setTotalSteps(13);
    expect(useOneShotJobStore.getState().totalSteps).toBe(13);
    useOneShotJobStore.getState().reset();
    expect(useOneShotJobStore.getState().totalSteps).toBe(0);
  });

  it('rehydrate of phase=running transitions to failed/reload-interrupted', () => {
    const persisted = { state: { phase: 'running', catalogId: 'items', stepResults: [] }, version: 0 };
    localStorage.setItem('pof-one-shot-job', JSON.stringify(persisted));
    useOneShotJobStore.persist.rehydrate();
    expect(useOneShotJobStore.getState().phase).toBe('failed');
    expect(useOneShotJobStore.getState().failureReason).toBe('reload-interrupted');
  });

  // -- image-generation/B: no in-flight phase survives a reload; steps can be replaced in place --
  const rehydrate = (state: Record<string, unknown>) => {
    localStorage.setItem('pof-one-shot-job', JSON.stringify({ state, version: 0 }));
    useOneShotJobStore.persist.rehydrate();
    return useOneShotJobStore.getState();
  };
  const DIST = { catalogId: 'items', total: 1, byAttribute: {}, underrepresented: [], sample: [] };

  it('rehydrate of phase=analyzing -> failed/reload-interrupted (never a permanent "Scanning")', () => {
    const st = rehydrate({ phase: 'analyzing', catalogId: 'items' });
    expect(st.phase).toBe('failed');
    expect(st.failureReason).toBe('reload-interrupted');
    expect(st.canStart()).toBe(true);
  });

  it('rehydrate of an in-flight refine keeps the proposal it was refining (rests at proposing)', () => {
    const proposal = { name: 'X', data: {}, rationale: 'r' };
    const st = rehydrate({ phase: 'refining', catalogId: 'items', proposal, distribution: DIST });
    expect(st.phase).toBe('proposing');
    expect(st.proposal).toEqual(proposal);
  });

  it('rehydrate of proposing without a proposal rests at analyzed with the distribution', () => {
    const st = rehydrate({ phase: 'proposing', catalogId: 'items', proposal: null, distribution: DIST });
    expect(st.phase).toBe('analyzed');
    expect(st.failureReason).toBe('reload-interrupted');
  });

  it('upsertStep replaces a recorded step in place and appends an unseen one', () => {
    const s = useOneShotJobStore.getState();
    s.recordStep({ step: 'A', outcome: 'pass' });
    s.recordStep({ step: 'B', outcome: 'fail', reason: 'x' });
    s.recordStep({ step: 'C', outcome: 'pass' });
    useOneShotJobStore.getState().upsertStep({ step: 'B', outcome: 'pass' });
    useOneShotJobStore.getState().upsertStep({ step: 'D', outcome: 'deferred' });
    expect(useOneShotJobStore.getState().stepResults).toEqual([
      { step: 'A', outcome: 'pass' }, { step: 'B', outcome: 'pass' },
      { step: 'C', outcome: 'pass' }, { step: 'D', outcome: 'deferred' },
    ]);
  });
});
