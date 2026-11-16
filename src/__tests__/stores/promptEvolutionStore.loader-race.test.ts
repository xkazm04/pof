import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePromptEvolutionStore } from '@/stores/promptEvolutionStore';
import type { SubModuleId } from '@/types/modules';

/**
 * loadTests and clusterPrompts are latest-wins, like the other per-module loaders.
 * Switching modules fast puts two reads in flight; the slower response for the
 * previous module must not land last.
 */

const A = 'arpg-combat' as SubModuleId;
const B = 'arpg-loot' as SubModuleId;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
const okResponse = (data: unknown) => ({ json: async () => ({ success: true, data }) }) as Response;

beforeEach(() => {
  usePromptEvolutionStore.setState({ abTests: [], clusters: [], isClustering: false, error: null });
});
afterEach(() => vi.unstubAllGlobals());

/** Start loader(A) then loader(B); resolve B first, then A. */
async function race(run: (m: SubModuleId) => Promise<void>, dataFor: (m: SubModuleId) => unknown) {
  const a = deferred<Response>();
  const b = deferred<Response>();
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => a.promise).mockImplementationOnce(() => b.promise));
  const first = run(A);
  const second = run(B);
  b.resolve(okResponse(dataFor(B)));
  await second;
  a.resolve(okResponse(dataFor(A)));
  await first;
}

describe('promptEvolutionStore per-module loaders — latest wins', () => {
  it('loadTests: the previous module slower response never overwrites the newer one', async () => {
    await race(
      (m) => usePromptEvolutionStore.getState().loadTests(m),
      (m) => [{ id: `test-${m}` }],
    );
    expect(usePromptEvolutionStore.getState().abTests.map((t) => t.id)).toEqual([`test-${B}`]);
  });

  it('clusterPrompts: the previous module slower response never overwrites the newer one', async () => {
    await race(
      (m) => usePromptEvolutionStore.getState().clusterPrompts(m),
      (m) => [{ id: `cluster-${m}` }],
    );
    const s = usePromptEvolutionStore.getState();
    expect((s.clusters as unknown as { id: string }[]).map((c) => c.id)).toEqual([`cluster-${B}`]);
    expect(s.isClustering).toBe(false);
  });
});
