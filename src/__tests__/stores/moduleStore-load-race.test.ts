/**
 * loadProgress responses can arrive out of order, or after the progress was
 * cleared. Only the newest request may write, or the store ends up owned by a
 * project that is not open.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useModuleStore } from '@/stores/moduleStore';

function progress(item: string) {
  const body = {
    success: true,
    data: { checklistProgress: { 'arpg-combat': { [item]: true } }, moduleHealth: {}, checklistVerification: {}, moduleHistory: {} },
  };
  return { ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) };
}

function deferredFetch() {
  const calls: Array<{ resolve: (r: unknown) => void; reject: (e: Error) => void }> = [];
  globalThis.fetch = vi.fn(() => new Promise((resolve, reject) => { calls.push({ resolve, reject }); })) as unknown as typeof fetch;
  return calls;
}

beforeEach(() => {
  useModuleStore.setState({
    checklistProgress: {}, checklistCompletedAt: {}, moduleHealth: {}, checklistVerification: {}, moduleHistory: {},
    progressProjectPath: null, progressLoadError: null, progressSaveError: null, progressLoadPath: null, isLoadingProgress: false,
  });
});

const store = () => useModuleStore.getState();

describe('loadProgress ordering', () => {
  it('an older response arriving last does not overwrite the newer project', async () => {
    const calls = deferredFetch();
    const a = store().loadProgress('/proj/A');
    const b = store().loadProgress('/proj/B');

    calls[1].resolve(progress('acb-1'));
    await b;
    calls[0].resolve(progress('acb-2'));
    await a;

    expect(store().progressProjectPath).toBe('/proj/B');
    expect(store().checklistProgress['arpg-combat']).toEqual({ 'acb-1': true });
  });

  it('a response arriving after clearProgress does not refill the store', async () => {
    const calls = deferredFetch();
    const a = store().loadProgress('/proj/A');
    store().clearProgress();
    calls[0].resolve(progress('acb-2'));
    await a;

    expect(store().progressProjectPath).toBeNull();
    expect(store().checklistProgress).toEqual({});
    expect(store().isLoadingProgress).toBe(false);
  });

  it('an older failure neither reports nor claims ownership', async () => {
    const calls = deferredFetch();
    const a = store().loadProgress('/proj/A');
    const b = store().loadProgress('/proj/B');
    calls[1].resolve(progress('acb-1'));
    await b;
    calls[0].reject(new Error('boom'));
    await a;

    expect(store().progressProjectPath).toBe('/proj/B');
    expect(store().progressLoadError).toBeNull();
  });

  it('keeps isLoadingProgress up while the newest request is still pending', async () => {
    const calls = deferredFetch();
    const a = store().loadProgress('/proj/A');
    const b = store().loadProgress('/proj/B');
    calls[0].resolve(progress('acb-2'));
    await a;
    expect(store().isLoadingProgress).toBe(true);
    calls[1].resolve(progress('acb-1'));
    await b;
    expect(store().isLoadingProgress).toBe(false);
  });
});
