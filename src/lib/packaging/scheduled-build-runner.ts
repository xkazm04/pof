// Server-only: the unattended build orchestrator behind scheduled nightly
// builds. `runScheduledBuild` runs the full chain — skip-if-unchanged → fast
// pre-flight → cook → smoke (Win64) → size-budget → record — with every
// side-effect injected so it is unit-testable without spawning anything.
//
// `tickScheduler` / `startScheduledRun` wire the real implementations in and
// guard against concurrent runs; they are driven by the API route and the
// instrumentation cron.

import path from 'node:path';
import { stat, readdir } from 'node:fs/promises';
import type { BuildProfile } from './build-profiles';
import { getProfiles, getProfile } from './build-profiles-db';
import type { PreflightStatus, PreflightCheckResult } from './preflight';
import { runFastPreflight } from './preflight-runner';
import { cookExecutor, type CookEvent } from './cook-executor';
import { runSmokeTest, deriveGameImage, smokeResultNote, type SmokeTestResult, type SmokeTestStatus } from './smoke-test';
import { evaluateBuildSize, type SizeRegression } from './size-budgets';
import { insertBuild, getBuildsByPlatform, type BuildRecordInput } from './build-history-store';
import { getGitHead } from './git-head';
import { shouldSkipUnchanged, isDueAt, type BuildSchedule } from './build-scheduler';
import {
  getSchedule, getScheduleState, setScheduleState, isRunning, setRunning,
  type ScheduleOutcome,
} from './build-schedule-store';
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
  status: 'success' | 'failed';
  exePath: string;
  durationMs: number;
  sizeBytes: number;
  message?: string;
}

export interface ScheduledRunDeps {
  getHead: (projectPath: string) => Promise<string | null>;
  runPreflight: (ctx: ScheduledRunContext) => Promise<{ overall: PreflightStatus; results: PreflightCheckResult[] }>;
  runCook: (ctx: ScheduledRunContext) => Promise<CookOutcome>;
  measureSize: (exePath: string) => Promise<number | null>;
  runSmoke: (ctx: ScheduledRunContext, exePath: string) => Promise<SmokeTestResult>;
  lastGreenSize: (platform: string) => number | null;
  evaluateSize: (platform: string, sizeBytes: number | null, lastGreen: number | null) => SizeRegression | null;
  recordBuild: (input: BuildRecordInput) => { id: number };
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
    const rec = deps.recordBuild({
      platform, config, status: 'failed', durationMs: elapsed(),
      errorSummary: reason, notes: `${SCHED_NOTE} ${skip.reason}`,
    });
    return base('failed', reason, head, rec.id, elapsed(), 'fail', null, null);
  }

  // 3. Cook.
  const cook = await deps.runCook(ctx);
  if (cook.status === 'failed') {
    const reason = cook.message ?? 'cook failed';
    const rec = deps.recordBuild({
      platform, config, status: 'failed', durationMs: cook.durationMs || elapsed(),
      cookTimeMs: cook.durationMs, errorSummary: reason, notes: `${SCHED_NOTE} ${skip.reason}`,
    });
    return base('failed', reason, head, rec.id, elapsed(), pre.overall, null, null);
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

  // 6. Size-budget evaluation against the last green build.
  const sizeReg = deps.evaluateSize(platform, sizeBytes, deps.lastGreenSize(platform));

  // 7. Record + classify. A failed smoke flips the unattended gate to failed.
  const smokeFailed = smoke !== null && smoke.status === 'fail';
  const noteParts = [SCHED_NOTE, skip.reason];
  if (smoke) noteParts.push(smokeResultNote(smoke));
  if (sizeReg) noteParts.push(sizeReg.note);
  const notes = noteParts.join(' | ');

  const status: ScheduleOutcome = smokeFailed ? 'failed' : 'success';
  const rec = deps.recordBuild({
    platform, config,
    status: smokeFailed ? 'failed' : 'success',
    sizeBytes, durationMs: cook.durationMs || elapsed(), cookTimeMs: cook.durationMs,
    outputPath: cook.exePath || null,
    errorSummary: smokeFailed && smoke ? smokeResultNote(smoke) : null,
    notes,
  });

  const reason = smokeFailed && smoke
    ? smokeResultNote(smoke)
    : `Built green${sizeReg ? ' (size regression noted)' : ''}`;
  return base(status, reason, head, rec.id, elapsed(), pre.overall, smoke?.status ?? null, sizeReg?.note ?? null);
}

