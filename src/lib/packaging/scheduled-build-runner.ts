// Server-only: the unattended build orchestrator behind scheduled nightly
// builds. `runScheduledBuild` runs the full chain — skip-if-unchanged → fast
// pre-flight → cook → smoke (Win64) → finalize (size-budget + version + record) — with every
// side-effect injected so it is unit-testable without spawning anything.
//
// `tickScheduler` / `startScheduledRun` wire the real implementations in and
// run the chain as a `nightly` COOK JOB (`cook-jobs.ts`): the same per-project lock
// the interactive Package button takes, so an interactive cook and a nightly cook of
// one project can never run UAT at once, and the Packaging console can attach to a
// running nightly. They are driven by the API route and the instrumentation cron.

import path from 'node:path';
import { stat, readdir } from 'node:fs/promises';
import type { BuildProfile } from './build-profiles';
import { getProfiles, getProfile } from './build-profiles-db';
import type { PreflightStatus, PreflightCheckResult } from './preflight';
import { runFastPreflight } from './preflight-runner';
import { cookExecutor, type CookEvent } from './cook-executor';
import { runSmokeTest, deriveGameImage, smokeResultNote, type SmokeTestResult, type SmokeTestStatus } from './smoke-test';
import { evaluateBuildSize } from './size-budgets';
import { insertBuild, lastGreenBaseline } from './build-history-store';
import { autoIncrementOnSuccess } from './version-manager';
import { finalizeCook, type FinalizeDeps } from './finalize-build';
import { getGitHead } from './git-head';
import { shouldSkipUnchanged, isDueAt, type BuildSchedule } from './build-scheduler';
import {
  getSchedule, getScheduleState, setScheduleState, isRunning,
  type ScheduleOutcome,
} from './build-schedule-store';
import { runCookJob, type CookJobEvent } from './cook-jobs';
import { logger } from '@/lib/logger';

const SCHED_NOTE = '[NIGHTLY]';

export interface ScheduledRunContext {
  profile: BuildProfile;
  projectPath: string;
  projectName: string;
  ueVersion: string;
  /** git HEAD baseline from the last scheduled build. */
  lastBuiltCommit: string | null;
  skipIfUnchanged: boolean;
}

export interface CookOutcome {
  /** 'cancelled' = the job was cancelled (the tree was killed); recorded as cancelled. */
  status: 'success' | 'failed' | 'cancelled';
  exePath: string;
  durationMs: number;
  sizeBytes: number;
  message?: string;
}

/**
 * Orchestration deps plus the {@link FinalizeDeps} every build_history write goes
 * through — the same finalizer the interactive cook route uses, so the baseline
 * record, the project scope and the bump-per-green-cook version rule cannot drift.
 */
export interface ScheduledRunDeps extends FinalizeDeps {
  getHead: (projectPath: string) => Promise<string | null>;
  runPreflight: (ctx: ScheduledRunContext) => Promise<{ overall: PreflightStatus; results: PreflightCheckResult[] }>;
  runCook: (ctx: ScheduledRunContext) => Promise<CookOutcome>;
  measureSize: (exePath: string) => Promise<number | null>;
  runSmoke: (ctx: ScheduledRunContext, exePath: string) => Promise<SmokeTestResult>;
  now: () => number;
}

export interface ScheduledRunResult {
  status: ScheduleOutcome;
  reason: string;
  commit: string | null;
  buildId: number | null;
  durationMs: number;
  preflight: PreflightStatus | null;
  smoke: SmokeTestStatus | null;
  sizeRegression: string | null;
}

