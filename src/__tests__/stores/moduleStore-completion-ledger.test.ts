/**
 * Checklist completion carries a time.
 *
 * `checklistProgress` is a boolean map, so no velocity could ever be derived
 * from it — which is why the health engine used to simulate one. The store now
 * stamps `checklistCompletedAt[module][item]` on the FIRST transition to done,
 * removes the stamp when the item is un-done, and drops the whole ledger with
 * the rest of a project's progress (clearProgress, or a load that replaces
 * another project's in-memory marks).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockFetchRoutes } from '../setup';
import { useModuleStore } from '@/stores/moduleStore';
import { cancelAutoSave } from '@/services/ProjectModuleBridge';

const T1 = Date.UTC(2026, 8, 1);
const T2 = Date.UTC(2026, 8, 8);
const T3 = Date.UTC(2026, 8, 15);

function at(t: number) {
  vi.spyOn(Date, 'now').mockReturnValue(t);
}

const ledger = () => useModuleStore.getState().checklistCompletedAt;

beforeEach(() => {
  cancelAutoSave();
  useModuleStore.setState({
    checklistProgress: {},
    checklistCompletedAt: {},
    moduleHealth: {},
    moduleHistory: {},
    checklistVerification: {},
    scanResults: {},
    progressProjectPath: null,
    progressAdopted: true,
    progressLoadError: null,
    progressSaveError: null,
    progressLoadPath: null,
    isLoadingProgress: false,
  });
});

afterEach(() => {
  cancelAutoSave();
  vi.restoreAllMocks();
});

describe('moduleStore — dated completion ledger (case 6)', () => {
  it('stamps the first completion, keeps it on a repeat, removes it on un-done, re-stamps on toggle', () => {
    const s = () => useModuleStore.getState();

    at(T1);
    s().setChecklistItem('arpg-combat', 'acb-1', true);
    expect(ledger()['arpg-combat']?.['acb-1']).toBe(T1);

    at(T2);
    s().setChecklistItem('arpg-combat', 'acb-1', true);
    expect(ledger()['arpg-combat']?.['acb-1']).toBe(T1);

    s().setChecklistItem('arpg-combat', 'acb-1', false);
    expect(ledger()['arpg-combat']?.['acb-1']).toBeUndefined();

    at(T3);
    s().toggleChecklistItem('arpg-combat', 'acb-1');
    expect(s().checklistProgress['arpg-combat']?.['acb-1']).toBe(true);
    expect(ledger()['arpg-combat']?.['acb-1']).toBe(T3);

    s().toggleChecklistItem('arpg-combat', 'acb-1');
    expect(ledger()['arpg-combat']?.['acb-1']).toBeUndefined();

    at(T1);
    s().setChecklistItem('arpg-combat', 'acb-2', true);
    s().clearProgress();
    expect(ledger()).toEqual({});
  });

  it('persists the ledger with the rest of the progress blob', () => {
    at(T2);
    useModuleStore.getState().setChecklistItem('arpg-combat', 'acb-1', true);
    const persisted = JSON.parse(globalThis.localStorage.getItem('pof-modules') ?? '{}') as {
      state?: { checklistCompletedAt?: Record<string, Record<string, number>> };
    };
    expect(persisted.state?.checklistCompletedAt?.['arpg-combat']?.['acb-1']).toBe(T2);
  });

  it("drops another project's ledger when a different project's progress loads", async () => {
    at(T1);
    useModuleStore.setState({ progressProjectPath: 'C:/p1' });
    useModuleStore.getState().setChecklistItem('arpg-combat', 'acb-1', true);
    mockFetchRoutes([
      {
        match: '/api/project-progress?',
        response: { body: { success: true, data: { checklistProgress: { 'arpg-combat': { 'acb-1': true } } } } },
      },
    ]);

    await useModuleStore.getState().loadProgress('C:/p2');
    expect(useModuleStore.getState().checklistProgress['arpg-combat']?.['acb-1']).toBe(true);
    // p2's `x` was done at some unknown time — p1's stamp must not date it.
    expect(ledger()).toEqual({});
  });

  it('drops the ledger when a foreign load fails', async () => {
    at(T1);
    useModuleStore.setState({ progressProjectPath: 'C:/p1' });
    useModuleStore.getState().setChecklistItem('arpg-combat', 'acb-1', true);
    mockFetchRoutes([
      { match: '/api/project-progress?', response: { body: { success: false, error: 'boom' }, status: 500 } },
    ]);

    await useModuleStore.getState().loadProgress('C:/p2');
    expect(ledger()).toEqual({});
  });

  it('keeps own stamps on a same-project reload, pruning items the server says are not done', async () => {
    at(T1);
    useModuleStore.setState({ progressProjectPath: 'C:/p1' });
    useModuleStore.getState().setChecklistItem('arpg-combat', 'acb-1', true);
    useModuleStore.getState().setChecklistItem('arpg-combat', 'acb-2', true);
    mockFetchRoutes([
      {
        match: '/api/project-progress?',
        response: { body: { success: true, data: { checklistProgress: { 'arpg-combat': { 'acb-1': true, 'acb-2': false } } } } },
      },
    ]);

    await useModuleStore.getState().loadProgress('C:/p1');
    expect(ledger()).toEqual({ 'arpg-combat': { 'acb-1': T1 } });
  });
});
