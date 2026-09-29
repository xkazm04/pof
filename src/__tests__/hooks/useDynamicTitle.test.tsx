/**
 * useDynamicTitle through React (scan-sweep --challenge, shared-utility-hooks/B): the legacy
 * shell reads cliPanelStore's run outcome (not just the isRunning edge), the outcome holds
 * until the tab is seen, the favicon repaints only on a tone change, and the lab shell's
 * always-mounted ActivityChip drives the same title from its activity summary.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act, waitFor } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
const fetchDrainLease = vi.fn();
vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchDrainLease: (...a: unknown[]) => fetchDrainLease(...a),
}));

import { useDynamicTitle } from '@/hooks/useDynamicTitle';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { UI_TIMEOUTS } from '@/lib/constants';
import { summarizeActivity, type ActivitySummary } from '@/components/layout-lab/activityModel';
import type { OneShotPhase } from '@/stores/oneShotJobStore';
import { ActivityChip } from '@/components/layout-lab/ActivityChip';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabRunnerStore } from '@/components/layout-lab/labRunnerStore';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';

function Legacy() { useDynamicTitle(); return null; }
function Lab({ summary }: { summary: ActivitySummary }) { useDynamicTitle(summary); return null; }

let visibility: DocumentVisibilityState = 'visible';
const store = () => useCLIPanelStore.getState();

function setVisibility(v: DocumentVisibilityState) {
  visibility = v;
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null, maximizedTabId: null });
  document.title = 'Original';
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function startRun(label: string): { id: string; seq: number } {
  let id = '';
  let seq = 0;
  act(() => {
    id = store().createSession({ label });
    seq = store().beginRun(id);
  });
  return { id, seq };
}

describe('useDynamicTitle — legacy shell (cliPanelStore)', () => {
  it('a failed run is announced as "(Failed) POF", not "(Done)"', () => {
    render(<Legacy />);
    const { id, seq } = startRun('a');
    expect(document.title).toBe('(Running) POF');
    act(() => store().endRun(id, seq, { success: false }));
    expect(document.title).toBe('(Failed) POF');
  });

  it('latch: an outcome that lands while hidden holds until the tab is seen, then lingers UI_TIMEOUTS.tabOutcomeLinger', () => {
    vi.useFakeTimers();
    render(<Legacy />);
    const { id, seq } = startRun('a');
    visibility = 'hidden';
    act(() => store().endRun(id, seq, { success: false }));
    act(() => { vi.advanceTimersByTime(UI_TIMEOUTS.tabOutcomeLinger * 10); });
    expect(document.title).toBe('(Failed) POF');

    act(() => setVisibility('visible'));
    expect(document.title).toBe('(Failed) POF');
    act(() => { vi.advanceTimersByTime(UI_TIMEOUTS.tabOutcomeLinger + 1); });
    expect(document.title).toBe('POF');
  });

  it('the favicon canvas is generated once per tone change, not once per store write', () => {
    render(<Legacy />);
    const create = vi.spyOn(document, 'createElement');
    const { id } = startRun('a');
    // Each write its own commit, as live stream activity arrives.
    for (let i = 0; i < 50; i++) act(() => store().updateLastActivity(id));
    const canvases = create.mock.calls.filter(([tag]) => tag === 'canvas').length;
    expect(canvases).toBe(1);
  });

  it('[guard] session-count and running strings are unchanged', () => {
    render(<Legacy />);
    expect(document.title).toBe('POF');
    act(() => { store().createSession(); store().createSession(); store().createSession(); });
    expect(document.title).toBe('(3 sessions) POF');
    act(() => useCLIPanelStore.setState({ sessions: {}, tabOrder: [] }));
    startRun('a');
    expect(document.title).toBe('(Running) POF');
    startRun('b');
    expect(document.title).toBe('(2 running) POF');
  });
});

describe('useDynamicTitle — lab shell (ActivitySummary)', () => {
  const lab = (phase: OneShotPhase): ActivitySummary => summarizeActivity({
    drain: { localDrain: null, lease: { held: false, scope: null, since: null, scopes: [] }, leaseProbe: 'ok' },
    oneShot: { phase, catalogId: 'spellbook', currentStepIndex: 0, totalSteps: 4, refinementTurns: 0 },
    forge: { activePolls: 0 },
  });

  it('idle -> idle leaves the document title untouched', () => {
    const { rerender } = render(<Lab summary={lab('idle')} />);
    rerender(<Lab summary={lab('idle')} />);
    expect(document.title).toBe('Original');
  });

  it('running-here -> failed reads "(Failed)" over the original title', () => {
    const { rerender } = render(<Lab summary={lab('running')} />);
    expect(document.title).toBe('(Running) Original');
    rerender(<Lab summary={lab('failed')} />);
    expect(document.title).toBe('(Failed) Original');
  });

  it('the always-mounted ActivityChip drives the lab tab', async () => {
    fetchDrainLease.mockResolvedValue({ held: false, scope: null, since: null, scopes: [] });
    useLabRunnerStore.setState({ localDrain: null });
    useOneShotJobStore.getState().reset();
    useForgeStore.setState({ activePolls: [] });
    useOneShotJobStore.setState({ phase: 'running', catalogId: 'spellbook', currentStepIndex: 0, totalSteps: 4 });

    render(<ActivityChip t={LIGHT} />);
    await waitFor(() => expect(document.title).toBe('(Running) Original'));
    act(() => useOneShotJobStore.setState({ phase: 'awaitingRun' }));
    expect(document.title).toBe('(Needs you) Original');
  });
});