/** Run the full unattended build chain. Pure orchestration over injected deps. */
export async function runScheduledBuild(
  ctx: ScheduledRunContext,
  deps: ScheduledRunDeps,
): Promise<ScheduledRunResult> {
  const start = deps.now();
  const { platform, config } = ctx.profile;
  const elapsed = () => deps.now() - start;

  // 1. Skip-if-unchanged gate.
  const head = await deps.getHead(ctx.projectPath);
  const skip = shouldSkipUnchanged(head, ctx.lastBuiltCommit, ctx.skipIfUnchanged);
  if (skip.skip) {
    return base('skipped', skip.reason, head, null, elapsed(), null, null, null);
  }

  // 2. Fast pre-flight gate (a failing config/audit blocks the cook).
  const pre = await deps.runPreflight(ctx);
  if (pre.overall === 'fail') {
    const issues = pre.results.filter((r) => r.status === 'fail').flatMap((r) => r.issues);
    const reason = `Pre-flight failed: ${issues.slice(0, 5).join('; ') || 'see pre-flight checks'}`;
    const rec = finalizeCook(
      { kind: 'error', status: 'failed', message: reason, durationMs: elapsed() },
      { projectPath: ctx.projectPath, platform, config, notes: [`${SCHED_NOTE} ${skip.reason}`] },
      deps,
    );
    return base('failed', reason, head, rec.buildId, elapsed(), 'fail', null, null);
  }

  // 3. Cook.
  const cook = await deps.runCook(ctx);
  if (cook.status !== 'success') {
    const reason = cook.message ?? `cook ${cook.status}`;
    const rec = finalizeCook(
      { kind: 'error', status: cook.status, message: reason, durationMs: cook.durationMs || elapsed(), cookTimeMs: cook.durationMs },
      { projectPath: ctx.projectPath, platform, config, notes: [`${SCHED_NOTE} ${skip.reason}`] },
      deps,
    );
    return base('failed', reason, head, rec.buildId, elapsed(), pre.overall, null, null);
  }

  // 4. Size measurement (best-effort — cook-executor does not measure).
  let sizeBytes: number | null = cook.sizeBytes > 0 ? cook.sizeBytes : null;
  if (cook.exePath) {
    const measured = await deps.measureSize(cook.exePath);
    if (measured != null && measured > 0) sizeBytes = measured;
  }

  // 5. Smoke-test (runnable Win64 builds only).
  let smoke: SmokeTestResult | null = null;
  if (platform === 'Win64' && cook.exePath) {
    smoke = await deps.runSmoke(ctx, cook.exePath);
  }

  // 6-7. Finalize through the shared finalizer: baseline RECORD of THIS project
  // captured before the insert (an unscoped baseline fabricates or masks a growth
  // regression; a bare number cannot name its build), a failed smoke flips the
  // unattended gate to failed, and only a recorded-green build is versioned.
  const smokeFailed = smoke !== null && smoke.status === 'fail';
  const fin = finalizeCook(
    { kind: 'done', exePath: cook.exePath, sizeBytes, durationMs: cook.durationMs || elapsed(), cookTimeMs: cook.durationMs },
    {
      projectPath: ctx.projectPath, platform, config,
      smoke: smoke ? { failed: smokeFailed, note: smokeResultNote(smoke) } : null,
      notes: [SCHED_NOTE, skip.reason],
    },
    deps,
  );
  const sizeReg = fin.regression;

  const status: ScheduleOutcome = smokeFailed ? 'failed' : 'success';
  const reason = smokeFailed && smoke
    ? smokeResultNote(smoke)
    : `Built green${sizeReg ? ' (size regression noted)' : ''}`;
  return base(status, reason, head, fin.buildId, elapsed(), pre.overall, smoke?.status ?? null, sizeReg?.note ?? null);
}

function base(
  status: ScheduleOutcome, reason: string, commit: string | null, buildId: number | null,
  durationMs: number, preflight: PreflightStatus | null, smoke: SmokeTestStatus | null,
  sizeRegression: string | null,
): ScheduledRunResult {
  return { status, reason, commit, buildId, durationMs, preflight, smoke, sizeRegression };
}

// ── Default (real) dependency wiring ─────────────────────────────────────────

/**
 * Run the cook, forwarding every event to `emit` (the nightly job's console) and
 * honouring the job's cancel `signal`. A cancel before the cook starts never spawns.
 */
async function runCookStreaming(
  ctx: ScheduledRunContext, emit?: (ev: CookEvent) => void, signal?: AbortSignal,
): Promise<CookOutcome> {
  if (signal?.aborted) {
    const ev: CookEvent = { type: 'error', message: 'cook cancelled before it started', status: 'cancelled', t: 0 };
    emit?.(ev);
    return { status: 'cancelled', exePath: '', durationMs: 0, sizeBytes: 0, message: ev.message };
  }
  let last: CookEvent | null = null;
  for await (const ev of cookExecutor({
    profile: ctx.profile, projectPath: ctx.projectPath, projectName: ctx.projectName, ueVersion: ctx.ueVersion, signal,
  })) {
    last = ev;
    emit?.(ev);
    if (ev.type === 'done' || ev.type === 'error') break;
  }
  if (last?.type === 'done') {
    // last.sizeBytes is the measured stage size or null when unmeasurable; the caller
    // re-normalizes 0 → null (treated as "unknown size"), so coercing null to 0 here is safe.
    return { status: 'success', exePath: last.exePath, durationMs: last.durationMs, sizeBytes: last.sizeBytes ?? 0 };
  }
  const cancelled = (last?.type === 'error' && last.status === 'cancelled') || !!signal?.aborted;
  const message = last?.type === 'error' ? last.message : cancelled ? 'cook cancelled' : 'cook produced no result';
  if (last?.type !== 'error') emit?.({ type: 'error', message, status: cancelled ? 'cancelled' : 'failed', t: 0 });
  return {
    status: cancelled ? 'cancelled' : 'failed', exePath: '',
    durationMs: last?.type === 'error' ? last.t : 0,
    sizeBytes: 0,
    message,
  };
}

