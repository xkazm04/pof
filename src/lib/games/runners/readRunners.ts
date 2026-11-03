/**
 * Server-only (fs + git): the lanes control room's reader. It reads what `games/gtai/night/night.mjs status` reads
 * (night.json, `logs/<lane>/state.json`, billing.json, each lane's JOURNAL.md and git log) and reuses the
 * runner's own `lib.mjs` (`parseConfig`, `planTimes`, `phaseAt`) instead of shelling out to the CLI. Read-only:
 * it writes nothing, in any root. Never import into a client component; the wire shape is `runnerTypes.ts`.
 *
 * Every read is defensive: a root that is missing, a night.json that does not parse, a lane with no state.json
 * becomes an honest row with its reason, never a thrown error and never a fake zero.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getGame } from '@/lib/games/registry';
import type { GameId } from '@/lib/games/types';
// The runner's pure parsing, shared with night.mjs so the two cannot drift (`@/` is `src/`; the runner lives beside it).
import { parseConfig, phaseAt, planTimes } from '@/../games/gtai/night/lib.mjs';
import { countFailedSessions, deriveLaneState, lastJournalLine } from '@/lib/games/runners/laneState';
import { readFrames } from '@/lib/games/runners/frames';
import { runnersConfigFor, type RunnersConfig } from '@/lib/games/runners/runnersConfig';
import {
  REPORT_EXCERPT_CHARS,
  type LaneCommit, type LaneIteration, type LanePhase, type LaneReport, type LaneView, type LanesBoard,
  type RunnerBilling, type RunnerRootView, type RunnerSchedule,
} from '@/lib/games/runners/runnerTypes';

export interface ReadRunnersDeps {
  config?: RunnersConfig | null;
  /** Default `new Date()`. */
  now?: () => Date;
  /** Default: `git -C <cwd> <args>` (4 s ceiling); '' when it fails. */
  git?: (cwd: string, args: string[]) => string;
}

const defaultGit = (cwd: string, args: string[]): string => {
  try {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: 4000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
};

const readText = (f: string): string => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const readJson = <T,>(f: string): T | undefined => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) as T; } catch { return undefined; } };
const hhmm = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

/** `--until 18:00 --freeze 17:00 --report-at 17:30` from the root's launch.cmd; night.mjs defaults otherwise. */
/**
 * The root's schedule. `planTimes` always aims at the NEXT deadline, so a root that already reported for the one
 * before it (last night's, finished) would read as a fresh BUILD tomorrow: when any lane reported for the previous
 * deadline, the previous cycle is the one shown, and its phase at `now` is REPORT (deadline passed).
 */
export function scheduleOf(root: string, now: Date, reportedFor: readonly string[] = []): { schedule: RunnerSchedule; deadlines: string[]; phase: LanePhase } | undefined {
  const cmd = readText(path.join(root, 'launch.cmd'));
  const arg = (name: string) => cmd.match(new RegExp(`--${name}\\s+(\\d{1,2}:\\d{2})`))?.[1];
  const given = { until: arg('until'), freeze: arg('freeze'), reportAt: arg('report-at') };
  try {
    const args = { ...(given.until ? { until: given.until } : {}), ...(given.freeze ? { freeze: given.freeze } : {}), ...(given.reportAt ? { reportAt: given.reportAt } : {}) };
    const next = planTimes(args, now);
    const prev = new Date(next.until.getTime() - 24 * 3600_000).toISOString();
    const finished = reportedFor.includes(prev) && !reportedFor.includes(next.until.toISOString());
    const t = finished ? planTimes(args, new Date(Date.parse(prev) - 60_000)) : next;
    return {
      schedule: { freeze: t.freeze.toISOString(), report: t.report.toISOString(), until: t.until.toISOString(), source: given.until || given.freeze || given.reportAt ? 'launch.cmd' : 'default' },
      deadlines: [t.until.toISOString(), prev],
      phase: finished ? 'REPORT' : (phaseAt(now.getTime(), t).phase as LanePhase),
    };
  } catch { return undefined; }
}

interface BillingFile { blocked?: { api?: number; subscription?: number }; reasons?: { api?: string } }

export function billingOf(root: string, nowMs: number): (RunnerBilling & { allBlocked: boolean }) | undefined {
  const b = readJson<BillingFile>(path.join(root, 'billing.json'));
  if (!b?.blocked) return undefined;
  const api = Number(b.blocked.api ?? 0);
  const sub = Number(b.blocked.subscription ?? 0);
  const word = (name: string, ms: number) => (ms > nowMs ? `${name} blocked until ${hhmm(new Date(ms).toISOString())}` : `${name} free`);
  return {
    line: `${word('API key', api)}, ${word('subscription', sub)}`,
    allBlocked: api > nowMs && sub > nowMs,
    ...(api > nowMs ? { apiBlockedUntil: new Date(api).toISOString() } : {}),
    ...(sub > nowMs ? { subscriptionBlockedUntil: new Date(sub).toISOString() } : {}),
    ...(api > nowMs && b.reasons?.api ? { apiReason: b.reasons.api.slice(0, 160) } : {}),
  };
}

