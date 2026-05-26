import { describe, it, expect, beforeEach } from 'vitest';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';

describe('oneShotJobStore', () => {
  beforeEach(() => {
    useOneShotJobStore.getState().reset();
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

  it('rehydrate of phase=running transitions to failed/reload-interrupted', () => {
    const persisted = { state: { phase: 'running', catalogId: 'items', stepResults: [] }, version: 0 };
    localStorage.setItem('pof-one-shot-job', JSON.stringify(persisted));
    useOneShotJobStore.persist.rehydrate();
    expect(useOneShotJobStore.getState().phase).toBe('failed');
    expect(useOneShotJobStore.getState().failureReason).toBe('reload-interrupted');
  });
});
