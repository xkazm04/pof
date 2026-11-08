/**
 * The coach drain's OUTCOME must outlive the Baseline that launched it. Baseline remounts on
 * every view toggle (AnimatePresence keyed by view), and the outcome lived in its useState —
 * so leaving for the Matrix while a drain ran threw the result away (the late setState hit an
 * unmounted component) and the header run was dropped with `finishRun(key, null)`: nothing
 * anywhere said what the drain did. The batch drain already keeps its result in a store.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';

let release: ((v: unknown) => void) | null = null;
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  drainGates: vi.fn(() => new Promise((r) => { release = r; })),
}));
vi.mock('@/components/layout-lab/labArtifactCache', () => ({ invalidateArtifacts: vi.fn() }));

import { useEntityDrain } from '@/components/layout-lab/Baseline/useEntityDrain';
import { useLabRunnerStore } from '@/components/layout-lab/labRunnerStore';

afterEach(() => { cleanup(); useLabRunnerStore.setState({ runs: {}, localDrain: null }); });

describe('useEntityDrain — the outcome survives a remount', () => {
  it('a drain that resolves while the launcher is unmounted is shown when it mounts again', async () => {
    const steps = ['Concept Brief', 'Combat Test Gate'];
    const first = renderHook(() => useEntityDrain('bestiary', 'e1', steps));
    let run!: Promise<void>;
    act(() => { run = first.result.current.runDrain(); });
    expect(first.result.current.draining).toBe(true);
    first.unmount(); // the operator flips to the Matrix mid-drain

    await waitFor(() => expect(release).not.toBeNull()); // drainGates is dispatched on a microtask
    await act(async () => { release!({ kind: 'error', reason: 'editor offline' }); await run; });

    const back = renderHook(() => useEntityDrain('bestiary', 'e1', steps));
    await waitFor(() => expect(back.result.current.drainOutcome).not.toBeNull());
    // …and it stays scoped to its own entity.
    const other = renderHook(() => useEntityDrain('bestiary', 'e2', steps));
    expect(other.result.current.drainOutcome).toBeNull();
    act(() => { back.result.current.dismissDrainOutcome(); });
    expect(back.result.current.drainOutcome).toBeNull();
  });
});