function base(
  status: ScheduleOutcome, reason: string, commit: string | null, buildId: number | null,
  durationMs: number, preflight: PreflightStatus | null, smoke: SmokeTestStatus | null,
  sizeRegression: string | null,
): ScheduledRunResult {
  return { status, reason, commit, buildId, durationMs, preflight, smoke, sizeRegression };
}

// ── Default (real) dependency wiring ─────────────────────────────────────────

async function defaultRunCook(ctx: ScheduledRunContext): Promise<CookOutcome> {
  let last: CookEvent | null = null;
  for await (const ev of cookExecutor({
    profile: ctx.profile, projectPath: ctx.projectPath, projectName: ctx.projectName, ueVersion: ctx.ueVersion,
  })) {
    last = ev;
    if (ev.type === 'done' || ev.type === 'error') break;
  }
  if (last?.type === 'done') {
    return { status: 'success', exePath: last.exePath, durationMs: last.durationMs, sizeBytes: last.sizeBytes };
  }
  return {
    status: 'failed', exePath: '',
    durationMs: last?.type === 'error' ? last.t : 0,
    sizeBytes: 0,
    message: last?.type === 'error' ? last.message : 'cook produced no result',
  };
}

const MAX_SIZE_WALK_FILES = 50_000;

/** Sum file sizes under the staged exe's directory (best-effort). */
async function measureBuildSize(exePath: string): Promise<number | null> {
  const root = path.dirname(exePath);
  let total = 0;
  let count = 0;
  async function walk(dir: string): Promise<void> {
    if (count >= MAX_SIZE_WALK_FILES) return;
    let entries: import('node:fs').Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (count >= MAX_SIZE_WALK_FILES) return;
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
    return total > 0 ? total : null;
  } catch {
    return null;
  }
}

function lastGreenSize(platform: string): number | null {
  const recent = getBuildsByPlatform(platform, 50);
  const green = recent.find((b) => b.status === 'success' && b.sizeBytes && b.sizeBytes > 0);
  return green?.sizeBytes ?? null;
}

export function defaultRunnerDeps(): ScheduledRunDeps {
  return {
    getHead: getGitHead,
    runPreflight: (ctx) => runFastPreflight(ctx.projectPath, ctx.projectName),
    runCook: defaultRunCook,
    measureSize: measureBuildSize,
    runSmoke: (ctx, exePath) =>
      runSmokeTest({ bootstrapExe: exePath, gameImage: deriveGameImage(ctx.projectName, ctx.profile.platform, ctx.profile.config) }),
    lastGreenSize,
    evaluateSize: (platform, sizeBytes, lastGreen) => evaluateBuildSize(platform, sizeBytes, lastGreen),
    recordBuild: insertBuild,
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
 * Start a scheduled build in the background (fire-and-forget). Guards against a
 * second concurrent run and persists the outcome to the schedule state when it
 * finishes. Returns immediately — callers poll the schedule state for progress.
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

  setRunning(true);
  void runScheduledBuild(ctx, defaultRunnerDeps())
    .then((result) => {
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
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      setScheduleState({ lastRunAt: new Date().toISOString(), lastOutcome: 'failed', lastReason: `runner error: ${message}` });
      logger.warn(`[nightly-build] runner crashed: ${message}`);
    })
    .finally(() => setRunning(false));

  return { ran: true, reason: force ? 'manual run started' : 'scheduled run started' };
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