/** Seconds since the newest line of the newest session log, and that log's session number; undefined when there is none. */
function liveLog(logDir: string, nowMs: number): { ageS: number; n: number } | undefined {
  try {
    const files = fs.readdirSync(logDir).filter((f) => /^iter-\d+\.jsonl$/.test(f)).sort();
    const last = files.at(-1);
    if (!last) return undefined;
    return { ageS: Math.max(0, Math.round((nowMs - fs.statSync(path.join(logDir, last)).mtimeMs) / 1000)), n: Number(/\d+/.exec(last)![0]) };
  } catch { return undefined; }
}

/** When the lane's earliest `iter-NNN.jsonl` was created (ISO): the start of this run for that lane. */
export function runStartOf(logDir: string): string | undefined {
  try {
    const first = fs.readdirSync(logDir).filter((f) => /^iter-\d+\.jsonl$/.test(f)).sort()[0];
    if (!first) return undefined;
    const st = fs.statSync(path.join(logDir, first));
    return new Date(st.birthtimeMs > 0 ? Math.min(st.birthtimeMs, st.mtimeMs) : st.mtimeMs).toISOString();
  } catch { return undefined; }
}

/** Commits on HEAD made at or after `sinceIso`; undefined when git could not answer (an empty answer is a real 0 only when git ran). */
export function commitsSince(git: NonNullable<ReadRunnersDeps['git']>, cwd: string, sinceIso: string): number | undefined {
  if (!git(cwd, ['rev-parse', 'HEAD'])) return undefined;
  const out = git(cwd, ['log', `--since=${sinceIso}`, '--format=%H']);
  return out ? out.split('\n').filter(Boolean).length : 0;
}

interface StateFile { iterations?: Array<Partial<LaneIteration> & { costUsd?: number }>; reportedFor?: string }

function reportOf(cwd: string): LaneReport | undefined {
  const f = path.join(cwd, 'REPORT.md');
  try {
    const st = fs.statSync(f);
    const text = fs.readFileSync(f, 'utf8');
    return { bytes: st.size, mtime: st.mtime.toISOString(), excerpt: text.slice(0, REPORT_EXCERPT_CHARS), truncated: text.length > REPORT_EXCERPT_CHARS };
  } catch { return undefined; }
}

function commitOf(git: NonNullable<ReadRunnersDeps['git']>, cwd: string): LaneCommit | undefined {
  const out = git(cwd, ['log', '-1', '--format=%H%x1f%s%x1f%cI']);
  const [sha, subject, at] = out.split('\x1f');
  return sha && at ? { sha, subject: subject ?? '', at } : undefined;
}

interface RootCtx { name: string; nowMs: number; masters?: string; gameId: string; git: NonNullable<ReadRunnersDeps['git']>; sched: ReturnType<typeof scheduleOf>; billing: ReturnType<typeof billingOf> }
type CfgLane = ReturnType<typeof parseConfig>['lanes'][number];

