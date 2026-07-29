import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import { CliProduce } from '@/components/layout-lab/steps/shared/CliProduce';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { LIVE_PRODUCE_KEY } from '@/components/layout-lab/labProduceMode';
import { setLiveProduceEnabled } from '@/components/layout-lab/labProduceMode';
import type { DispatchPlan } from '@/lib/cli-spend/dispatchPlan';

const t = LAB_THEMES[0];

const plan = (over: Partial<DispatchPlan> = {}): DispatchPlan => ({
  taskType: 'one-shot-step',
  label: 'Pipeline step (live CLI produce)',
  taskClass: 'produce-text',
  model: 'sonnet',
  effort: 'medium',
  estimate: { avgCostUsd: 0.42, runs: 12 },
  ...over,
});

/** Stub the envelope `tryApiFetch` unwraps. */
function stubFetch(body: DispatchPlan) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ success: true, data: body }),
  })) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  window.localStorage.removeItem(LIVE_PRODUCE_KEY);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setLiveProduceEnabled(false);
});

describe('CliProduce live-dispatch plan readout', () => {
  it('does not fetch a plan in stub mode — a free write must not cost a request', () => {
    const f = stubFetch(plan());
    render(<CliProduce t={t} label="Run" buildPrompt={() => ''} onComplete={() => {}} liveEligible />);
    expect(f).not.toHaveBeenCalled();
    expect(screen.queryByTestId('cli-produce-plan')).toBeNull();
  });

  it('does not fetch for a step live mode would not change', () => {
    setLiveProduceEnabled(true);
    const f = stubFetch(plan());
    render(<CliProduce t={t} label="Run" buildPrompt={() => ''} onComplete={() => {}} />);
    expect(f).not.toHaveBeenCalled();
  });

  it('names the model, effort and policy class once live', async () => {
    setLiveProduceEnabled(true);
    stubFetch(plan());
    render(<CliProduce t={t} label="Run" buildPrompt={() => ''} onComplete={() => {}} liveEligible />);

    const el = await screen.findByTestId('cli-produce-plan');
    expect(el.textContent).toContain('sonnet');
    expect(el.textContent).toContain('medium');
    expect(el.textContent).toContain('produce-text');
    expect(el.getAttribute('data-pinned')).toBe('true');
  });

  it('prices the dispatch from recorded runs', async () => {
    setLiveProduceEnabled(true);
    stubFetch(plan());
    render(<CliProduce t={t} label="Run" buildPrompt={() => ''} onComplete={() => {}} liveEligible />);

    const el = await screen.findByTestId('cli-produce-plan');
    expect(el.textContent).toContain('$0.42');
    expect(el.textContent).toContain('12 past runs');
    expect(el.getAttribute('data-priced')).toBe('true');
  });

  it('says there is no cost history instead of rendering a $0.00 that reads as free', async () => {
    setLiveProduceEnabled(true);
    stubFetch(plan({ estimate: null }));
    render(<CliProduce t={t} label="Run" buildPrompt={() => ''} onComplete={() => {}} liveEligible />);

    const el = await screen.findByTestId('cli-produce-plan');
    expect(el.textContent).toMatch(/no cost history/i);
    expect(el.textContent).not.toContain('$0.00');
    expect(el.getAttribute('data-priced')).toBe('false');
  });

  it('flags an unpinned dispatch rather than implying a governed model', async () => {
    setLiveProduceEnabled(true);
    stubFetch(plan({ taskClass: null, model: null, effort: null }));
    render(<CliProduce t={t} label="Run" buildPrompt={() => ''} onComplete={() => {}} liveEligible />);

    const el = await screen.findByTestId('cli-produce-plan');
    expect(el.getAttribute('data-pinned')).toBe('false');
    expect(el.textContent).toMatch(/unpinned/i);
  });

  it('falls back to the plain live copy when the plan fetch fails', async () => {
    setLiveProduceEnabled(true);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ success: false, error: 'nope' }) })) as unknown as typeof fetch);
    render(<CliProduce t={t} label="Run" buildPrompt={() => ''} onComplete={() => {}} liveEligible />);

    // The LIVE warning still stands; only the (unavailable) detail is withheld.
    expect(screen.getByText(/Switch to Stub for a local, free write/i)).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('cli-produce-plan')).toBeNull());
  });
});
