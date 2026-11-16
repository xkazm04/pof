/**
 * What adopting useSuspendableSelector buys: a hidden LRU pane commits nothing while its
 * high-rate slices churn, and shows the latest value in the render that resumes it.
 * Commits are counted with React's Profiler, so a re-render of the whole subtree counts once.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, renderHook, cleanup, act, screen } from '@testing-library/react';
import { Profiler, type ReactNode } from 'react';
import { SuspendContext } from '@/hooks/useSuspend';
import { useLiveStateSync } from '@/hooks/useLiveStateSync';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import { ue5LiveState } from '@/lib/ue5-bridge/ws-live-state';
import { LiveStateSyncPanel } from '@/components/modules/project-setup/LiveStateSyncPanel';
import { GenerationQueue } from '@/components/modules/visual-gen/asset-forge/GenerationQueue';
import { UeImportPanel } from '@/components/modules/visual-gen/asset-forge/UeImportPanel';
import { useForgeStore, UE_IMPORT_IDLE } from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import type { UE5EditorSnapshot } from '@/types/ue5-bridge';

const UPDATES = 60;

function mountPane(children: ReactNode, initialSuspended: boolean) {
  const counter = { commits: 0 };
  const pane = (suspended: boolean) => (
    <SuspendContext.Provider value={suspended}>
      <Profiler id="pane" onRender={() => { counter.commits += 1; }}>{children}</Profiler>
    </SuspendContext.Provider>
  );
  const { rerender } = render(pane(initialSuspended));
  return { counter, suspend: (value: boolean) => rerender(pane(value)) };
}

const frame = (n: number) => ({ liveSnapshot: { frame: n } as unknown as UE5EditorSnapshot, wsFrameRate: n });

function LiveProbe({ onRender }: { onRender?: (frameRate: number) => void }) {
  const { frameRate } = useLiveStateSync();
  onRender?.(frameRate);
  return null;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { jobs: [] } }) })));
  useUE5BridgeStore.setState({ liveSnapshot: null, wsFrameRate: 0, propertyWatches: {} });
  useForgeStore.setState({ jobs: [], activePolls: [], ueImport: UE_IMPORT_IDLE });
});

afterEach(() => {
  cleanup();
  useForgeStore.getState().stopAllPolling();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useLiveStateSync in a hidden pane', () => {
  it('commits 0 times for 60 live frames, then shows the last frame on resume', () => {
    const seen: number[] = [];
    const { counter, suspend } = mountPane(<LiveProbe onRender={(rate) => seen.push(rate)} />, true);

    counter.commits = 0;
    for (let i = 1; i <= UPDATES; i += 1) act(() => useUE5BridgeStore.setState(frame(i)));
    expect(counter.commits).toBe(0);

    suspend(false);
    expect(seen.at(-1)).toBe(UPDATES);
  });

  it('commits once per frame while visible (the control)', () => {
    const { counter } = mountPane(<LiveProbe />, false);

    counter.commits = 0;
    for (let i = 1; i <= UPDATES; i += 1) act(() => useUE5BridgeStore.setState(frame(i)));
    expect(counter.commits).toBe(UPDATES);
  });

  it('keeps the socket bridge writing the store while hidden', () => {
    let notify: (state: ReturnType<typeof ue5LiveState.getState>) => void = () => {};
    vi.spyOn(ue5LiveState, 'onStateChange').mockImplementation((listener) => {
      notify = listener;
      return () => {};
    });
    mountPane(<LiveProbe />, true);

    act(() => notify({ ...ue5LiveState.getState(), frameRate: 42 }));

    expect(useUE5BridgeStore.getState().wsFrameRate).toBe(42);
  });

  it('connects to the current host even if it changed while hidden', () => {
    const connect = vi.spyOn(ue5LiveState, 'connect').mockImplementation(() => {});
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SuspendContext.Provider value={true}>{children}</SuspendContext.Provider>
    );
    const { result } = renderHook(() => useLiveStateSync(), { wrapper });

    act(() => useUE5BridgeStore.setState({ host: '10.0.0.9', wsPort: 40000 }));
    result.current.connectWs();

    expect(connect).toHaveBeenCalledWith('10.0.0.9', 40000);
    act(() => useUE5BridgeStore.setState({ host: '127.0.0.1', wsPort: 30041 }));
  });

  it('LiveStateSyncPanel commits 0 times hidden', () => {
    const { counter } = mountPane(<LiveStateSyncPanel />, true);

    counter.commits = 0;
    for (let i = 1; i <= UPDATES; i += 1) act(() => useUE5BridgeStore.setState({ wsFrameRate: i }));
    expect(counter.commits).toBe(0);
  });
});

describe('forge job polls in a hidden pane', () => {
  const tick = (id: string, progress: number) => act(() => useForgeStore.getState().updateJob(id, { progress }));
  const addJob = (prompt: string) =>
    useForgeStore.getState().addJob({ mode: 'text-to-3d', prompt, providerId: 'triposr' });

  it('GenerationQueue commits 0 times for 60 ticks, then lists a job added while hidden', () => {
    const id = addJob('A sword');
    const { counter, suspend } = mountPane(<GenerationQueue />, true);

    counter.commits = 0;
    for (let i = 1; i <= UPDATES; i += 1) tick(id, i);
    act(() => { addJob('A shield added while hidden'); });
    expect(counter.commits).toBe(0);

    suspend(false);
    expect(screen.getByText('A shield added while hidden')).toBeTruthy();
  });

  it('UeImportPanel commits 0 times for 60 ticks', () => {
    const id = addJob('A sword');
    const { counter } = mountPane(<UeImportPanel />, true);

    counter.commits = 0;
    for (let i = 1; i <= UPDATES; i += 1) tick(id, i);
    expect(counter.commits).toBe(0);
  });
});
