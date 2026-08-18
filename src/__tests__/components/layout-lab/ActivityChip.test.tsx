import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { createElement } from 'react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

const fetchDrainLease = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchDrainLease: (...a: unknown[]) => fetchDrainLease(...a),
}));

import { ActivityChip } from '@/components/layout-lab/ActivityChip';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabRunnerStore } from '@/components/layout-lab/labRunnerStore';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import { SuspendContext } from '@/hooks/useSuspend';

const chip = () => screen.getByTestId('lab-activity-chip');
const lane = (id: string) => screen.getByTestId(`lab-activity-lane-${id}`);
const FREE = { held: false, scope: null, since: null, scopes: [] };

async function open() {
  fireEvent.click(chip());
  await screen.findByTestId('lab-activity-panel');
}

describe('ActivityChip — one place to see what is running', () => {
  afterEach(cleanup);
  beforeEach(() => {
    localStorage.clear();
    fetchDrainLease.mockReset();
    useLabRunnerStore.setState({ localDrain: null });
    useOneShotJobStore.getState().reset();
    useOneShotLabStore.setState({ panelOpen: false, pendingNavigation: null });
    useForgeStore.setState({ activePolls: [] });
  });

  it('ONE chip answers for both job systems at once', async () => {
    // A one-shot job is running AND the UE lease is free: previously two chips with two
    // vocabularies, one of which (RunnerChip) rendered even when there was nothing to say.
    fetchDrainLease.mockResolvedValue(FREE);
    useOneShotJobStore.setState({ phase: 'running', catalogId: 'spellbook', currentStepIndex: 2, totalSteps: 10 });

    render(<ActivityChip t={LIGHT} />);
    await waitFor(() => expect(chip().getAttribute('data-state')).toBe('running-here'));

    await open();
    expect(lane('drain').getAttribute('data-state')).toBe('idle');
    expect(lane('one-shot').getAttribute('data-state')).toBe('running-here');
    expect(lane('one-shot').textContent).toContain('step 3/10');
    expect(lane('forge').getAttribute('data-state')).toBe('idle');
  });

  it('does NOT read as idle before the first lease poll answers', async () => {
    // The lie this replaces: `lease === null` rendered "Runner · idle" — an operator could
    // read a free UE editor off a chip that had asked nobody yet.
    fetchDrainLease.mockReturnValue(new Promise(() => {})); // never resolves

    render(<ActivityChip t={LIGHT} />);
    expect(chip().getAttribute('data-state')).toBe('unknown');
    expect(chip().textContent).not.toContain('Nothing running');

    await open();
    expect(lane('drain').getAttribute('data-state')).toBe('unknown');
    expect(lane('drain').textContent).toMatch(/not checked yet/i);
  });

  it('reports UNKNOWN (not idle) when the lease read fails', async () => {
    fetchDrainLease.mockResolvedValue(null); // non-throwing client returns null on failure
    render(<ActivityChip t={LIGHT} />);
    await open();
    await waitFor(() => expect(lane('drain').textContent).toMatch(/unreachable/i));
    expect(lane('drain').getAttribute('data-state')).toBe('unknown');
  });

  it('says "Nothing running" only after a successful poll with everything idle', async () => {
    fetchDrainLease.mockResolvedValue(FREE);
    render(<ActivityChip t={LIGHT} />);
    await waitFor(() => expect(chip().getAttribute('data-state')).toBe('idle'));
    expect(chip().textContent).toContain('Nothing running');
  });

  it("keeps MY drain distinguishable from another session's lease — and does not poll for its own", async () => {
    useLabRunnerStore.setState({ localDrain: 'items · 3 sets' });
    render(<ActivityChip t={LIGHT} />);

    expect(chip().getAttribute('data-state')).toBe('running-here');
    await open();
    expect(lane('drain').textContent).toContain('RUNNING HERE');
    expect(lane('drain').textContent).toContain('items · 3 sets');
    // Our own drain is authoritative — no lease poll (unchanged from the old RunnerChip).
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchDrainLease).not.toHaveBeenCalled();
  });

  it('names a lease held by a drain this page did not start', async () => {
    fetchDrainLease.mockResolvedValue({ held: true, scope: 'items/item-1', since: null, scopes: ['items/item-1'] });
    render(<ActivityChip t={LIGHT} />);
    await waitFor(() => expect(chip().getAttribute('data-state')).toBe('running-elsewhere'));

    await open();
    expect(lane('drain').getAttribute('data-state')).toBe('running-elsewhere');
    expect(lane('drain').textContent).toContain('items/item-1');
    expect(lane('drain').textContent).toContain('did not start');
  });

  it('surfaces the forge background polls that outlive their module', async () => {
    fetchDrainLease.mockResolvedValue(FREE);
    useForgeStore.setState({ activePolls: ['forge-1', 'forge-2'] });
    render(<ActivityChip t={LIGHT} />);
    await open();
    expect(lane('forge').getAttribute('data-state')).toBe('running-here');
    expect(lane('forge').textContent).toContain('2 background generation polls');
  });

  it('keeps the one-shot panel reachable (the old jobs chip\'s only action)', async () => {
    fetchDrainLease.mockResolvedValue(FREE);
    useOneShotJobStore.setState({ phase: 'failed', catalogId: 'items' });
    render(<ActivityChip t={LIGHT} />);
    await open();

    expect(lane('one-shot').getAttribute('data-state')).toBe('attention');
    fireEvent.click(screen.getByLabelText('open one-shot panel'));
    expect(useOneShotLabStore.getState().panelOpen).toBe(true);
  });

  it('states its blind spots instead of implying it sees everything', async () => {
    fetchDrainLease.mockResolvedValue(FREE);
    render(<ActivityChip t={LIGHT} />);
    await open();
    for (const id of ['drain', 'one-shot', 'forge']) {
      expect(lane(id).textContent).toContain('Blind spot:');
    }
    // …including the engines it deliberately does not track at all.
    expect(screen.getByTestId('lab-activity-panel').textContent).toContain('Not covered here');
  });

  it('does not poll while suspended (hidden module)', async () => {
    fetchDrainLease.mockResolvedValue(FREE);
    render(createElement(SuspendContext.Provider, { value: true }, createElement(ActivityChip, { t: LIGHT })));
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchDrainLease).not.toHaveBeenCalled();
    // A suspended surface has not heard from the lease — it must say unknown, not idle.
    expect(chip().getAttribute('data-state')).toBe('unknown');
  });
});
