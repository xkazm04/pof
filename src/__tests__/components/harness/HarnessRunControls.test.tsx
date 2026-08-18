import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor, fireEvent, screen } from '@testing-library/react';

import { HarnessRunControls } from '@/components/harness/HarnessRunControls';
import {
  startGuard, pauseGuard, resumeGuard, buildStartBody, PAUSE_PROCESS_CAVEAT,
} from '@/components/harness/HarnessRunControls/controlGuards';
import { EMPTY_START_FORM, type HarnessStatusResponse } from '@/components/harness/HarnessRunControls/types';

const originalFetch = global.fetch;

/** A status payload shaped exactly like the route's summary response. */
function statusPayload(over: Partial<HarnessStatusResponse> = {}): HarnessStatusResponse {
  return {
    status: 'idle',
    runId: null,
    plan: null,
    guide: null,
    cost: null,
    checkpoints: null,
    recentEvents: [],
    ...over,
  };
}

const RUNNING = statusPayload({
  status: 'running',
  runId: 'run-42',
  plan: {
    game: 'PoF', iteration: 3, totalFeatures: 20, passingFeatures: 12, verifiedFeatures: 8,
    passRate: 60, selfReportedPassRate: 60, verifiedPassRate: 40,
    totalAreas: 6, completedAreas: 2, failedAreas: 1, gappedAreas: 0, currentArea: 'arpg-combat',
  },
  cost: { spentUsd: 7.5, budgetUsd: 25, sessions: 4, paused: false, byArea: {}, remainingUsd: 17.5 },
});

interface FetchCall { url: string; init?: RequestInit }
let calls: FetchCall[] = [];

/** Install a fetch stub: GET returns `status`, POST returns `postResult`. */
function installFetch(status: HarnessStatusResponse, postResult: { ok: true; data: unknown } | { ok: false; error: string } = { ok: true, data: { status: 'started', message: 'Harness loop started' } }) {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    if (init?.method === 'POST') {
      return postResult.ok
        ? new Response(JSON.stringify({ success: true, data: postResult.data }), { status: 200 })
        : new Response(JSON.stringify({ success: false, error: postResult.error }), { status: 409 });
    }
    return new Response(JSON.stringify({ success: true, data: status }), { status: 200 });
  }) as unknown as typeof fetch;
}

const postBodies = () =>
  calls.filter((c) => c.init?.method === 'POST').map((c) => JSON.parse(String(c.init?.body)));

beforeEach(() => { calls = []; });
afterEach(() => { global.fetch = originalFetch; cleanup(); vi.restoreAllMocks(); });

describe('controlGuards (pure)', () => {
  it('disables start while a run is in flight, naming the 409', () => {
    const g = startGuard('running', { ...EMPTY_START_FORM, projectPath: 'p', projectName: 'n', ueVersion: '5.8' });
    expect(g.enabled).toBe(false);
    expect(g.reason).toContain('409');
  });

  it('disables start with the missing required fields named', () => {
    const g = startGuard('idle', EMPTY_START_FORM);
    expect(g.enabled).toBe(false);
    expect(g.reason).toContain('project path');
    expect(g.reason).toContain('UE version');
  });

  it('disables pause unless a run is in flight, and names the observed status', () => {
    expect(pauseGuard('idle').enabled).toBe(false);
    expect(pauseGuard('idle').reason).toContain('idle');
    expect(pauseGuard('running').enabled).toBe(true);
  });

  it('allows resume when paused, or with a state path to rehydrate after a restart', () => {
    expect(resumeGuard('paused', '')).toMatchObject({ enabled: true, mode: 'resume' });
    expect(resumeGuard('idle', 'C:/x/.harness')).toMatchObject({ enabled: true, mode: 'rehydrate' });
    const blocked = resumeGuard('idle', '');
    expect(blocked.enabled).toBe(false);
    expect(blocked.reason).toContain('state path');
  });

  it('builds a start body that omits every blank optional field', () => {
    const body = buildStartBody({
      ...EMPTY_START_FORM, projectPath: ' C:/p ', projectName: 'PoF', ueVersion: '5.8',
      budgetUsd: '10', checkpoint: true,
    });
    expect(body).toEqual({
      action: 'start', projectPath: 'C:/p', projectName: 'PoF', ueVersion: '5.8',
      budgetUsd: 10, checkpoint: true,
    });
  });
});