function laneOf(root: string, l: CfgLane, c: RootCtx): LaneView {
  const st = readJson<StateFile>(path.join(root, 'logs', l.id, 'state.json')) ?? {};
  const its = st.iterations ?? [];
  const last = its.at(-1);
  const cwdExists = fs.existsSync(l.cwd);
  const lastIteration: LaneIteration | undefined = last && {
    n: Number(last.n ?? its.length), phase: String(last.phase ?? ''), billing: String(last.billing ?? ''), code: typeof last.code === 'number' ? last.code : null,
    timedOut: last.timedOut === true, limited: last.limited === true, drained: last.drained === true, wallS: Number(last.wallS ?? 0), start: String(last.start ?? ''),
  };
  const apiCostUsd = its.filter((i) => i.billing === 'api').reduce((s, i) => s + (i.costUsd ?? 0), 0);
  const log = liveLog(path.join(root, 'logs', l.id), c.nowMs);
  const age = log?.ageS;
  const { state, note } = deriveLaneState({
    cwdExists, iterations: its.length, ...(st.reportedFor ? { reportedFor: st.reportedFor } : {}), deadlines: c.sched?.deadlines ?? [],
    ...(c.sched ? { phase: c.sched.phase } : {}), ...(age !== undefined ? { liveAgeS: age } : {}),
    ...(lastIteration ? { lastIteration } : {}), billingBlocked: c.billing?.allBlocked === true, nowMs: c.nowMs,
    ...(lastIteration?.start ? { lastStartMs: Date.parse(lastIteration.start) } : {}),
  });
  const commit = cwdExists ? commitOf(c.git, l.cwd) : undefined;
  const runStart = runStartOf(path.join(root, 'logs', l.id));
  const commitsThisRun = cwdExists && runStart ? commitsSince(c.git, l.cwd, runStart) : undefined;
  const branch = cwdExists ? c.git(l.cwd, ['rev-parse', '--abbrev-ref', 'HEAD']) : '';
  const journal = lastJournalLine(readText(path.join(l.cwd, 'JOURNAL.md')));
  const report = cwdExists ? reportOf(l.cwd) : undefined;
  return {
    id: l.id, rootName: c.name, model: l.model ?? 'runner default', ...(l.effort ? { effort: l.effort } : {}), cwd: l.cwd, cwdExists,
    ...(branch ? { branch } : {}), state, ...(note ? { stateNote: note } : {}), ...(c.sched ? { phase: c.sched.phase } : {}),
    iterations: its.length, failedSessions: countFailedSessions(its), ...(state === 'running' && log ? { liveSession: log.n } : {}), ...(runStart ? { runStart } : {}), ...(commitsThisRun !== undefined ? { commitsThisRun } : {}), costUsd: its.reduce((s, i) => s + (i.costUsd ?? 0), 0), apiCostUsd,
    ...(lastIteration ? { lastIteration } : {}), ...(commit ? { lastCommit: commit } : {}), ...(journal ? { lastJournalLine: journal } : {}),
    ...(report ? { report } : {}),
    frames: readFrames(c.masters, l.id, (file) => `/api/games/${c.gameId}/lanes/frame?lane=${encodeURIComponent(l.id)}&file=${encodeURIComponent(file)}`),
    hasEvidence: cwdExists && fs.existsSync(path.join(l.cwd, 'build', 'evidence')),
  };
}

export function readRunnerRoot(root: string, gameId: string, masters: string | undefined, deps: ReadRunnersDeps = {}): RunnerRootView {
  const now = (deps.now ?? (() => new Date()))();
  const name = path.basename(root);
  const bad = (error: string): RunnerRootView => ({ root, name, ok: false, error, lanes: [] });
  if (!fs.existsSync(root)) return bad(`runner root not on disk: ${root}`);
  const configFile = path.join(root, 'night.json');
  if (!fs.existsSync(configFile)) return bad('no night.json in this root');
  const cfg = parseConfig(readText(configFile), root);
  if (cfg.errors.length) return bad(`night.json is invalid: ${cfg.errors[0]}`);
  const reported = cfg.lanes.map((l: CfgLane) => readJson<StateFile>(path.join(root, 'logs', l.id, 'state.json'))?.reportedFor).filter((x: string | undefined): x is string => !!x);
  const sched = scheduleOf(root, now, reported);
  const billing = billingOf(root, now.getTime());
  const ctx: RootCtx = { name, nowMs: now.getTime(), ...(masters ? { masters } : {}), gameId, git: deps.git ?? defaultGit, sched, billing };
  return {
    root, name, ok: true, ...(sched ? { schedule: sched.schedule, phase: sched.phase } : {}),
    ...(billing ? { billing: { line: billing.line, ...(billing.apiBlockedUntil ? { apiBlockedUntil: billing.apiBlockedUntil } : {}), ...(billing.subscriptionBlockedUntil ? { subscriptionBlockedUntil: billing.subscriptionBlockedUntil } : {}), ...(billing.apiReason ? { apiReason: billing.apiReason } : {}) } } : {}),
    lanes: cfg.lanes.map((l: CfgLane) => laneOf(root, l, ctx)),
  };
}

export function readLanesBoard(gameId: GameId, deps: ReadRunnersDeps = {}): LanesBoard {
  const readAt = (deps.now ?? (() => new Date()))().toISOString();
  getGame(gameId);
  const cfg = deps.config === undefined ? runnersConfigFor(gameId) : deps.config;
  if (!cfg || cfg.roots.length === 0) return { gameId, readAt, configured: false, reason: `${gameId} declares no lane runner roots (GameDef.runners, or POF_GAME_RUNNER_ROOTS_${gameId.toUpperCase()})`, roots: [] };
  return { gameId, readAt, configured: true, ...(cfg.masters ? { masters: cfg.masters } : {}), roots: cfg.roots.map((r) => readRunnerRoot(r, gameId, cfg.masters, deps)) };
}

/** A lane's worktree by id across the configured roots, or undefined. Used to pick a lane's build evidence. */
export function laneCwd(board: LanesBoard, laneId: string): string | undefined {
  return board.roots.flatMap((r) => r.lanes).find((l) => l.id === laneId && l.cwdExists)?.cwd;
}
