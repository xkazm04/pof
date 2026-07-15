/**
 * Harness Orchestrator — autonomous game development loop.
 *
 * v3 improvements:
 * - Streaming pool: areas processed as they complete, not batched
 * - Self-healing: typecheck/lint failures trigger inline fix sessions
 * - Soft deps: promoted-with-gaps areas unblock dependents immediately
 * - Dev server lifecycle: auto-start for visual gate, keep alive across iterations
 * - Aggressive promotion: after retries, promote failed areas so plan never stalls
 */

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { exec, spawn, type ChildProcess } from 'child_process';
import type { ProjectContext } from '@/lib/prompt-context';
import type {
  GamePlan,
  HarnessConfig,
  HarnessCostTotals,
  HarnessEvent,
  ModuleArea,
  ProgressEntry,
} from './types';
import type { GameBuildGuide } from './types';
import { buildGamePlan, updatePlanStats, planRatePct } from './plan-builder';
import {
  executeArea,
  parseAreaResult,
  readAgentsMd,
  appendAgentsMd,
} from './executor';
import { spawnClaudeSession, wrapHarnessResult } from './claude-session';
import { verify, formatVerificationSummary, detectGates } from './verifier';
import {
  createEmptyGuide,
  appendGuideStep,
  loadGuide,
  saveGuide,
} from './guide-generator';
import {
  createCheckpointer,
  checkpointBranch,
  type Checkpointer,
  type CheckpointState,
} from './checkpoint';
import { startRun, finalizeRun, reopenRun, getRun, type HarnessRunStatus } from '@/lib/harness-runs-db';
import { readJsonFile, writeJsonFile } from './state-io';
import { reconcileReportedFeatures, markUnreportedUnverified } from './feature-match';
import { logger } from '@/lib/logger';

// ── State I/O ───────────────────────────────────────────────────────────────

function planPath(sp: string) { return path.join(sp, 'game-plan.json'); }
function progressPath(sp: string) { return path.join(sp, 'progress.json'); }
function costPath(sp: string) { return path.join(sp, 'cost.json'); }
function checkpointsPath(sp: string) { return path.join(sp, 'checkpoints.json'); }
function runMetaPath(sp: string) { return path.join(sp, 'run-meta.json'); }
function configPath(sp: string) { return path.join(sp, 'harness-config.json'); }

// ── Durable run identity (statePath ⇄ runId binding) ─────────────────────────

/**
 * The durable link between a `statePath` and the `runId` its on-disk plan /
 * progress / cost belong to. Written on start; read on rehydrate after a process
 * restart so a resume continues the SAME run instead of minting a new id and
 * fragmenting history. `parentRunId` records provenance when a fresh start over a
 * completed statePath explicitly FORKS rather than resumes.
 */
export interface RunMeta {
  runId: string;
  projectPath: string;
  statePath: string;
  startedAt: string;
  /** Set when this run forked from a prior (completed) run at the same statePath. */
  parentRunId?: string;
}

/** Read the persisted run-meta for a statePath, or null when none exists. */
export function readRunMeta(statePath: string): RunMeta | null {
  return readJsonFile<RunMeta | null>(runMetaPath(statePath), null);
}

function saveRunMeta(sp: string, meta: RunMeta): void {
  try { writeJsonFile(runMetaPath(sp), meta); } catch { /* best-effort */ }
}

/** Persist the full config so a post-restart rehydrate can rebuild the orchestrator. */
function saveConfigSnapshot(sp: string, config: HarnessConfig): void {
  try { writeJsonFile(configPath(sp), config); } catch { /* best-effort */ }
}

/** Read the persisted config snapshot for a statePath, or null. */
export function readConfigSnapshot(statePath: string): HarnessConfig | null {
  return readJsonFile<HarnessConfig | null>(configPath(statePath), null);
}

/**
 * A `harness_runs` status is RESUMABLE when it is non-terminal-done: `paused` (a
 * clean pause), `interrupted` (reaped after a crash/restart), or `running` (a
 * stranded row whose owning process is gone). `completed`/`error` are terminal —
 * a fresh start over them FORKS with provenance instead.
 */
export function isResumableStatus(status: HarnessRunStatus | undefined): boolean {
  return status === 'paused' || status === 'interrupted' || status === 'running';
}

export type RunIdentityMode = 'fresh' | 'resume' | 'fork';

export interface RunIdentity {
  mode: RunIdentityMode;
  /** For 'resume' the adopted runId; for 'fresh'/'fork' the runId is minted in runLoop. */
  resumeRunId?: string;
  /** For 'fork', the prior run this one descends from. */
  parentRunId?: string;
}

/**
 * Decide whether a start pointed at `statePath` should RESUME the prior run
 * (same runId), FORK it with provenance (new runId → parent), or start FRESH.
 *
 * Default (no `forceFork`): resume when a run-meta exists and the prior run is
 * resumable; fork when the prior run is terminal-done; fresh when no run-meta.
 * `forceFork` always forks from an existing run-meta (records the parent).
 */
export function resolveRunIdentity(
  statePath: string,
  opts: { forceFork?: boolean; projectPath?: string } = {},
): RunIdentity {
  const meta = readRunMeta(statePath);
  if (!meta) return { mode: 'fresh' };
  // A start that supplies a DIFFERENT projectPath than the one this statePath's
  // run belongs to must never silently continue the prior run — the plan/progress
  // on disk describe another tree. Refusal (thrown, surfaced as a 400) beats both
  // guessing and a mismatched resume; the caller picks a new statePath or passes
  // fork:true to descend from the prior run explicitly.
  if (
    opts.projectPath &&
    path.resolve(opts.projectPath) !== path.resolve(meta.projectPath) &&
    !opts.forceFork
  ) {
    throw new Error(
      `statePath ${statePath} belongs to project ${meta.projectPath}, not ${opts.projectPath} — ` +
      `use a different statePath, or pass fork:true to descend from run ${meta.runId} explicitly`,
    );
  }
  if (opts.forceFork) return { mode: 'fork', parentRunId: meta.runId };
  const prior = getRun(meta.runId);
  // A run-meta whose DB row vanished but whose plan is still on disk is treated
  // as resumable (adopt the id) rather than silently minting a new one.
  if (!prior || isResumableStatus(prior.status)) return { mode: 'resume', resumeRunId: meta.runId };
  return { mode: 'fork', parentRunId: meta.runId };
}

/** Persist the checkpoint ledger for auditability (best-effort, never throws). */
function saveCheckpoints(sp: string, state: CheckpointState): void {
  try { writeJsonFile(checkpointsPath(sp), state); } catch { /* */ }
}

/** Public read accessor for the checkpoint ledger (API + UI). */
export function readCheckpoints(statePath: string): CheckpointState | null {
  return readJsonFile<CheckpointState | null>(checkpointsPath(statePath), null);
}