function defaultRunCook(ctx: ScheduledRunContext): Promise<CookOutcome> {
  return runCookStreaming(ctx);
}

export const MAX_SIZE_WALK_FILES = 50_000;

/**
 * Sum file sizes under the staged exe's directory (best-effort).
 *
 * TRUNCATION IS NOT A MEASUREMENT. The walk stops at {@link MAX_SIZE_WALK_FILES}, and
 * the partial sum used to be returned as if it were the package size — then
 * `runScheduledBuild` step 4 OVERRODE `cookExecutor`'s uncapped measurement with it and
 * fed it to `evaluateBuildSize`. A shipping stage that crosses 50 000 files therefore
 * reports a size that shrinks as the project grows, which reads as an improvement and
 * can only ever mask a real regression.
 *
 * A truncated walk now returns `null` — "not measured" — so the caller keeps the
 * cook's own uncapped figure and the budget gate never grades a partial sum. The cap
 * itself stays: it is what keeps an unattended nightly run bounded.
 *
 * `maxFiles` is defaulted, not configured — it exists so the cap itself is testable
 * without materializing 50 000 files on disk.
 */
export async function measureBuildSize(
  exePath: string,
  maxFiles: number = MAX_SIZE_WALK_FILES,
): Promise<number | null> {
  const root = path.dirname(exePath);
  let total = 0;
  let count = 0;
  let truncated = false;
  async function walk(dir: string): Promise<void> {
    if (count >= maxFiles) { truncated = true; return; }
    let entries: import('node:fs').Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (count >= maxFiles) { truncated = true; return; }
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else {
        try {
          total += (await stat(full)).size;
          count++;
        } catch { /* skip unreadable */ }
      }
    }
  }
  try {
    await walk(root);
    if (truncated) {
      logger.warn(
        `[nightly] size walk of ${root} hit the ${maxFiles}-file cap after `
        + `${total} bytes — reporting UNMEASURED rather than a partial sum, so the size `
        + 'budget is not graded against a truncated number.',
      );
      return null;
    }
    return total > 0 ? total : null;
  } catch {
    return null;
  }
}

// The runner keeps no finalization logic of its own: a second copy is exactly how the
// interactive cook path and the scheduled runner drifted (unversioned nightly builds, an
// "unidentified" baseline). `defaultRunnerDeps` wires the store functions into the
// shared `finalizeCook`, project scope included.

export function defaultRunnerDeps(): ScheduledRunDeps {
  return {
    getHead: getGitHead,
    runPreflight: (ctx) => runFastPreflight(ctx.projectPath, ctx.projectName),
    runCook: defaultRunCook,
    measureSize: measureBuildSize,
    runSmoke: (ctx, exePath) =>
      runSmokeTest({ bootstrapExe: exePath, gameImage: deriveGameImage(ctx.projectName, ctx.profile.platform, ctx.profile.config) }),
    lastGreenBaseline: (platform, projectPath) => lastGreenBaseline(platform, projectPath),
    evaluateBuildSize: (platform, sizeBytes, lastGreen, baseline) =>
      evaluateBuildSize(platform, sizeBytes, lastGreen, undefined, baseline),
    nextVersion: autoIncrementOnSuccess,
    insertBuild,
    now: Date.now,
  };
}

// ── Scheduler triggers (cron + manual) ───────────────────────────────────────

/** Resolve the profile a schedule should build: explicit id → default → first. */
export function resolveScheduleProfile(schedule: BuildSchedule): BuildProfile | null {
  if (schedule.profileId) {
    const p = getProfile(schedule.profileId);
    if (p) return p;
  }
  const all = getProfiles();
  return all.find((p) => p.isDefault) ?? all[0] ?? null;
}

