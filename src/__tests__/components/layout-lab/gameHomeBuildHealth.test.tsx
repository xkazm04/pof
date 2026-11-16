/**
 * F-10: the Game home "Build health" panel's render states over a stubbed fetch (it reads only the
 * API, never fs): loading, a failed read with Retry, unbound with its reason, bound rows with a
 * colorblind-safe tag per state and the evidence age, the bench metrics against STANDARDS §20, and
 * the all-absent empty note. Plain DOM assertions (no jest-dom), own cleanup.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock', variable: 'font-var' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { GameHomeBuildHealth, aggregateText } from '@/components/layout-lab/game/gameHomeBuildHealth';
import { LIGHT } from '@/components/layout-lab/theme';
import type { BuildHealth, BuildHealthRow } from '@/lib/games/godot/buildHealthTypes';
import { aggregateOf } from '@/lib/games/godot/buildHealthTypes';
import { GODOT_EVIDENCE_KINDS } from '@/lib/games/godot/evidenceTypes';

const HEAD = 'c'.repeat(40);
const absent = (kind: BuildHealthRow['kind']): BuildHealthRow => ({ kind, status: 'deferred', state: 'absent', detail: `${kind}: no evidence yet`, reason: 'no evidence yet: x' });

function bound(rows: BuildHealthRow[]): BuildHealth {
  const all = GODOT_EVIDENCE_KINDS.map((k) => rows.find((r) => r.kind === k) ?? absent(k));
  return { gameId: 'gtai', engine: 'godot', binding: 'bound', root: 'C:/kiro/gtai', head: HEAD, readAt: '2026-11-02T12:00:00.000Z', rows: all, aggregate: aggregateOf(all, true) };
}

function stubFetch(...responses: Array<{ success: boolean; data?: unknown; error?: string } | 'pending'>) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockImplementationOnce(() => (r === 'pending' ? new Promise(() => {}) : Promise.resolve({ json: () => Promise.resolve(r) })));
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const panel = () => render(<GameHomeBuildHealth t={LIGHT} gameId="gtai" />);

describe('GameHomeBuildHealth', () => {
  it('shows loading while the read is in flight, against the API URL', () => {
    const fn = stubFetch('pending');
    panel();
    expect(screen.getByTestId('game-home-build-health').textContent).toContain('Reading build evidence');
    expect(fn).toHaveBeenCalledWith('/api/games/gtai/build-health', undefined);
  });

  it('a failed read shows the error with a Retry that re-reads', async () => {
    const fn = stubFetch({ success: false, error: 'boom' }, { success: true, data: bound([]) });
    panel();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('build health unavailable (boom)');
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await screen.findByTestId('build-health-aggregate');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('an unbound game says unbound and why, not an error', async () => {
    stubFetch({ success: true, data: { ...bound([]), binding: 'unbound', reason: 'no game root for gtai (Godot 4.7.2): POF_GAME_ROOT_GTAI is unset', root: null, head: null, rows: [], aggregate: aggregateOf([], false) } });
    panel();
    const el = await screen.findByTestId('build-health-unbound');
    expect(el.textContent).toContain('unbound');
    expect(el.textContent).toContain('POF_GAME_ROOT_GTAI is unset');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders one row per kind with its state tag, age and commit, plus the bench budgets', async () => {
    stubFetch({ success: true, data: bound([
      { kind: 'lint', status: 'pass', state: 'pass', detail: 'lint: clean at ccccccc', builtAt: '2026-11-02T11:00:00.000Z', commit: HEAD },
      { kind: 'unit-tests', status: 'fail', state: 'fail', detail: 'unit-tests: 2 failing', reason: 'unit-tests failed at ccccccc', commit: HEAD },
      { kind: 'parity', status: 'deferred', state: 'stale', detail: 'parity: stale evidence', reason: 'stale: evidence from ddddddd, HEAD ccccccc', commit: 'd'.repeat(40) },
      { kind: 'bench', status: 'pass', state: 'pass', detail: 'bench: ok', commit: HEAD, metrics: { p99CpuMs: 3, low1Fps: 30, worstSwapMs: 51 } },
    ]) });
    panel();
    await screen.findByTestId('build-health-aggregate');
    expect(screen.getByTestId('build-health-aggregate').textContent).toBe('2 pass · 1 fail · 1 stale · 4 absent');
    const lint = screen.getByTestId('build-health-row-lint');
    expect(lint.getAttribute('data-state')).toBe('pass');
    expect(lint.textContent).toContain('built 1 h ago');
    expect(lint.querySelector('[data-status="ok"]')?.textContent?.toLowerCase()).toContain('pass');
    expect(screen.getByTestId('build-health-row-unit-tests').querySelector('[data-status="bad"]')).not.toBeNull();
    const parity = screen.getByTestId('build-health-row-parity');
    expect(parity.querySelector('[data-status="warn"]')?.textContent?.toLowerCase()).toContain('stale');
    expect(parity.textContent).toContain('stale: evidence from ddddddd');
    expect(screen.getByTestId('build-health-row-selftest').getAttribute('data-state')).toBe('absent');
    expect(screen.getByTestId('build-health-metric-p99CpuMs').getAttribute('data-verdict')).toBe('within');
    expect(screen.getByTestId('build-health-metric-low1Fps').getAttribute('data-verdict')).toBe('over');
    expect(screen.getByTestId('build-health-metric-worstSwapMs').getAttribute('data-verdict')).toBe('over');
    expect(screen.getByTestId('build-health-metric-worstFrameMs').getAttribute('data-verdict')).toBe('missing');
    expect(screen.getByTestId('game-home-build-health').textContent).toContain('HEAD ccccccc');
    expect(screen.queryByTestId('build-health-empty')).toBeNull();
  });

  it('every kind absent shows the empty note and no bench block', async () => {
    stubFetch({ success: true, data: bound([]) });
    panel();
    await screen.findByTestId('build-health-empty');
    expect(screen.queryByTestId('build-health-bench')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('build-health-aggregate').textContent).toBe('8 absent'));
  });

  it('aggregateText drops zero buckets', () => {
    expect(aggregateText({ status: 'pass', total: 0, pass: 0, fail: 0, stale: 0, absent: 0, deferred: 0 })).toBe('no evidence kinds');
  });
});