// ── Unit normalization ──────────────────────────────────────────────────────

/**
 * Normalize a pass-rate expressed as EITHER a 0–1 fraction OR a 0–100 percent
 * into the canonical 0–100 percent the orchestrator compares against.
 *
 * The control surfaces historically disagreed on units: the MCP tool documented
 * `targetPassRate` as "0–1" while the orchestrator (and CLI/API) compared a
 * 0–100 `passRate` against it — so an MCP caller passing `0.9` terminated at
 * ~1% pass. We accept both at every boundary: a value in `(0,1]` is treated as
 * a fraction and scaled ×100; any value `>1` is already a percent. `1` therefore
 * means 100%. Clamped to `[0,100]`; non-finite / ≤0 → 0.
 */
export function normalizePassRatePercent(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const pct = value <= 1 ? value * 100 : value;
  return Math.min(100, pct);
}

// ── Budget resolution ───────────────────────────────────────────────────────

/**
 * Default cost ceiling (USD) applied to any run that does not explicitly opt out
 * via `unlimited: true`. Without it an un-budgeted run had NO ceiling at all —
 * `maxIterations` (default 100) × ~30-min sessions could spend unbounded money.
 */
export const DEFAULT_BUDGET_USD = 25;

/**
 * Resolve the effective spend cap. Opting out of any ceiling requires an
 * explicit `unlimited: true`; otherwise a positive `budgetUsd` wins and a
 * missing / non-positive budget falls back to `DEFAULT_BUDGET_USD`. Returns the
 * cap in USD, or `null` for a genuinely uncapped (unlimited) run.
 */
export function resolveBudgetUsd(
  budgetUsd: number | null | undefined,
  unlimited: boolean | undefined,
): number | null {
  if (unlimited === true) return null;
  if (typeof budgetUsd === 'number' && budgetUsd > 0) return budgetUsd;
  return DEFAULT_BUDGET_USD;
}

// ── Cost governor ───────────────────────────────────────────────────────────

export function emptyCost(budgetUsd: number | null): HarnessCostTotals {
  return { spentUsd: 0, byArea: {}, sessions: 0, budgetUsd, paused: false };
}

function loadCost(sp: string, budgetUsd: number | null): HarnessCostTotals {
  const totals = readJsonFile<HarnessCostTotals>(costPath(sp), emptyCost(budgetUsd));
  return { ...totals, budgetUsd }; // refresh cap from current config
}

function saveCost(sp: string, totals: HarnessCostTotals): void {
  try { writeJsonFile(costPath(sp), totals); } catch { /* */ }
}

/** Returns the projected spend if we run one more session of `nextEstimateUsd`. */
export function projectedSpend(totals: HarnessCostTotals, nextEstimateUsd: number): number {
  return totals.spentUsd + nextEstimateUsd;
}

/** Average per-session cost so far, used as the projected-spend estimate. */
export function avgSessionCost(totals: HarnessCostTotals): number {
  if (totals.sessions === 0) return 0;
  return totals.spentUsd / totals.sessions;
}

/** Decision the budget governor would make if asked to fire one more session. */
export function budgetWouldOverflow(totals: HarnessCostTotals, budgetUsd: number | null): boolean {
  if (budgetUsd == null) return false;
  if (totals.spentUsd >= budgetUsd) return true;
  return projectedSpend(totals, avgSessionCost(totals)) > budgetUsd;
}

/**
 * Per-session spend estimate used for in-flight reservation at launch time.
 * Prefers the running average once any session has settled, falling back to the
 * fixed estimate so the first launches still reserve a non-zero amount.
 */
export function sessionCostEstimate(totals: HarnessCostTotals, fallbackUsd: number): number {
  const avg = avgSessionCost(totals);
  return avg > 0 ? avg : fallbackUsd;
}

/**
 * Budget admission check that also counts spend already reserved by in-flight
 * sessions. Committed spend (`totals.spentUsd`) plus the outstanding reservation
 * (`reservedUsd`) plus the next session's estimate must stay within the cap.
 * This is what closes the (maxConcurrent − 1) overshoot: without `reservedUsd`,
 * the governor reads only settled spend and green-lights every concurrent
 * launch before a single dollar is booked.
 */
export function budgetWouldOverflowReserved(
  totals: HarnessCostTotals,
  reservedUsd: number,
  nextEstimateUsd: number,
  budgetUsd: number | null,
): boolean {
  if (budgetUsd == null) return false;
  const committedPlusInFlight = totals.spentUsd + reservedUsd;
  if (committedPlusInFlight >= budgetUsd) return true;
  return committedPlusInFlight + nextEstimateUsd > budgetUsd;
}

/** Public read accessor for the API + UI. */
export function readHarnessCost(statePath: string): HarnessCostTotals | null {
  return readJsonFile<HarnessCostTotals | null>(costPath(statePath), null);
}

function loadPlan(sp: string): GamePlan | null {
  return readJsonFile<GamePlan | null>(planPath(sp), null);
}
function savePlan(sp: string, plan: GamePlan) {
  writeJsonFile(planPath(sp), plan);
}
function loadProgress(sp: string): ProgressEntry[] {
  return readJsonFile<ProgressEntry[]>(progressPath(sp), []);
}
function saveProgress(sp: string, entries: ProgressEntry[]) {
  writeJsonFile(progressPath(sp), entries);
}
function appendProgressEntry(sp: string, entry: ProgressEntry) {
  const entries = loadProgress(sp);
  entries.push(entry);
  saveProgress(sp, entries);
}

// ── Dev Server Lifecycle ────────────────────────────────────────────────────

/**
 * Per-orchestrator handle for the auto-started `next dev` process. Previously a
 * single module-global `devServerProc` — two orchestrators in one process would
 * clobber each other's handle (one's killDevServer could null out or SIGKILL the
 * other's server). Each orchestrator now owns its own handle in its closure.
 */
interface DevServerHandle {
  proc: ChildProcess | null;
}