describe('HarnessRunControls', () => {
  it('shows live run state — current area, progress and spend vs budget', async () => {
    installFetch(RUNNING);
    const { container } = render(<HarnessRunControls />);
    await waitFor(() => expect(container.querySelector('[data-testid="harness-run-state"]')).toBeTruthy());

    expect(container.querySelector('[data-testid="harness-run-state"]')?.getAttribute('data-run-status')).toBe('running');
    expect(container.textContent).toContain('arpg-combat');
    expect(container.textContent).toContain('run-42');
    // Verified numerator is the one the meter draws; self-report is labelled beside it.
    expect(container.textContent).toContain('8/20');
    expect(container.querySelector('[data-testid="harness-spend"]')?.textContent).toContain('$7.50 of $25.00');
  });

  it('dispatches a pause POST to /api/harness', async () => {
    installFetch(RUNNING, { ok: true, data: { status: 'pausing', message: 'Will pause after current iteration completes' } });
    const { container } = render(<HarnessRunControls />);
    await waitFor(() => expect(container.querySelector('[data-testid="harness-pause"]')).toBeTruthy());

    fireEvent.click(container.querySelector('[data-testid="harness-pause"]')!);
    await waitFor(() => expect(postBodies()).toEqual([{ action: 'pause' }]));
    await waitFor(() =>
      expect(container.querySelector('[data-testid="harness-action-note"]')?.textContent)
        .toContain('Will pause after current iteration'));
    expect(calls.every((c) => c.url === '/api/harness')).toBe(true);
  });

  it('surfaces a refused pause verbatim and explains the cross-process defect', async () => {
    installFetch(RUNNING, { ok: false, error: 'Harness is not running' });
    const { container } = render(<HarnessRunControls />);
    await waitFor(() => expect(container.querySelector('[data-testid="harness-pause"]')).toBeTruthy());

    fireEvent.click(container.querySelector('[data-testid="harness-pause"]')!);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Harness is not running');
    expect(alert.textContent).toContain(PAUSE_PROCESS_CAVEAT.slice(0, 40));
  });

  it('disables start while running and pause while idle, each with a visible reason', async () => {
    installFetch(RUNNING);
    const { container } = render(<HarnessRunControls />);
    await waitFor(() => expect(container.querySelector('[data-testid="harness-start"]')).toBeTruthy());
    expect(container.querySelector<HTMLButtonElement>('[data-testid="harness-start"]')!.disabled).toBe(true);
    expect(container.querySelector('[data-testid="harness-start-reason"]')?.textContent).toContain('already in flight');
    cleanup();

    installFetch(statusPayload({ status: 'idle' }));
    const idle = render(<HarnessRunControls />);
    await waitFor(() => expect(idle.container.querySelector('[data-testid="harness-pause"]')).toBeTruthy());
    expect(idle.container.querySelector<HTMLButtonElement>('[data-testid="harness-pause"]')!.disabled).toBe(true);
    expect(idle.container.querySelector('[data-testid="harness-pause-reason"]')?.textContent).toContain('idle');
    // Resume with no paused run and no state path is refused up front, not on click.
    expect(idle.container.querySelector<HTMLButtonElement>('[data-testid="harness-resume"]')!.disabled).toBe(true);
  });

  it('starts a run with the typed fields after confirmation', async () => {
    installFetch(statusPayload({ status: 'idle' }));
    const { container } = render(<HarnessRunControls />);
    await waitFor(() => expect(container.querySelector('[data-testid="harness-start"]')).toBeTruthy());

    fireEvent.change(container.querySelector('#harness-project-path')!, { target: { value: 'C:/proj' } });
    fireEvent.change(container.querySelector('#harness-project-name')!, { target: { value: 'PoF' } });
    fireEvent.change(container.querySelector('#harness-ue-version')!, { target: { value: '5.8' } });
    fireEvent.change(container.querySelector('#harness-budget')!, { target: { value: '12' } });

    const startBtn = container.querySelector<HTMLButtonElement>('[data-testid="harness-start"]')!;
    await waitFor(() => expect(startBtn.disabled).toBe(false));
    fireEvent.click(startBtn);

    // Confirmation names the spend before anything is dispatched.
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('$12');
    expect(postBodies()).toEqual([]);

    fireEvent.click(screen.getByText('Yes, start the run', { selector: 'button' }));
    await waitFor(() => expect(postBodies()).toEqual([
      { action: 'start', projectPath: 'C:/proj', projectName: 'PoF', ueVersion: '5.8', budgetUsd: 12 },
    ]));
  });

  it('disables every control when the status read itself fails', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ success: false, error: 'boom' }), { status: 500 })) as unknown as typeof fetch;
    const { container } = render(<HarnessRunControls />);
    await waitFor(() => expect(container.querySelector('[data-testid="harness-pause"]')).toBeTruthy());
    expect(container.querySelector<HTMLButtonElement>('[data-testid="harness-pause"]')!.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('[data-testid="harness-start"]')!.disabled).toBe(true);
    expect(container.querySelector('[data-testid="harness-start-reason"]')?.textContent).toContain('unreadable');
    expect(screen.getByRole('alert').textContent).toContain('boom');
  });
});
