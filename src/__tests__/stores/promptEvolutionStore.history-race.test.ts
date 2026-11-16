import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePromptEvolutionStore } from '@/stores/promptEvolutionStore';
import type { VariantVersionHistory } from '@/types/prompt-evolution';
import type { SubModuleId } from '@/types/modules';

/**
 * loadVersionHistory is latest-wins, like loadVariants / loadSuggestions.
 *
 * Picking item A then item B fast puts two history reads in flight. Without a
 * token, A's slower response landed last and the History tab (and startChallenge,
 * which plans against `versionHistory`) showed item A while B was selected.
 */

const MOD = 'arpg-combat' as SubModuleId;

const history = (checklistItemId: string): VariantVersionHistory => ({
  moduleId: MOD, checklistItemId, versions: [], roots: [], activeVariantId: null,
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

const okResponse = (data: unknown) => ({ json: async () => ({ success: true, data }) }) as Response;

beforeEach(() => {
  usePromptEvolutionStore.setState({ versionHistory: null, isLoadingHistory: false, error: null });
});
afterEach(() => vi.unstubAllGlobals());

describe('promptEvolutionStore.loadVersionHistory — latest wins', () => {
  it('a slower response for the previous item never overwrites the newer item', async () => {
    const a = deferred<Response>();
    const b = deferred<Response>();
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => a.promise)
      .mockImplementationOnce(() => b.promise);
    vi.stubGlobal('fetch', fetchMock);

    const store = usePromptEvolutionStore.getState();
    const first = store.loadVersionHistory(MOD, 'item-a');
    const second = store.loadVersionHistory(MOD, 'item-b');

    b.resolve(okResponse(history('item-b')));
    await second;
    a.resolve(okResponse(history('item-a')));
    await first;

    const s = usePromptEvolutionStore.getState();
    expect(s.versionHistory?.checklistItemId).toBe('item-b');
    expect(s.isLoadingHistory).toBe(false);
  });
});
