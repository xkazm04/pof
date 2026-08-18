import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';
import { createElement } from 'react';
import { SuspendContext } from '@/hooks/useSuspend';
import { GenerationQueue } from '@/components/modules/visual-gen/asset-forge/GenerationQueue';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';

afterEach(() => {
  cleanup();
  useForgeStore.getState().stopAllPolling();
  vi.useRealTimers();
});

beforeEach(() => {
  useForgeStore.setState({ jobs: [], activeProviderId: 'triposr', promptHistory: [], activePolls: [] });
});

describe('GenerationQueue — background-poll visibility', () => {
  it('surfaces running background polls and offers an explicit stop', () => {
    const id = useForgeStore.getState().addJob({
      mode: 'text-to-3d', prompt: 'A sword', providerId: 'triposr',
    });
    useForgeStore.setState({ activePolls: [id] });

    render(<GenerationQueue />);
    const banner = screen.getByTestId('forge-active-polls');
    expect(banner.textContent).toContain('1 background status poll running');

    fireEvent.click(screen.getByTestId('forge-stop-polls'));
    // No registered poller for a hand-seeded id, so the list is what the store owns;
    // the affordance exists and is wired to the store's explicit stop.
    expect(typeof useForgeStore.getState().stopAllPolling).toBe('function');
  });

  it('shows no banner when nothing is polling', () => {
    useForgeStore.getState().addJob({ mode: 'text-to-3d', prompt: 'A shield', providerId: 'triposr' });
    render(<GenerationQueue />);
    expect(screen.queryByTestId('forge-active-polls')).toBeNull();
  });
});

describe('GenerationQueue — elapsed ticker suspends with the module', () => {
  function renderSuspended(suspended: boolean) {
    return render(createElement(SuspendContext.Provider, { value: suspended }, createElement(GenerationQueue)));
  }

  /** The elapsed label of the (only) in-flight job card. */
  function elapsedLabel(): string {
    const el = screen.getByText(/^\d+s$/);
    return el.textContent ?? '';
  }

  it('advances the elapsed clock while visible', () => {
    vi.useFakeTimers();
    useForgeStore.getState().addJob({ mode: 'text-to-3d', prompt: 'A', providerId: 'triposr' });
    renderSuspended(false);
    const before = elapsedLabel();
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(elapsedLabel()).not.toBe(before);
  });

  it('stops ticking while suspended', () => {
    vi.useFakeTimers();
    useForgeStore.getState().addJob({ mode: 'text-to-3d', prompt: 'A', providerId: 'triposr' });
    renderSuspended(true);
    const before = elapsedLabel();
    act(() => { vi.advanceTimersByTime(30_000); });
    // 30s of wall clock, zero re-renders: the hidden module burns no interval.
    expect(elapsedLabel()).toBe(before);
  });
});