async function ensureDevServer(projectPath: string, handle: DevServerHandle): Promise<void> {
  // Check if port 3000 is already responding
  const alive = await checkPort(3000);
  if (alive) return;

  if (handle.proc) {
    try { handle.proc.kill(); } catch { /* ignore */ }
  }

  return new Promise((resolve) => {
    const proc = spawn('npx', ['next', 'dev', '--port', '3000'], {
      cwd: projectPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      // On POSIX, detach so the child (and its `next dev` descendants) form a
      // process group we can tree-kill via `process.kill(-pid)` in
      // killDevServer; otherwise a SIGKILL to the shell would orphan node.
      // On Windows we keep the default and tree-kill with `taskkill /T`.
      detached: process.platform !== 'win32',
    });
    handle.proc = proc;

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; resolve(); }
    }, 30_000);

    proc.stdout?.on('data', (data: Buffer) => {
      if (!resolved && data.toString().includes('Ready')) {
        resolved = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    proc.on('error', () => {
      if (!resolved) { resolved = true; clearTimeout(timeout); resolve(); }
    });
  });
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, () => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

function killDevServer(handle: DevServerHandle) {
  if (handle.proc) {
    const proc = handle.proc;
    const pid = proc.pid;
    handle.proc = null;
    // The dev server is spawned with `shell: true`, so on Windows `proc.pid` is
    // the wrapping `cmd.exe` and `proc.kill()` would orphan the real `next dev`
    // node process holding port 3000. Kill the whole process tree so the port
    // is actually released: `taskkill /T` on win32, the process group on POSIX.
    if (pid != null) {
      if (process.platform === 'win32') {
        try {
          exec(`taskkill /pid ${pid} /T /F`, () => { /* best-effort reap */ });
        } catch { /* ignore */ }
      } else {
        // Fall back to a plain kill if the group kill isn't available.
        try { process.kill(-pid, 'SIGKILL'); } catch {
          try { proc.kill('SIGKILL'); } catch { /* ignore */ }
        }
      }
    } else {
      try { proc.kill(); } catch { /* ignore */ }
    }
  }
}

// ── Self-Healing Fix Session ────────────────────────────────────────────────

/**
 * Pick the verification command for the self-heal pass. We deliberately route
 * through the failing gate's own command so the post-fix check is meaningful
 * for the project type at hand (e.g. on a UE5 C++ tree the hardcoded
 * `npx tsc --noEmit` is a category error — tsc doesn't exist there). Falls
 * back to a `typecheck` / `build` gate if no failing gate carries a command,
 * and ultimately returns `null` so the caller can resolve as healed (we'd
 * rather optimistically advance than silently fail a successful repair).
 */
export function pickHealVerifyCommand(
  failingGates: Array<{ name?: string; command?: string }>,
  allGates: Array<{ name?: string; type?: string; command?: string }>,
): string | null {
  for (const g of failingGates) {
    if (g.command) return g.command;
  }
  const tc = allGates.find((g) => g.type === 'typecheck' && g.command);
  if (tc?.command) return tc.command;
  const build = allGates.find((g) => g.type === 'build' && g.command);
  if (build?.command) return build.command;
  return null;
}

/**
 * When verification fails with typecheck/lint errors, spawn a quick fix session.
 * Returns true if the fix succeeded (verification command passes after fix).
 * `verifyCommand` is derived from the failing gate so this works on UE5 trees
 * (no tsc), TypeScript trees (tsc), or any custom gate configured by the user.
 */
export interface SelfHealResult {
  healed: boolean;
  reason?: string;
}

export async function attemptSelfHeal(
  projectPath: string,
  errors: string[],
  verifyCommand: string | null,
  config: { sessionTimeoutMs: number; skipPermissions: boolean },
): Promise<SelfHealResult> {
  if (!verifyCommand) {
    // No reliable command to re-run means no way to CONFIRM a repair. We refuse
    // to optimistically claim `healed` (this used to return true and silently
    // advance) — the area's normal retry will re-attempt under full verification.
    return { healed: false, reason: 'no verify command available to confirm the fix — not self-certifying' };
  }

  const errorSummary = errors.slice(0, 20).join('\n');
  const fixPrompt = `You are a code fixer. The following errors occurred after a code generation session.
Fix ALL errors. Do not add features, do not refactor — ONLY fix the errors.
Read each file mentioned in the errors, understand the issue, and apply minimal fixes.

ERRORS:
${errorSummary}

After fixing, verify by running: ${verifyCommand}
If there are remaining errors, fix those too. Do NOT give up — keep fixing until clean.

When done, output exactly:
${wrapHarnessResult('{"areaId":"self-heal","completed":true,"features":[],"filesCreated":[],"filesModified":[],"learnings":[],"summary":"Fixed errors"}')}`;

  await spawnClaudeSession(fixPrompt, {
    cwd: projectPath,
    allowedTools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],
    skipPermissions: config.skipPermissions,
    enableMcp: true,
    timeoutMs: Math.min(config.sessionTimeoutMs, 300_000), // Max 5 min for fix
  });

  return new Promise<SelfHealResult>((resolve) => {
    exec(verifyCommand, { cwd: projectPath, timeout: 60_000 }, (err) => {
      resolve(err === null
        ? { healed: true }
        : { healed: false, reason: 'verify command still failing after the fix session' });
    });
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Heal areas stranded mid-flight by a crash or a previous abandoning build:
 * `pickNextAreas` only ever picks `pending`, so a persisted `in-progress` area
 * would never run again and the target pass rate becomes unreachable. Flips every
 * `in-progress` area back to `pending`. Returns the number healed. Runs on every
 * (re)entry into the loop — the resume/rehydrate path relies on it. Pure.
 */
export function healStrandedAreas(plan: GamePlan): number {
  let healed = 0;
  for (const area of plan.areas) {
    if (area.status === 'in-progress') { area.status = 'pending'; healed += 1; }
  }
  return healed;
}

/** Soft dep resolution: both 'completed' and 'failed' (after max retries) count as resolved. */
function isDependencyResolved(plan: GamePlan, progress: ProgressEntry[], depId: string, maxRetries: number): boolean {
  const dep = plan.areas.find(a => a.id === depId);
  if (!dep) return true; // Unknown dep — don't block
  // A promoted-with-gaps area unblocks dependents just like a clean completion
  // (that's the whole point of the soft-dep promotion) — but it's excluded from
  // the pass-rate numerator so it can't inflate progress.
  if (dep.status === 'completed' || dep.status === 'completed-with-gaps') return true;
  // Failed areas that exhausted retries are treated as resolved (soft deps)
  if (dep.status === 'failed') {
    const retries = progress.filter(p => p.areaId === depId && p.outcome !== 'success').length;
    return retries >= maxRetries;
  }
  return false;
}

/** Pick up to N dependency-resolved areas for the streaming pool. */
function pickNextAreas(plan: GamePlan, maxN: number, progress: ProgressEntry[], maxRetries: number): ModuleArea[] {
  const areas: ModuleArea[] = [];
  for (const area of plan.areas) {
    if (areas.length >= maxN) break;
    if (area.status !== 'pending') continue;
    const depsOk = area.dependsOn.every(depId => isDependencyResolved(plan, progress, depId, maxRetries));
    if (!depsOk) continue;
    areas.push(area);
  }
  return areas;
}

function getRetryCount(progress: ProgressEntry[], areaId: string): number {
  return progress.filter(p => p.areaId === areaId && p.outcome !== 'success').length;
}

/**
 * Feature pass-rate for an area as a 0–1 ratio. A ZERO-feature area is vacuously
 * satisfied (ratio 1): there is nothing to fail, so it must complete on green
 * required gates instead of being trapped below threshold and burning retries
 * forever into completed-with-gaps. (Previously it returned 0 → could never pass
 * even with every required gate green.)
 */
export function computeFeaturePassRate(passingCount: number, totalCount: number): number {
  return totalCount > 0 ? passingCount / totalCount : 1;
}

// ── Orchestrator ────────────────────────────────────────────────────────────

export type HarnessEventListener = (event: HarnessEvent) => void;

export interface HarnessOrchestrator {
  start(): Promise<GameBuildGuide>;
  pause(): void;
  resume(): Promise<GameBuildGuide>;
  getPlan(): GamePlan | null;
  getGuide(): GameBuildGuide | null;
  /** Snapshot of accumulated executor spend + cap. */
  getCost(): HarnessCostTotals;
  /** Stable id of the currently-active run row in `harness_runs`, set on start(). */
  getRunId(): string | null;
  /** Green-checkpoint ledger when git checkpointing is enabled, else null. */
  getCheckpoints(): CheckpointState | null;
  on(listener: HarnessEventListener): () => void;
}

/** Run id generator. Time-prefixed so DB ordering by id roughly matches startedAt. */
export function newRunId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `run_${ts}_${rand}`;
}

/**
 * Options controlling a run's DURABLE IDENTITY.
 * - `resumeRunId`: adopt an existing runId (a rehydrate/resume) — runLoop
 *   reopens the row instead of inserting a new one, so history is one continuous
 *   run across a pause / process restart.
 * - `parentRunId`: provenance for a FORK — a fresh runId is minted, but run-meta
 *   records the parent so a fork is auditable, never a silent fragment.
 */
export interface OrchestratorOptions {
  resumeRunId?: string;
  parentRunId?: string;
}

export function createHarnessOrchestrator(
  config: HarnessConfig,
  opts: OrchestratorOptions = {},
): HarnessOrchestrator {
  const listeners = new Set<HarnessEventListener>();
  let paused = false;
  // Adopt an existing runId on a resume/rehydrate; otherwise runLoop mints one.
  let runId: string | null = opts.resumeRunId ?? null;
  const parentRunId = opts.parentRunId ?? null;
  // This orchestrator's own dev-server handle (see DevServerHandle) — never
  // shared across orchestrators, so one run's teardown can't kill another's.
  const devServer: DevServerHandle = { proc: null };

  /** Persist the current run state as a terminal snapshot in `harness_runs`. */
  function persistTerminal(status: HarnessRunStatus, errorMessage?: string | null): void {
    if (!runId) return;
    try {
      const plan = loadPlan(config.statePath);
      const guide = loadGuide(config.statePath);
      const progress = loadProgress(config.statePath);
      finalizeRun({
        runId,
        status,
        endedAt: new Date().toISOString(),
        plan,
        progress,
        guide,
        cost: { ...cost, byArea: { ...cost.byArea } },
        errorMessage: errorMessage ?? null,
      });
    } catch {
      // Persistence failure must never break the loop — history is best-effort.
    }
  }

  const emit = (event: HarnessEvent) => {
    for (const l of listeners) { try { l(event); } catch { /* */ } }
  };

  const ctx: ProjectContext = {
    projectName: config.projectName,
    projectPath: config.projectPath,
    ueVersion: config.ueVersion,
  };

  // Checkpoint rollback runs `git reset --hard` on the shared working tree; with concurrency
  // >1 that would wipe sibling areas' in-flight edits. Checkpointing assumes sequential
  // execution, so force a single worker whenever it is enabled.
  const maxConcurrent = config.checkpoint === true ? 1 : (config.executor.maxConcurrent ?? 1);
  // Normalize both thresholds so a fraction (0–1) or percent (0–100) is accepted
  // at every boundary; the canonical form is a 0–1 ratio for the feature check.
  const targetPassRatePct = normalizePassRatePercent(config.targetPassRate);
  const areaPassThreshold =
    normalizePassRatePercent(config.executor.areaPassThreshold ?? targetPassRatePct) / 100;
  // Which numerator the stop condition uses. Default 'verified' — a feature's
  // pass must be backed by a passing required gate to count toward the target.
  const passRateBasis = config.passRateBasis ?? 'verified';
  const maxRetries = config.executor.maxRetriesPerArea;
  const budgetUsd = resolveBudgetUsd(config.budgetUsd, config.unlimited);

  if (!fs.existsSync(config.statePath)) {
    fs.mkdirSync(config.statePath, { recursive: true });
  }
  // Snapshot the config so a post-restart rehydrate can rebuild this orchestrator
  // (the in-memory singleton is gone after a restart; disk is the source of truth).
  saveConfigSnapshot(config.statePath, config);

  // Persist + reload running totals so budget enforcement is restart-safe.
  let cost = loadCost(config.statePath, budgetUsd);
  cost.budgetUsd = budgetUsd;

  // In-flight budget reservation: the optimistic estimated spend of sessions
  // that have launched but not yet returned. Lives in memory only (it is never
  // restart-safe — a crash drops all in-flight sessions anyway) and is always
  // reconciled to $0 as each session books its actual cost in recordSessionCost.
  // Maps areaId → reserved estimate so each session releases exactly what it booked.
  const reserved = new Map<string, number>();
  const reservedTotal = () => {
    let sum = 0;
    for (const v of reserved.values()) sum += v;
    return sum;
  };

  // Git checkpointing (opt-in). The checkpointer is created lazily in runLoop
  // once a runId exists, since the branch name is derived from it.
  const checkpointEnabled = config.checkpoint === true;
  let checkpointer: Checkpointer | null = null;

  /** Fallback per-session spend (USD) used when the CLI reports no cost, so the budget
   *  governor keeps advancing toward the cap instead of being silently disabled when the
   *  cost signal is absent. Also the seed estimate for the in-flight reservation before
   *  any session has settled an average. */
  const SESSION_COST_ESTIMATE_USD = 0.5;

  /** Returns true when launching one more session would push committed + in-flight
   *  (reserved) spend past the cap. Factoring in `reservedTotal()` is what stops fillPool
   *  from overshooting by up to (maxConcurrent − 1) sessions: settled spend alone is
   *  unchanged until a session returns, so without the reservation every concurrent
   *  launch would be green-lit before a single dollar is booked. */
  function wouldOverflowNow(): boolean {
    const estimate = sessionCostEstimate(cost, SESSION_COST_ESTIMATE_USD);
    return budgetWouldOverflowReserved(cost, reservedTotal(), estimate, budgetUsd);
  }

  /** Optimistically book a session's estimated cost at LAUNCH time so concurrent launches
   *  in fillPool see each other's projected spend. Reconciled to the real cost in
   *  recordSessionCost when the session returns. */
  function reserveSessionCost(areaId: string): void {
    reserved.set(areaId, sessionCostEstimate(cost, SESSION_COST_ESTIMATE_USD));
  }

  /** Record a session's actual cost into the running totals + persist, and RECONCILE by
   *  releasing the launch-time reservation for this area (so the final accounting is exact,
   *  not the optimistic estimate). Always counts the session (so avgSessionCost has a
   *  non-zero denominator and the governor can fire); a missing or non-positive cost falls
   *  back to an estimate rather than dropping the session to $0. */
  function recordSessionCost(areaId: string, costUsd: number | undefined): void {
    reserved.delete(areaId); // release the optimistic reservation — actual spend booked below
    const amount = typeof costUsd === 'number' && costUsd > 0 ? costUsd : SESSION_COST_ESTIMATE_USD;
    cost.sessions += 1;
    cost.spentUsd += amount;
    cost.byArea[areaId] = (cost.byArea[areaId] ?? 0) + amount;
    saveCost(config.statePath, cost);
  }

  /**
   * Roll the working tree back to the last green checkpoint before an area is
   * promoted-with-gaps. No-op when checkpointing is disabled or nothing has been
   * checkpointed yet. Emits `harness:rollback` on success.
   */
  async function rollbackBeforePromote(areaId: string, iteration: number): Promise<void> {
    if (!checkpointer) return;
    const sha = await checkpointer.rollbackToLastGreen();
    if (sha) {
      emit({ type: 'harness:rollback', areaId, iteration, toSha: sha });
      emit({
        type: 'harness:learning',
        learning: `Rolled ${areaId} back to last green checkpoint ${sha.slice(0, 8)} before promoting-with-gaps`,
      });
    }
  }

  // ── Process one area: execute → verify → (self-heal?) → record ──────────

  async function processArea(
    area: ModuleArea,
    plan: GamePlan,
    progress: ProgressEntry[],
    gates: ReturnType<typeof detectGates>,
    guide: GameBuildGuide,
  ): Promise<'completed' | 'partial' | 'failed'> {
    area.status = 'in-progress';
    emit({ type: 'harness:executing', iteration: plan.iteration, areaId: area.id });

    const agentsMd = config.updateAgentsMd ? readAgentsMd(config.statePath) : '';

    const execResult = await executeArea(
      area, plan, progress, ctx, config.executor, agentsMd,
      () => {},
      config.themeDirective,
    );
    recordSessionCost(area.id, execResult.costUsd);

    const parsed = parseAreaResult(execResult.assistantOutput);

    if (!execResult.completed || !parsed) {
      const entry: ProgressEntry = {
        iteration: plan.iteration,
        timestamp: new Date().toISOString(),
        areaId: area.id,
        moduleId: area.moduleId,
        action: 'execute',
        outcome: 'failure',
        summary: `Execution ${execResult.completed ? 'completed but no result markers' : 'failed'}. ${execResult.errors?.join('; ') ?? ''}`,
        durationMs: execResult.durationMs,
        featuresChanged: [],
        errors: execResult.errors,
      };
      appendProgressEntry(config.statePath, entry);
      progress.push(entry);
      return 'failed';
    }

    // ── VERIFY ──────────────────────────────────────────────────────────────

    emit({ type: 'harness:verifying', iteration: plan.iteration, areaId: area.id });

    let verification = await verify(area, plan.iteration, config.projectPath, gates, config.statePath);

    // ── SELF-HEAL: If required gates failed, try to fix inline ──────────────

    if (verification.requiredFailures > 0) {
      // Only CODE failures are self-healable. An UNVERIFIABLE gate (e.g. no UE
      // env for the compile gate) has no code error to fix — exclude it so we
      // never burn a heal session trying to "fix" a missing environment.
      const healableFailures = verification.gates.filter(g => !g.passed && !g.unverifiable);
      const gateErrors = healableFailures
        .flatMap(g => g.errors?.map(e => e.message) ?? [g.output.slice(0, 500)]);

      // Map failing VerificationResults back to their gate configs (with .command/.type).
      const failingGateConfigs = healableFailures
        .map(r => gates.find(g => g.name === r.gate))
        .filter((g): g is NonNullable<typeof g> => !!g);
      const verifyCommand = pickHealVerifyCommand(failingGateConfigs, gates);

      if (gateErrors.length > 0) {
        emit({
          type: 'harness:learning',
          learning: `Self-healing: attempting to fix ${gateErrors.length} gate errors for ${area.id}`
            + (verifyCommand ? ` (verify: ${verifyCommand})` : ' (no verify command — cannot confirm)'),
        });

        const heal = await attemptSelfHeal(config.projectPath, gateErrors, verifyCommand, {
          sessionTimeoutMs: config.executor.sessionTimeoutMs,
          skipPermissions: config.executor.skipPermissions,
        });

        if (heal.healed) {
          // Re-run verification after fix
          verification = await verify(area, plan.iteration, config.projectPath, gates, config.statePath);
          emit({
            type: 'harness:learning',
            learning: `Self-heal ${verification.requiredFailures === 0 ? 'SUCCEEDED' : 'partially helped'} for ${area.id}`,
          });
        } else {
          emit({
            type: 'harness:learning',
            learning: `Self-heal did not hold for ${area.id}: ${heal.reason ?? 'unknown'}`,
          });
        }
      } else if (verification.gates.some(g => g.unverifiable)) {
        emit({
          type: 'harness:learning',
          learning: `Skipping self-heal for ${area.id} — only unverifiable gate(s) failed (no code error to fix; configure the UE env to verify)`,
        });
      }
    }

    const verifySummary = formatVerificationSummary(verification);

    // ── Update features ────────────────────────────────────────────────────

    // Reconcile reported features against the plan by EXACT normalized match
    // (name or `moduleId::name` id). No fuzzy substring, no force-pass — an
    // unmatched report leaves the plan feature untouched (→ unverified below).
    let matchedFeatures = 0;
    if (parsed.features && parsed.features.length > 0) {
      const { matched } = reconcileReportedFeatures(area.features, parsed.features, plan.iteration);
      matchedFeatures = matched;

      // The model claimed results but NONE resolved to a planned feature. This
      // used to force-pass every feature at quality 4 — the exact "garbage is
      // green" bug. Now we log the mismatch loudly and leave the features
      // unverified (handled below).
      if (matchedFeatures === 0) {
        const reported = parsed.features.map(f => f.name).slice(0, 8).join(', ');
        logger.warn(
          `[harness] Area ${area.id}: executor reported ${parsed.features.length} feature(s) but NONE matched the plan by normalized name/id — leaving them unverified. Reported: ${reported}`,
        );
        emit({
          type: 'harness:learning',
          learning: `No reported features matched the plan for ${area.id} — kept unverified (reported: ${reported})`,
        });
      }
    }

    // ── Outcome ────────────────────────────────────────────────────────────

    const passingCount = area.features.filter(f => f.status === 'pass').length;
    const totalCount = area.features.length;
    const featurePassRate = computeFeaturePassRate(passingCount, totalCount);
    const requiredGatesPassed = verification.requiredFailures === 0;
    const areaSuccess = requiredGatesPassed && featurePassRate >= areaPassThreshold;

    // ── Verified-truth bookkeeping ───────────────────────────────────────────
    // A feature's `pass` is VERIFIED only when the area's required gates passed
    // (the real UBT compile / abslog test — an unverifiable gate makes
    // `requiredFailures > 0`, so `requiredGatesPassed` is already false without a
    // UE env). Non-pass features are never verified. This is honest bookkeeping
    // over the gate evidence the loop already produced — no new mechanism.
    for (const f of area.features) {
      f.verified = f.status === 'pass' ? requiredGatesPassed : false;
    }

    // Verification outcome for the run history: a required gate that could not be
    // evaluated (e.g. no UE env → compile gate) records 'unverifiable' so the
    // area is never silently self-certified.
    const requiredUnverifiable = verification.gates.some(
      g => g.unverifiable && gates.find(x => x.name === g.gate)?.required,
    );
    const verificationOutcome: 'pass' | 'fail' | 'unverifiable' =
      requiredUnverifiable ? 'unverifiable' : requiredGatesPassed ? 'pass' : 'fail';

    area.status = areaSuccess ? 'completed' : 'failed';
    if (areaSuccess) {
      area.completedAt = plan.iteration;
    }

    // Honesty pass: a session ran over this area, so any feature it never
    // reported on is UNVERIFIED — never a silent pass. (Previously areaSuccess
    // force-passed every remaining 'pending' feature at quality 3.)
    markUnreportedUnverified(area.features);

    const entry: ProgressEntry = {
      iteration: plan.iteration,
      timestamp: new Date().toISOString(),
      areaId: area.id,
      moduleId: area.moduleId,
      action: 'execute',
      outcome: areaSuccess ? 'success' : 'partial',
      summary: `${parsed.summary}\n${verifySummary}\nFeatures: ${passingCount}/${totalCount} (${Math.round(featurePassRate * 100)}%)`,
      durationMs: execResult.durationMs,
      featuresChanged: parsed.features?.map(f => f.name) ?? [],
      errors: verification.gates.filter(g => !g.passed).map(g => g.output.slice(0, 200)),
      learnings: parsed.learnings,
      verification: verificationOutcome,
    };
    appendProgressEntry(config.statePath, entry);
    progress.push(entry);

    if (config.updateAgentsMd && parsed.learnings?.length) {
      appendAgentsMd(config.statePath, parsed.learnings);
      emit({ type: 'harness:learning', learning: parsed.learnings.join('; ') });
    }

    if (config.generateGuide && areaSuccess) {
      const step = appendGuideStep(guide, area, parsed, verification, entry);
      guide.cost = { ...cost, byArea: { ...cost.byArea } };
      saveGuide(config.statePath, guide);
      emit({ type: 'harness:guide-updated', step });
    }

    if (areaSuccess) {
      // Snapshot the passing tree as a green checkpoint we can roll back to.
      if (checkpointer) {
        const cp = await checkpointer.commitArea(area.id, plan.iteration);
        if (cp) {
          saveCheckpoints(config.statePath, checkpointer.getState());
          emit({ type: 'harness:checkpoint', areaId: area.id, iteration: plan.iteration, sha: cp.sha });
        } else {
          emit({
            type: 'harness:learning',
            learning: `Checkpoint commit failed for ${area.id} — continuing without a snapshot`,
          });
        }
      }
      emit({ type: 'harness:area-completed', areaId: area.id, iteration: plan.iteration });
      return 'completed';
    } else {
      emit({
        type: 'harness:area-failed',
        areaId: area.id,
        iteration: plan.iteration,
        reason: `Features: ${passingCount}/${totalCount} (need ${Math.round(areaPassThreshold * 100)}%). Gates: ${verification.requiredFailures} required failures`,
      });
      return 'partial';
    }
  }

  // ── Streaming Pool Executor ─────────────────────────────────────────────

  /**
   * Process areas using a streaming pool pattern.
   * Starts up to maxConcurrent areas. As each completes, immediately:
   * 1. Record its result
   * 2. Promote failed areas if retries exhausted (soft deps)
   * 3. Pick the next available area and start it
   * This prevents slow areas from blocking fast ones.
   */
  async function runStreamingPool(
    plan: GamePlan,
    progress: ProgressEntry[],
    gates: ReturnType<typeof detectGates>,
    guide: GameBuildGuide,
  ): Promise<void> {
    const active = new Map<string, Promise<{ area: ModuleArea; result: 'completed' | 'partial' | 'failed' }>>();

    function fillPool() {
      while (active.size < maxConcurrent) {
        // A pause (user or budget) must stop NEW launches immediately — the
        // loop body calls fillPool() after each completion, and without this
        // check a pause mid-race still launched replacement 30-minute
        // sessions before the loop top ever saw `paused`.
        if (paused) return;
        // Cost governor: bail before launching anything new if the budget cap
        // has been hit (or projected next-session spend would cross it).
        if (wouldOverflowNow()) {
          if (!cost.paused) {
            cost.paused = true;
            saveCost(config.statePath, cost);
            paused = true;
            const reason = `Cost cap reached: spent $${cost.spentUsd.toFixed(2)} of $${budgetUsd?.toFixed(2)} cap (${cost.sessions} sessions)`;
            emit({ type: 'harness:paused', reason });
          }
          return;
        }
        const candidates = pickNextAreas(plan, maxConcurrent - active.size, progress, maxRetries);
        // Don't pick areas already in the active pool
        const next = candidates.find(a => !active.has(a.id));
        if (!next) break;

        emit({ type: 'harness:iteration', iteration: plan.iteration, areaId: next.id });
        // Reserve this session's estimated cost NOW so the next loop iteration's
        // wouldOverflowNow() sees it and stops launching once projected spend
        // (committed + in-flight reservations) would cross the cap. processArea
        // reconciles to the actual cost via recordSessionCost when it returns.
        reserveSessionCost(next.id);
        const promise = processArea(next, plan, progress, gates, guide)
          .then(result => ({ area: next, result }))
          .catch(() => {
            // executeArea threw before recordSessionCost could reconcile —
            // release the reservation so it can't permanently inflate the
            // in-flight total and falsely trip the governor on later launches.
            reserved.delete(next.id);
            return { area: next, result: 'failed' as const };
          });
        active.set(next.id, promise);
      }
    }

    // Seed the pool
    fillPool();

    while (active.size > 0) {
      if (paused) break;

      // Wait for ANY area to complete (streaming, not batched)
      const result = await Promise.race(active.values());
      active.delete(result.area.id);

      // Handle result
      if (result.result !== 'completed') {
        const retries = getRetryCount(progress, result.area.id);
        if (retries < maxRetries) {
          result.area.status = 'pending'; // Retry later
        } else {
          // Exhausted retries — roll the bad session's changes back to the last
          // green checkpoint BEFORE promoting, so this area's broken work can't
          // corrupt earlier passing areas. Then promote-WITH-GAPS to unblock
          // deps: the area is marked 'completed-with-gaps' (NOT 'completed') so
          // it never counts toward the pass-rate numerator.
          await rollbackBeforePromote(result.area.id, plan.iteration);
          result.area.status = 'completed-with-gaps';
          result.area.completedAt = plan.iteration;
          emit({
            type: 'harness:area-completed',
            areaId: result.area.id,
            iteration: plan.iteration,
          });
          emit({
            type: 'harness:learning',
            learning: `Area ${result.area.id} promoted-with-gaps after ${retries} retries — dependents unblocked, but excluded from the pass-rate numerator (unverified)`,
          });
        }
      }

      // Save state after each area completes
      updatePlanStats(plan);
      savePlan(config.statePath, plan);
      emit({ type: 'harness:progress', plan });

      // Check pass rate (verified by default; see passRateBasis)
      const passRate = planRatePct(plan, passRateBasis);
      if (passRate >= targetPassRatePct) break;

      // Fill pool with newly unblocked areas
      fillPool();
    }

    // Never abandon in-flight sessions: a pause/target break used to return
    // with up to maxConcurrent live `claude -p` sessions still running — they
    // kept editing the working tree and writing progress/cost/guide files
    // AFTER the run was snapshotted, and their in-memory status flips were
    // never persisted, stranding areas as in-progress on disk. Drain them,
    // then persist the plan they actually produced.
    if (active.size > 0) {
      emit({
        type: 'harness:learning',
        learning: `Draining ${active.size} in-flight session(s) before stopping — no new sessions will launch`,
      });
      await Promise.allSettled(active.values());
      updatePlanStats(plan);
      savePlan(config.statePath, plan);
      emit({ type: 'harness:progress', plan });
    }
  }

  // ── Core Loop ───────────────────────────────────────────────────────────

  async function runLoop(): Promise<GameBuildGuide> {
    const plan = loadPlan(config.statePath) ?? buildGamePlan(config);
    // Heal areas stranded mid-flight by a crash or an old abandoning build (also
    // the resume/rehydrate path: a run interrupted mid-area resumes cleanly).
    healStrandedAreas(plan);
    savePlan(config.statePath, plan);
    const guide = loadGuide(config.statePath) ?? createEmptyGuide(plan);
    saveGuide(config.statePath, guide);
    const progress = loadProgress(config.statePath);
    const gates = config.gates.length > 0 ? config.gates : detectGates(config.projectPath);

    // Start dev server for visual gate
    const hasVisualGate = gates.some(g => g.type === 'visual');
    if (hasVisualGate) {
      emit({ type: 'harness:learning', learning: 'Starting dev server for visual gate...' });
      await ensureDevServer(config.projectPath, devServer);
    }

    emit({ type: 'harness:started', config, plan });

    // Establish the run's durable identity.
    // - Adopted runId (resume/rehydrate): REOPEN the existing row (status→running,
    //   re-register live) so a paused/interrupted/stranded run continues as ONE
    //   run — no new id, no fragmented history. This is the hand-off from the
    //   stranded-run reaper: a reaped 'interrupted' row is resumable here.
    // - No runId (fresh or fork): mint one, INSERT a new row, and bind it to this
    //   statePath in run-meta (recording parentRunId for a fork's provenance).
    const startedAt = new Date().toISOString();
    if (runId) {
      let reopened = false;
      try { reopened = reopenRun(runId); } catch { /* history is best-effort */ }
      if (!reopened) {
        // The adopted row vanished — insert a fresh row under the SAME id so the
        // resume still records history rather than silently losing it.
        try {
          startRun({
            runId,
            projectName: config.projectName,
            projectPath: config.projectPath,
            startedAt,
            themeDirective: config.themeDirective ?? null,
            plan,
            cost: { ...cost, byArea: { ...cost.byArea } },
          });
        } catch { /* best-effort */ }
      }
      saveRunMeta(config.statePath, {
        runId, projectPath: config.projectPath, statePath: config.statePath, startedAt,
      });
    } else {
      runId = newRunId();
      try {
        startRun({
          runId,
          projectName: config.projectName,
          projectPath: config.projectPath,
          startedAt,
          themeDirective: config.themeDirective ?? null,
          plan,
          cost: { ...cost, byArea: { ...cost.byArea } },
        });
      } catch {
        // History is best-effort.
      }
      saveRunMeta(config.statePath, {
        runId, projectPath: config.projectPath, statePath: config.statePath, startedAt,
        ...(parentRunId ? { parentRunId } : {}),
      });
    }

    // Set up git checkpointing once, on the run's own `harness/<runId>` branch.
    if (checkpointEnabled && !checkpointer && runId) {
      const cp = createCheckpointer(runId, config.projectPath);
      const ok = await cp.init();
      if (ok) {
        checkpointer = cp;
        saveCheckpoints(config.statePath, cp.getState());
        emit({
          type: 'harness:learning',
          learning: `Git checkpointing enabled on branch ${checkpointBranch(runId)} — areas snapshot on pass, roll back to last green on promote-with-gaps`,
        });
      } else {
        emit({
          type: 'harness:learning',
          learning: 'Git checkpointing requested but disabled — project is not a git repo or has no commits',
        });
      }
    }

    while (plan.iteration < config.maxIterations) {
      if (paused) {
        emit({ type: 'harness:paused', reason: 'User requested pause' });
        persistTerminal('paused');
        break;
      }

      const passRate = planRatePct(plan, passRateBasis);
      if (passRate >= targetPassRatePct) {
        emit({ type: 'harness:completed', plan, guide });
        persistTerminal('completed');
        runId = null;
        break;
      }

      plan.iteration++;
      emit({ type: 'harness:planning', iteration: plan.iteration });

      // Check if any areas can run
      const candidates = pickNextAreas(plan, maxConcurrent, progress, maxRetries);
      if (candidates.length === 0) {
        // Try promoting failed areas that exhausted retries
        let promoted = false;
        for (const area of plan.areas) {
          if (area.status === 'failed') {
            const retries = getRetryCount(progress, area.id);
            if (retries >= maxRetries) {
              // Discard this area's broken work back to the last green checkpoint
              // before promoting-WITH-GAPS (see runStreamingPool for rationale):
              // 'completed-with-gaps' unblocks dependents but is excluded from
              // the pass-rate numerator.
              await rollbackBeforePromote(area.id, plan.iteration);
              area.status = 'completed-with-gaps';
              area.completedAt = plan.iteration;
              emit({ type: 'harness:area-completed', areaId: area.id, iteration: plan.iteration });
              emit({ type: 'harness:learning', learning: `Promoted-with-gaps ${area.id} to unblock dependents (excluded from pass-rate)` });
              promoted = true;
            } else {
              area.status = 'pending';
              promoted = true;
            }
          }
        }
        if (promoted) {
          updatePlanStats(plan);
          savePlan(config.statePath, plan);
          continue;
        }

        // Check if everything is done (a gapped area is terminal too)
        const allDone = plan.areas.every(
          a => a.status === 'completed' || a.status === 'completed-with-gaps',
        );
        if (allDone || plan.areas.filter(a => a.status === 'pending').length === 0) {
          emit({ type: 'harness:completed', plan, guide });
          persistTerminal('completed');
          runId = null;
          break;
        }

        // Safety: nothing can advance
        emit({ type: 'harness:error', error: 'No areas can advance — halting', fatal: true });
        persistTerminal('error', 'No areas can advance — halting');
        runId = null;
        break;
      }

      // Run streaming pool for this iteration
      savePlan(config.statePath, plan);
      await runStreamingPool(plan, progress, gates, guide);

      updatePlanStats(plan);
      savePlan(config.statePath, plan);
    }

    // Cleanup (dev server teardown happens in runLoopWithErrorCapture's
    // `finally` so it also covers every error/crash/early-return path).
    savePlan(config.statePath, plan);
    saveGuide(config.statePath, guide);
    emit({ type: 'harness:completed', plan, guide });
    // Falling out of the loop (maxIterations or all areas resolved) — also a
    // terminal completion. Idempotent if persistTerminal already fired above.
    if (runId) {
      persistTerminal('completed');
      runId = null;
    }
    return guide;
  }

  async function runLoopWithErrorCapture(): Promise<GameBuildGuide> {
    try {
      return await runLoop();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (runId) {
        persistTerminal('error', msg);
        runId = null;
      }
      throw err;
    } finally {
      // Tear down the dev server on EVERY exit path — normal completion,
      // pause/early-return breaks, and thrown/crashed errors — so we never
      // leak a `next dev` process bound to port 3000 across runs.
      killDevServer(devServer);
    }
  }

  return {
    async start() { paused = false; cost = loadCost(config.statePath, budgetUsd); cost.paused = false; checkpointer = null; return runLoopWithErrorCapture(); },
    pause() { paused = true; },
    async resume() { paused = false; cost.paused = false; saveCost(config.statePath, cost); return runLoopWithErrorCapture(); },
    getPlan() { return loadPlan(config.statePath); },
    getGuide() { return loadGuide(config.statePath); },
    getCost() { return { ...cost, byArea: { ...cost.byArea } }; },
    getRunId() { return runId; },
    getCheckpoints() { return checkpointer?.getState() ?? readCheckpoints(config.statePath); },
    on(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}

// ── Rehydration (resume after a process restart) ─────────────────────────────

export interface RehydratedRun {
  orchestrator: HarnessOrchestrator;
  runId: string;
  config: HarnessConfig;
}

/**
 * Rebuild an orchestrator for a run whose in-memory singleton was lost to a
 * process restart. Reads the durable `run-meta.json` (statePath ⇄ runId) and the
 * `harness-config.json` snapshot from disk and reconstructs the orchestrator
 * ADOPTING the same runId — so `resume()` continues the SAME run (its plan,
 * progress, cost, and history are all on disk). Returns null when no resumable
 * run is bound to this statePath.
 *
 * The stranded-run reaper marks a crashed run 'interrupted'; this is the path
 * that makes such a run resumable again (via `reopenRun` inside runLoop).
 */
export function rehydrateHarnessOrchestrator(statePath: string): RehydratedRun | null {
  const meta = readRunMeta(statePath);
  if (!meta) return null;
  const config = readConfigSnapshot(statePath);
  if (!config) return null;
  const orchestrator = createHarnessOrchestrator(config, { resumeRunId: meta.runId });
  return { orchestrator, runId: meta.runId, config };
}

// ── Default Config Factory ──────────────────────────────────────────────────

export function createDefaultConfig(overrides: Partial<HarnessConfig> & {
  projectPath: string;
  projectName: string;
  ueVersion: string;
  /** Opt-in the UE automation-test gate (advisory, behind the compile gate). */
  ueTests?: boolean;
  /** Automation test filter for the ue-test gate (default "Project"). */
  ueTestFilter?: string;
  /** Opt-in the advisory `ue-visual` game-runs gate (boots the game, judges a frame). */
  ueVisual?: boolean;
}): HarnessConfig {
  return {
    projectPath: overrides.projectPath,
    projectName: overrides.projectName,
    ueVersion: overrides.ueVersion,
    statePath: overrides.statePath ?? path.join(overrides.projectPath, '.harness'),
    executor: overrides.executor ?? {
      sessionTimeoutMs: 30 * 60 * 1000,
      maxRetriesPerArea: 3,
      allowedTools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],
      skipPermissions: true,
      bareMode: false,
    },
    gates: overrides.gates ?? detectGates(overrides.projectPath, {
      ...(overrides.ueTests != null ? { ueTests: overrides.ueTests } : {}),
      ...(overrides.ueTestFilter != null ? { ueTestFilter: overrides.ueTestFilter } : {}),
      ...(overrides.ueVisual != null ? { ueVisual: overrides.ueVisual } : {}),
    }),
    maxIterations: overrides.maxIterations ?? 100,
    generateGuide: overrides.generateGuide ?? true,
    updateAgentsMd: overrides.updateAgentsMd ?? true,
    // Canonicalize to 0–100 percent so a caller passing a 0–1 fraction (e.g. the
    // MCP tool's documented 0.9) doesn't terminate the loop at ~1% pass.
    targetPassRate: normalizePassRatePercent(overrides.targetPassRate ?? 90),
    // Stop condition uses the VERIFIED (gate-backed) numerator by default; a
    // caller can opt into legacy self-reported counting explicitly.
    passRateBasis: overrides.passRateBasis ?? 'verified',
    areas: overrides.areas,
    ...(overrides.budgetUsd != null ? { budgetUsd: overrides.budgetUsd } : {}),
    ...(overrides.unlimited != null ? { unlimited: overrides.unlimited } : {}),
    ...(overrides.themeDirective != null ? { themeDirective: overrides.themeDirective } : {}),
    ...(overrides.checkpoint != null ? { checkpoint: overrides.checkpoint } : {}),
  };
}
