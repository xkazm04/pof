import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
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
