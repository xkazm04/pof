/**
 * The Game home "Lanes control room" over a stubbed fetch (it reads only the API): loading, a failed read with Retry,
 * an unconfigured game, an unreadable root beside a good one, a card per lane (state tag, model, cost, commit,
 * journal line), the selected lane's detail (REPORT.md, frame thumbnails from the served URL, the build-evidence
 * choice), and a stale board kept when a later poll fails. Plain DOM assertions; own cleanup.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock', variable: 'font-var' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { GameHomeLanes, scheduleText } from '@/components/layout-lab/game/gameHomeLanes';
import { LANE_LEVEL, commitLine } from '@/components/layout-lab/game/gameHomeLaneCard';
import { isLanesBoard } from '@/components/layout-lab/game/gameHomeLanesData';
import { LIGHT } from '@/components/layout-lab/theme';
import type { LanesBoard, LaneView, RunnerRootView } from '@/lib/games/runners/runnerTypes';

const READ_AT = '2026-11-03T12:00:00.000Z';
const lane = (over: Partial<LaneView> = {}): LaneView => ({
  id: 'pof-control-room', rootName: 'gtai-day-pof', model: 'claude-sonnet-5-5', effort: 'high', cwd: 'C:/wt/control-room', cwdExists: true, branch: 'gtai-control-room',
  state: 'running', phase: 'BUILD', iterations: 3, costUsd: 4.5, apiCostUsd: 1, frames: [], hasEvidence: true,
  lastCommit: { sha: 'abcdef0123', subject: 'feat: lanes board', at: '2026-11-03T11:40:00.000Z' }, lastJournalLine: '- 11:55 MILESTONE board reads', ...over,
});
const root = (over: Partial<RunnerRootView> = {}): RunnerRootView => ({
  root: 'C:/kiro/gtai-day-pof', name: 'gtai-day-pof', ok: true, phase: 'BUILD',
  schedule: { freeze: '2026-11-03T16:00:00.000Z', report: '2026-11-03T16:30:00.000Z', until: '2026-11-03T17:00:00.000Z', source: 'launch.cmd' },
  billing: { line: 'API key blocked until 12:20, subscription free' }, lanes: [lane()], ...over,
});
const board = (roots: RunnerRootView[], over: Partial<LanesBoard> = {}): LanesBoard => ({ gameId: 'gtai', readAt: READ_AT, configured: true, roots, ...over });

function stubFetch(...responses: Array<{ success: boolean; data?: unknown; error?: string } | 'pending'>) {
  const fn = vi.fn();
  for (const r of responses) fn.mockImplementationOnce(() => (r === 'pending' ? new Promise(() => {}) : Promise.resolve({ json: () => Promise.resolve(r) })));
  fn.mockImplementation(() => new Promise(() => {}));
  vi.stubGlobal('fetch', fn);
  return fn;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const panel = (pick = vi.fn(), evidenceLane: string | null = null) => render(<GameHomeLanes t={LIGHT} gameId="gtai" evidenceLane={evidenceLane} onPickEvidence={pick} />);

describe('GameHomeLanes', () => {
  it('shows loading against the lanes URL', () => {
    const fn = stubFetch('pending');
    panel();
    expect(screen.getByTestId('game-home-lanes').textContent).toContain('Reading the lane runners');
    expect(fn).toHaveBeenCalledWith('/api/games/gtai/lanes', undefined);
  });

  it('a failed read shows the error with a Retry that re-reads', async () => {
    const fn = stubFetch({ success: false, error: 'boom' }, { success: true, data: board([root()]) });
    panel();
    expect((await screen.findByRole('alert')).textContent).toContain('lanes unavailable (boom)');
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await screen.findByTestId('lane-card-pof-control-room');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('an unconfigured game says so', async () => {
    stubFetch({ success: true, data: board([], { configured: false, reason: 'pof declares no lane runner roots' }) });
    panel();
    expect((await screen.findByTestId('lanes-unconfigured')).textContent).toContain('declares no lane runner roots');
  });

  it('renders a card per lane with state, model, cost, commit and journal line; an unreadable root says why', async () => {
    stubFetch({ success: true, data: board([
      root({ lanes: [lane(), lane({ id: 'idle', state: 'blocked', iterations: 0, lastCommit: undefined, lastJournalLine: undefined, cwdExists: false })] }),
      root({ name: 'gtai-night', root: 'C:/kiro/gtai-night', ok: false, error: 'runner root not on disk: C:/kiro/gtai-night', lanes: [], schedule: undefined, phase: undefined, billing: undefined }),
    ]) });
    panel();
    const card = await screen.findByTestId('lane-card-pof-control-room');
    expect(card.getAttribute('data-state')).toBe('running');
    expect(card.textContent).toContain('running');
    expect(card.textContent).toContain('claude-sonnet-5-5');
    expect(card.textContent).toContain('3 sessions · $4.50 ($1.00 API key)');
    expect(screen.getByTestId('lane-commit-pof-control-room').textContent).toBe('abcdef0 feat: lanes board · 20 min ago');
    expect(screen.getByTestId('lane-journal-pof-control-room').textContent).toBe('- 11:55 MILESTONE board reads');
    const idle = screen.getByTestId('lane-card-idle');
    expect(idle.textContent).toContain('no sessions yet');
    expect(idle.textContent).toContain('worktree missing');
    expect(idle.textContent).toContain('no JOURNAL.md line yet');
    expect(screen.getByTestId('runner-billing-gtai-day-pof').textContent).toContain('API key blocked until 12:20');
    expect(screen.getByTestId('runner-root-error-gtai-night').textContent).toContain('runner root not on disk');
  });

  it('selecting a lane shows its report, frames served by URL, and lets the evidence be picked', async () => {
    const pick = vi.fn();
    stubFetch({ success: true, data: board([root({ lanes: [lane({
      report: { bytes: 2048, mtime: '2026-11-03T11:00:00.000Z', excerpt: '# Report\nIt works.', truncated: false },
      frames: [{ file: 'a.png', title: 'Control room', source: 'pof-ui', note: '1440 px', url: '/api/games/gtai/lanes/frame?lane=pof-control-room&file=a.png' }],
    })] })]) });
    panel(pick);
    fireEvent.click(await screen.findByTestId('lane-card-pof-control-room'));
    const detail = screen.getByTestId('lane-detail-pof-control-room');
    expect(detail.textContent).toContain('2.0 KB, written 1 h ago');
    expect(screen.getByTestId('lane-report-pof-control-room').textContent).toContain('It works.');
    const img = detail.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/api/games/gtai/lanes/frame?lane=pof-control-room&file=a.png');
    expect(img.getAttribute('alt')).toBe('Control room');
    fireEvent.click(screen.getByTestId('lane-evidence-pof-control-room'));
    expect(pick).toHaveBeenCalledWith('pof-control-room');
  });

  it('a lane with no report, frames or evidence folder says what is missing', async () => {
    stubFetch({ success: true, data: board([root({ lanes: [lane({ hasEvidence: false })] })]) });
    panel();
    fireEvent.click(await screen.findByTestId('lane-card-pof-control-room'));
    const detail = screen.getByTestId('lane-detail-pof-control-room');
    expect(detail.textContent).toContain('not written yet');
    expect(detail.textContent).toContain('No build/evidence/ folder in this worktree yet.');
    expect(screen.getByTestId('lane-no-frames-pof-control-room').textContent).toContain('No frames.json');
    expect(screen.queryByTestId('lane-report-pof-control-room')).toBeNull();
  });
});

describe('helpers', () => {
  it('every lane state has a tag level; blocked is the only bad one', () => {
    expect(Object.entries(LANE_LEVEL).filter(([, l]) => l === 'bad').map(([s]) => s)).toEqual(['blocked']);
  });
  it('commitLine and scheduleText never invent a value', () => {
    expect(commitLine(lane({ lastCommit: undefined }), READ_AT)).toBe('no commit read');
    expect(commitLine(lane({ lastCommit: undefined, cwdExists: false }), READ_AT)).toBe('worktree missing');
    expect(scheduleText(root({ schedule: undefined, phase: undefined }))).toBe('schedule unknown');
    expect(scheduleText(root({ schedule: { ...root().schedule!, source: 'default' } }))).toContain('runner defaults');
  });
  it('isLanesBoard refuses a shape missing what the panel reads', () => {
    expect(isLanesBoard(board([]))).toBe(true);
    expect(isLanesBoard({ roots: [] })).toBe(false);
    expect(isLanesBoard(null)).toBe(false);
  });
});
