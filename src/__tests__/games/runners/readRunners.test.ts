import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readLanesBoard, readRunnerRoot, laneCwd } from '@/lib/games/runners/readRunners';
import { runnersConfigFor } from '@/lib/games/runners/runnersConfig';
import { countFailedSessions, deriveLaneState, lastJournalLine } from '@/lib/games/runners/laneState';
import { costText } from '@/lib/games/runners/runnerTypes';

const NOW = new Date('2026-11-03T12:00:00');
const DEADLINE = new Date('2026-11-03T18:00:00').toISOString();
const git = (_cwd: string, args: string[]) => (args[0] === 'log' ? 'abc1234deadbeef\x1ffeat: the thing\x1f2026-11-03T11:50:00+01:00' : 'lane-branch');

let tmp: string;
const w = (rel: string, body: string) => {
  const f = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, body);
  return f;
};
const it0 = (over: Record<string, unknown> = {}) => ({ n: 1, code: 0, timedOut: false, wallS: 100, billing: 'subscription', costUsd: 1.5, phase: 'BUILD', start: '2026-11-03T10:00:00.000Z', limited: false, drained: false, ...over });

function fixture() {
  const root = path.join(tmp, 'runner');
  const cwdA = path.join(tmp, 'wt-a');
  const cwdB = path.join(tmp, 'wt-b');
  w('runner/night.json', JSON.stringify({ common: 'briefs/common.md', lanes: [
    { id: 'lane-a', cwd: cwdA, brief: 'briefs/a.md', model: 'claude-opus-5-5' },
    { id: 'lane-b', cwd: cwdB, brief: 'briefs/b.md' },
    { id: 'lane-c', cwd: path.join(tmp, 'wt-missing'), brief: 'briefs/c.md' },
  ] }));
  w('runner/launch.cmd', 'bash supervisor.sh --root X --until 18:00 --freeze 17:00 --report-at 17:30');
  w('runner/billing.json', JSON.stringify({ blocked: { api: NOW.getTime() + 3600_000, subscription: 0 }, reasons: { api: 'credit balance is too low' } }));
  w('runner/logs/lane-a/state.json', JSON.stringify({ lane: 'lane-a', iterations: [it0({ billing: 'api', costUsd: 2 }), it0({ n: 2, costUsd: 1.25 })] }));
  const live = w('runner/logs/lane-a/iter-002.jsonl', '{}');
  fs.utimesSync(live, NOW, NOW);
  w('runner/logs/lane-b/state.json', JSON.stringify({ lane: 'lane-b', reportedFor: DEADLINE, iterations: [it0()] }));
  w('wt-a/JOURNAL.md', '# journal\n\n- 10:00 MILESTONE one\n- 11:55 NEXT: the next thing\n\n');
  w('wt-a/REPORT.md', 'x'.repeat(7000));
  fs.mkdirSync(path.join(cwdA, 'build', 'evidence'), { recursive: true });
  fs.mkdirSync(cwdB, { recursive: true });
  return { root, cwdA };
}

beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-runners-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe('readRunnerRoot', () => {
  it('reads lanes, state, cost, commit, journal, report and evidence from files', () => {
    const { root } = fixture();
    // the fixture marks the live log "now"; the reader's clock is NOW, so the age is 0
    const v = readRunnerRoot(root, 'gtai', undefined, { now: () => NOW, git });
    expect(v.ok).toBe(true);
    expect(v.phase).toBe('BUILD');
    expect(v.schedule).toMatchObject({ source: 'launch.cmd', until: DEADLINE });
    expect(v.billing?.line).toMatch(/^API key blocked until \d\d:\d\d, subscription free$/);
    expect(v.billing?.apiReason).toContain('credit balance');
    const [a, b, c] = v.lanes;
    expect(a).toMatchObject({ id: 'lane-a', model: 'claude-opus-5-5', state: 'running', liveSession: 2, iterations: 2, failedSessions: 0, costUsd: 3.25, apiCostUsd: 2, branch: 'lane-branch', hasEvidence: true });
    expect(a.lastCommit).toEqual({ sha: 'abc1234deadbeef', subject: 'feat: the thing', at: '2026-11-03T11:50:00+01:00' });
    expect(a.lastJournalLine).toBe('- 11:55 NEXT: the next thing');
    expect(a.report).toMatchObject({ bytes: 7000, truncated: true });
    expect(a.report?.excerpt).toHaveLength(6000);
    expect(b).toMatchObject({ id: 'lane-b', state: 'done', model: 'runner default', hasEvidence: false });
    expect(c).toMatchObject({ id: 'lane-c', state: 'pending', cwdExists: false, iterations: 0 });
    expect(c.report).toBeUndefined();
    expect(c.lastCommit).toBeUndefined();
  });

  it('is blocked when every billing path is, and not running when the log is old', () => {
    const { root } = fixture();
    w('runner/billing.json', JSON.stringify({ blocked: { api: NOW.getTime() + 1e6, subscription: NOW.getTime() + 1e6 } }));
    const old = new Date(NOW.getTime() - 3600_000);
    fs.utimesSync(path.join(root, 'logs/lane-a/iter-002.jsonl'), old, old);
    const v = readRunnerRoot(root, 'gtai', undefined, { now: () => NOW, git });
    expect(v.lanes[0].state).toBe('blocked');
    expect(v.lanes[0].liveSession).toBeUndefined();
    expect(v.billing?.line).toContain('subscription blocked until');
  });

  it('reports an unreadable root, a missing night.json and an invalid one as honest rows', () => {
    expect(readRunnerRoot(path.join(tmp, 'nope'), 'gtai', undefined, { now: () => NOW })).toMatchObject({ ok: false, lanes: [], error: expect.stringContaining('not on disk') });
    fs.mkdirSync(path.join(tmp, 'empty'));
    expect(readRunnerRoot(path.join(tmp, 'empty'), 'gtai', undefined, { now: () => NOW }).error).toBe('no night.json in this root');
    w('bad/night.json', JSON.stringify({ lanes: [{ id: 'X Y' }] }));
    expect(readRunnerRoot(path.join(tmp, 'bad'), 'gtai', undefined, { now: () => NOW }).error).toContain('night.json is invalid');
  });

  it('a root that reported for the previous deadline is a finished cycle, not a fresh BUILD for the next day', () => {
    const { root } = fixture();
    const yesterday = new Date('2026-11-02T18:00:00').toISOString();
    for (const id of ['lane-a', 'lane-b']) w(`runner/logs/${id}/state.json`, JSON.stringify({ lane: id, reportedFor: yesterday, iterations: [it0()] }));
    const v = readRunnerRoot(root, 'gtai', undefined, { now: () => NOW, git });
    expect(v.phase).toBe('REPORT');
    expect(v.schedule?.until).toBe(yesterday);
    expect(v.lanes.find((l) => l.id === 'lane-a')?.state).toBe('done');
  });

  it('falls back to the runner defaults without a launch.cmd, and says so', () => {
    const { root } = fixture();
    fs.rmSync(path.join(root, 'launch.cmd'));
    expect(readRunnerRoot(root, 'gtai', undefined, { now: () => NOW, git }).schedule?.source).toBe('default');
  });

  it("counts a lane's own commits since its first session log; 0 means the tip is still the base", () => {
    const { root } = fixture();
    const seen: string[][] = [];
    const counting = (_cwd: string, args: string[]) => {
      if (args[0] === 'log' && args[1].startsWith('--since=')) { seen.push(args); return ['aaa', 'bbb', 'ccc'].join('\n'); }
      return git(_cwd, args);
    };
    const v = readRunnerRoot(root, 'gtai', undefined, { now: () => NOW, git: counting });
    const [a, b, c] = v.lanes;
    expect(a.commitsThisRun).toBe(3);
    expect(a.runStart).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(seen[0][1]).toBe(`--since=${a.runStart}`);
    // lane-b has no session log, lane-c no worktree: unknown, never a fake 0
    expect(b.commitsThisRun).toBeUndefined();
    expect(c.commitsThisRun).toBeUndefined();
    const none = (_cwd: string, args: string[]) => (args[0] === 'log' && args[1].startsWith('--since=') ? '' : git(_cwd, args));
    expect(readRunnerRoot(root, 'gtai', undefined, { now: () => NOW, git: none }).lanes[0].commitsThisRun).toBe(0);
    // git unavailable: unknown
    expect(readRunnerRoot(root, 'gtai', undefined, { now: () => NOW, git: () => '' }).lanes[0].commitsThisRun).toBeUndefined();
  });

  it('serves frames only from frames.json under masters', () => {
    const { root } = fixture();
    const masters = path.join(tmp, 'masters');
    w('masters/day-d5/lane-a/shot.png', 'png');
    w('masters/day-d5/lane-a/frames.json', JSON.stringify([
      { file: 'shot.png', title: 'Shot', source: 'pof-ui', note: 'n' },
      { file: '../secret.png', title: 'climb' },
      { file: 'missing.png', title: 'gone' },
      { file: 'notes.txt', title: 'not an image' },
    ]));
    const lanes = readRunnerRoot(root, 'gtai', masters, { now: () => NOW, git }).lanes;
    expect(lanes[0].frames).toEqual([{ file: 'shot.png', title: 'Shot', source: 'pof-ui', note: 'n', url: '/api/games/gtai/lanes/frame?lane=lane-a&file=shot.png' }]);
    expect(lanes[1].frames).toEqual([]);
  });
});