export interface TriggerResult {
  ran: boolean;
  reason: string;
}

/**
 * Start a scheduled build in the background as a `nightly` cook job. The job holds
 * the project for the WHOLE chain (pre-flight, cook, smoke, finalize), so an
 * interactive cook of the same project is refused meanwhile, and a nightly is refused
 * while an interactive cook holds it. Persists the outcome to the schedule state when
 * it finishes. Returns immediately; callers poll the schedule state, or attach to the
 * job (`GET /api/packaging/cook-jobs`) to watch it live.
 */
export function startScheduledRun(schedule: BuildSchedule, force = false): TriggerResult {
  if (isRunning()) return { ran: false, reason: 'a scheduled build is already running' };

  const profile = resolveScheduleProfile(schedule);
  if (!profile) return { ran: false, reason: 'no build profile configured' };
  if (!schedule.projectPath || !schedule.projectName) {
    return { ran: false, reason: 'no build target configured — save the schedule with a project open' };
  }

  const ctx: ScheduledRunContext = {
    profile,
    projectPath: schedule.projectPath,
    projectName: schedule.projectName,
    ueVersion: schedule.ueVersion || '5.5',
    lastBuiltCommit: getScheduleState().lastCommit,
    skipIfUnchanged: schedule.skipIfUnchanged,
  };

  const job = runCookJob(
    { projectPath: ctx.projectPath, profileId: profile.id, kind: 'nightly' },
    (emit, signal) => runNightlyJob(ctx, emit, signal),
  );
  if (!job.ok) return { ran: false, reason: `not started: ${job.error}` };
  return { ran: true, reason: force ? 'manual run started' : 'scheduled run started' };
}

/**
 * The nightly chain inside its job: cook events stream to the job (attachable
 * console); the chain's own outcome is appended after, so an attached console
 * settles on it like an interactive cook (`recorded {buildId}` after the terminal).
 */
async function runNightlyJob(
  ctx: ScheduledRunContext, emit: (ev: CookJobEvent) => void, signal: AbortSignal,
): Promise<string> {
  let cookTerminal = false;
  const deps: ScheduledRunDeps = {
    ...defaultRunnerDeps(),
    runCook: (c) => runCookStreaming(c, (ev) => {
      if (ev.type === 'done' || ev.type === 'error') cookTerminal = true;
      emit(ev);
    }, signal),
  };
  return runScheduledBuild(ctx, deps)
    .then((result) => {
      if (!cookTerminal && result.status !== 'skipped') {
        // Stopped before the cook (pre-flight): say why as the terminal event.
        emit({ type: 'error', message: result.reason, status: 'failed', t: result.durationMs });
      }
      if (result.buildId != null) emit({ type: 'recorded', buildId: result.buildId, version: null });
      else if (result.status !== 'skipped') {
        emit({ type: 'record-error', message: result.reason, note: 'The nightly run recorded no build row.' });
      }
      setScheduleState({
        lastRunAt: new Date().toISOString(),
        lastOutcome: result.status,
        lastReason: result.reason,
        lastBuildId: result.buildId,
        lastDurationMs: result.durationMs,
        // Any attempted tree becomes the new baseline so an unchanged tree skips
        // next time; a skipped run leaves the (already-equal) baseline alone.
        ...(result.status !== 'skipped' && result.commit ? { lastCommit: result.commit } : {}),
      });
      logger.info(`[nightly-build] ${result.status}: ${result.reason}`);
      return `nightly ${result.status}: ${result.reason}`;
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      setScheduleState({ lastRunAt: new Date().toISOString(), lastOutcome: 'failed', lastReason: `runner error: ${message}` });
      logger.warn(`[nightly-build] runner crashed: ${message}`);
      if (!cookTerminal) emit({ type: 'error', message: `runner error: ${message}`, status: 'failed', t: 0 });
      return `nightly failed: runner error: ${message}`;
    });
}

/**
 * Cron entry point: evaluate the persisted schedule against the clock and start
 * a run if one is due. Safe to call frequently — cheap when nothing is due.
 */
export function tickScheduler(now: Date = new Date()): TriggerResult {
  const schedule = getSchedule();
  if (!schedule.enabled) return { ran: false, reason: 'disabled' };
  if (!isDueAt(schedule, getScheduleState().lastRunAt, now)) return { ran: false, reason: 'not due' };
  return startScheduledRun(schedule, false);
}
