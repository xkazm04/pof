import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { createElement } from 'react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

const fetchDrainLease = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({ fetchDrainLease: (...a: unknown[]) => fetchDrainLease(...a) }));

import { RunnerChip } from '@/components/layout-lab/RunnerChip';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabRunnerStore } from '@/components/layout-lab/labRunnerStore';
import { SuspendContext } from '@/hooks/useSuspend';

const chip = (c: HTMLElement) => c.querySelector('[data-testid="lab-runner-chip"]');

describe('RunnerChip', () => {
  afterEach(cleanup);
  beforeEach(() => {
    fetchDrainLease.mockReset();
    useLabRunnerStore.setState({ localDrain: null });
  });

  it('shows idle when no local drain and the API reports no lease', async () => {
    fetchDrainLease.mockResolvedValue({ held: false, scope: null, since: null, scopes: [] });
    const { container } = render(<RunnerChip t={LIGHT} />);
    await waitFor(() => expect(chip(container)?.getAttribute('data-state')).toBe('idle'));
    expect(chip(container)?.textContent).toContain('idle');
  });

  it('shows "lease held" with the holder scope when another session holds the lease', async () => {
    fetchDrainLease.mockResolvedValue({ held: true, scope: 'items/item-1', since: '2026-07-15T00:00:00Z', scopes: ['items/item-1'] });
    const { container } = render(<RunnerChip t={LIGHT} />);
    await waitFor(() => expect(chip(container)?.getAttribute('data-state')).toBe('held'));
    expect(chip(container)?.textContent).toContain('lease held');
    expect(chip(container)?.textContent).toContain('items/item-1');
  });

  it('shows "draining" from the lab\'s own drain state without polling the API', async () => {
    useLabRunnerStore.setState({ localDrain: 'items/item-9' });
    const { container } = render(<RunnerChip t={LIGHT} />);
    expect(chip(container)?.getAttribute('data-state')).toBe('draining');
    expect(chip(container)?.textContent).toContain('draining');
    expect(chip(container)?.textContent).toContain('items/item-9');
    // Our own drain is authoritative — the chip must NOT poll the lease API.
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchDrainLease).not.toHaveBeenCalled();
  });

  it('does not poll while suspended (hidden module)', async () => {
    fetchDrainLease.mockResolvedValue({ held: false, scope: null, since: null, scopes: [] });
    render(createElement(SuspendContext.Provider, { value: true }, createElement(RunnerChip, { t: LIGHT })));
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchDrainLease).not.toHaveBeenCalled();
  });
});