describe('readLanesBoard / config', () => {
  it('an undeclared game is configured:false with a reason; a configured one lists every root', () => {
    expect(readLanesBoard('pof', { now: () => NOW })).toMatchObject({ configured: false, roots: [], reason: expect.stringContaining('declares no lane runner roots') });
    const { root } = fixture();
    const board = readLanesBoard('gtai', { now: () => NOW, git, config: { roots: [root, path.join(tmp, 'gone')] } });
    expect(board.configured).toBe(true);
    expect(board.roots.map((r) => r.ok)).toEqual([true, false]);
    expect(laneCwd(board, 'lane-a')).toBe(path.join(tmp, 'wt-a'));
    expect(laneCwd(board, 'lane-c')).toBeUndefined();
    expect(laneCwd(board, 'nope')).toBeUndefined();
  });

  it('roots come from the manifest, relative to the repo root, and env overrides win', () => {
    const base = path.join(tmp, 'repo');
    const manifest = runnersConfigFor('gtai', { env: {}, repoRoot: base, exists: () => true });
    expect(manifest?.roots.map((r) => path.basename(r))).toEqual(['gtai-night', 'gtai-night-noir', 'gtai-day-d5', 'gtai-day-pof', 'gtai-eve']);
    expect(manifest?.roots[0]).toBe(path.resolve(base, '../gtai-night'));
    expect(path.basename(manifest?.masters ?? '')).toBe('gtai-masters');
    const env = { POF_GAME_RUNNER_ROOTS_GTAI: `${tmp}/a; ${tmp}/b`, POF_GAME_MASTERS_GTAI: `${tmp}/m` };
    const over = runnersConfigFor('gtai', { env, repoRoot: base, exists: () => false });
    expect(over?.roots).toEqual([path.resolve(tmp, 'a'), path.resolve(tmp, 'b')]);
    expect(over?.masters).toBeUndefined();
    expect(runnersConfigFor('pof', { env: {}, repoRoot: base })).toBeNull();
  });
});

describe('pure helpers', () => {
  const base = { cwdExists: true, iterations: 1, deadlines: [DEADLINE], billingBlocked: false, nowMs: NOW.getTime() };
  it('derives each state in priority order', () => {
    expect(deriveLaneState({ ...base, cwdExists: false }).state).toBe('pending');
    expect(deriveLaneState({ ...base, reportedFor: DEADLINE, liveAgeS: 1 }).state).toBe('done');
    expect(deriveLaneState({ ...base, reportedFor: 'last night', liveAgeS: 1, phase: 'BUILD' }).state).toBe('running');
    expect(deriveLaneState({ ...base, billingBlocked: true }).state).toBe('blocked');
    expect(deriveLaneState({ ...base, lastIteration: { limited: true, drained: false, timedOut: false, code: 1 } }).state).toBe('blocked');
    expect(deriveLaneState({ ...base, iterations: 0 }).state).toBe('pending');
    expect(deriveLaneState({ ...base, phase: 'BUILD' }).state).toBe('building');
    expect(deriveLaneState({ ...base, phase: 'STABILIZE' }).state).toBe('freeze');
    expect(deriveLaneState({ ...base, phase: 'REPORT' }).state).toBe('report');
    expect(deriveLaneState({ ...base, phase: 'BUILD', liveAgeS: 301 }).state).toBe('building');
    expect(deriveLaneState({ ...base, phase: 'BUILD', lastStartMs: NOW.getTime() - 5 * 3600_000 }).note).toContain('may be down');
  });
  it('counts a failed session by exit code or usage limit; a cap stop and an unknown exit are not failures', () => {
    expect(countFailedSessions([
      { code: 0 }, { code: 1 }, { code: 1, timedOut: true }, { code: null }, { code: 0, limited: true }, {},
    ])).toBe(2);
    expect(countFailedSessions([])).toBe(0);
  });
  it('journal line + cost words never read a missing run as free', () => {
    expect(lastJournalLine('a\n\nb  \n\n')).toBe('b');
    expect(lastJournalLine('\n\n')).toBeUndefined();
    expect(lastJournalLine('x'.repeat(400))).toHaveLength(300);
    expect(costText(0, 0, 0)).toBe('no sessions yet');
    expect(costText(3.256, 1, 2)).toBe('$3.26 ($1.00 API key)');
  });
});
