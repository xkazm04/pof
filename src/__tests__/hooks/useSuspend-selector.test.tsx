/** useSuspendableSelector is documented as a drop-in for zustand's useStore(selector). */
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, render, cleanup, act } from '@testing-library/react';
import { Profiler, type ReactNode } from 'react';
import { SuspendContext, useSuspendableSelector } from '@/hooks/useSuspend';
import { create } from 'zustand';

afterEach(cleanup);

/** A provider whose value the test flips between renders, as ModuleRenderer does on navigation. */
function makeSuspendHarness(initial: boolean) {
  const state = { suspended: initial };
  function Wrapper({ children }: { children: ReactNode }) {
    return <SuspendContext.Provider value={state.suspended}>{children}</SuspendContext.Provider>;
  }
  return { Wrapper, state };
}

describe('useSuspendableSelector', () => {
  it('reads the new key in the render where a closure selector changes', () => {
    const store = create<{ values: Record<string, number> }>(() => ({ values: { a: 1, b: 2 } }));
    const { result, rerender } = renderHook(
      ({ key }) => useSuspendableSelector(store, (s) => s.values[key]),
      { initialProps: { key: 'a' } },
    );
    expect(result.current).toBe(1);
    rerender({ key: 'b' });
    expect(result.current).toBe(2);
  });

  it('keeps a selected undefined frozen across a parent re-render', () => {
    const store = create<{ value: number | undefined }>(() => ({ value: undefined }));
    const { Wrapper } = makeSuspendHarness(true);
    const { result, rerender } = renderHook(() => useSuspendableSelector(store, (s) => s.value), {
      wrapper: Wrapper,
    });
    expect(result.current).toBeUndefined();

    act(() => store.setState({ value: 7 }));
    rerender();

    expect(result.current).toBeUndefined();
  });

  it('renders 0 times for N store updates while hidden, N times while visible', () => {
    const store = create<{ frame: number }>(() => ({ frame: 0 }));
    const { Wrapper, state } = makeSuspendHarness(false);
    const counter = { commits: 0 };
    function Probe() {
      return <span>{useSuspendableSelector(store, (s) => s.frame)}</span>;
    }
    const tree = <Profiler id="probe" onRender={() => { counter.commits += 1; }}><Probe /></Profiler>;
    const { rerender } = render(tree, { wrapper: Wrapper });

    counter.commits = 0;
    for (let i = 1; i <= 50; i += 1) act(() => store.setState({ frame: i }));
    expect(counter.commits).toBe(50);

    state.suspended = true;
    rerender(<Profiler id="probe" onRender={() => { counter.commits += 1; }}><Probe /></Profiler>);
    counter.commits = 0;
    for (let i = 51; i <= 100; i += 1) act(() => store.setState({ frame: i }));
    expect(counter.commits).toBe(0);
  });

  it('shows the latest store value in the render that resumes the module', () => {
    const store = create<{ frame: number }>(() => ({ frame: 0 }));
    const { Wrapper, state } = makeSuspendHarness(false);
    const { result, rerender } = renderHook(() => useSuspendableSelector(store, (s) => s.frame), { wrapper: Wrapper });

    state.suspended = true;
    rerender();
    act(() => store.setState({ frame: 9 }));
    expect(result.current).toBe(0);

    state.suspended = false;
    rerender();
    expect(result.current).toBe(9);

    act(() => store.setState({ frame: 10 }));
    expect(result.current).toBe(10);
  });

  it('keeps a selected action callable, and acting on current state, while frozen', () => {
    const store = create<{ count: number; bump: () => void }>((set) => ({
      count: 0,
      bump: () => set((s) => ({ count: s.count + 1 })),
    }));
    const { Wrapper } = makeSuspendHarness(true);
    const { result } = renderHook(() => useSuspendableSelector(store, (s) => s.bump), { wrapper: Wrapper });

    act(() => store.setState({ count: 5 }));
    act(() => result.current());

    expect(store.getState().count).toBe(6);
  });
});
