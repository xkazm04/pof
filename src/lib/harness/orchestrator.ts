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
import { buildGamePlan, updatePlanStats } from './plan-builder';
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
import { startRun, finalizeRun, type HarnessRunStatus } from '@/lib/harness-runs-db';
import { readJsonFile, writeJsonFile } from './state-io';

// ── State I/O ───────────────────────────────────────────────────────────────

function planPath(sp: string) { return path.join(sp, 'game-plan.json'); }
function progressPath(sp: string) { return path.join(sp, 'progress.json'); }
function costPath(sp: string) { return path.join(sp, 'cost.json'); }
function checkpointsPath(sp: string) { return path.join(sp, 'checkpoints.json'); }

/** Persist the checkpoint ledger for auditability (best-effort, never throws). */
function saveCheckpoints(sp: string, state: CheckpointState): void {
  try { writeJsonFile(checkpointsPath(sp), state); } catch { /* */ }
}

/** Public read accessor for the checkpoint ledger (API + UI). */
export function readCheckpoints(statePath: string): CheckpointState | null {
  return readJsonFile<CheckpointState | null>(checkpointsPath(statePath), null);
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

let devServerProc: ChildProcess | null = null;

async function ensureDevServer(projectPath: string): Promise<void> {
  // Check if port 3000 is already responding
  const alive = await checkPort(3000);
  if (alive) return;

  if (devServerProc) {
    try { devServerProc.kill(); } catch { /* ignore */ }
  }

  return new Promise((resolve) => {
    devServerProc = spawn('npx', ['next', 'dev', '--port', '3000'], {
      cwd: projectPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      // On POSIX, detach so the child (and its `next dev` descendants) form a
      // process group we can tree-kill via `process.kill(-pid)` in
      // killDevServer; otherwise a SIGKILL to the shell would orphan node.
      // On Windows we keep the default and tree-kill with `taskkill /T`.
      detached: process.platform !== 'win32',
    });

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; resolve(); }
    }, 30_000);

    devServerProc.stdout?.on('data', (data: Buffer) => {
      if (!resolved && data.toString().includes('Ready')) {
        resolved = true;
        clearTimeout(timeout);
        resolve();
      }
    });

    devServerProc.on('error', () => {
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

function killDevServer() {
  if (devServerProc) {
    const proc = devServerProc;
    const pid = proc.pid;
    devServerProc = null;
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
async function attemptSelfHeal(
  projectPath: string,
  errors: string[],
  verifyCommand: string | null,
  config: { sessionTimeoutMs: number; skipPermissions: boolean },
): Promise<boolean> {
  const errorSummary = errors.slice(0, 20).join('\n');
  const verifyInstruction = verifyCommand
    ? `\n\nAfter fixing, verify by running: ${verifyCommand}\nIf there are remaining errors, fix those too. Do NOT give up — keep fixing until clean.`
    : `\n\nAfter fixing, re-read the affected files to confirm your changes look correct. Do NOT give up — keep fixing until you believe every error in the list above is resolved.`;
  const fixPrompt = `You are a code fixer. The following errors occurred after a code generation session.
Fix ALL errors. Do not add features, do not refactor — ONLY fix the errors.
Read each file mentioned in the errors, understand the issue, and apply minimal fixes.

ERRORS:
${errorSummary}${verifyInstruction}

When done, output exactly:
${wrapHarnessResult('{"areaId":"self-heal","completed":true,"features":[],"filesCreated":[],"filesModified":[],"learnings":[],"summary":"Fixed errors"}')}`;

  await spawnClaudeSession(fixPrompt, {
    cwd: projectPath,
    allowedTools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],
    skipPermissions: config.skipPermissions,
    enableMcp: true,
    timeoutMs: Math.min(config.sessionTimeoutMs, 300_000), // Max 5 min for fix
  });

  if (!verifyCommand) {
    // No reliable command to re-run — optimistically resolve as healed; the
    // next full verification pass will re-judge if the fix actually held.
    return true;
  }
  return new Promise<boolean>((resolve) => {
    exec(verifyCommand, { cwd: projectPath, timeout: 60_000 }, (err) => {
      resolve(err === null);
    });
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Soft dep resolution: both 'completed' and 'failed' (after max retries) count as resolved. */
function isDependencyResolved(plan: GamePlan, progress: ProgressEntry[], depId: string, maxRetries: number): boolean {
  const dep = plan.areas.find(a => a.id === depId);
  if (!dep) return true; // Unknown dep — don't block
  if (dep.status === 'completed') return true;
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

export function createHarnessOrchestrator(config: HarnessConfig): HarnessOrchestrator {
  const listeners = new Set<HarnessEventListener>();
  let paused = false;
  let runId: string | null = null;

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
  const areaPassThreshold = (config.executor.areaPassThreshold ?? config.targetPassRate) / 100;
  const maxRetries = config.executor.maxRetriesPerArea;
  const budgetUsd = typeof config.budgetUsd === 'number' && config.budgetUsd > 0 ? config.budgetUsd : null;

  if (!fs.existsSync(config.statePath)) {
    fs.mkdirSync(config.statePath, { recursive: true });
  }

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
      const failingResults = verification.gates.filter(g => !g.passed);
      const gateErrors = failingResults
        .flatMap(g => g.errors?.map(e => e.message) ?? [g.output.slice(0, 500)]);

      // Map failing VerificationResults back to their gate configs (with .command/.type).
      const failingGateConfigs = failingResults
        .map(r => gates.find(g => g.name === r.gate))
        .filter((g): g is NonNullable<typeof g> => !!g);
      const verifyCommand = pickHealVerifyCommand(failingGateConfigs, gates);

      if (gateErrors.length > 0) {
        emit({
          type: 'harness:learning',
          learning: `Self-healing: attempting to fix ${gateErrors.length} gate errors for ${area.id}`
            + (verifyCommand ? ` (verify: ${verifyCommand})` : ' (no verify command — optimistic)'),
        });

        const healed = await attemptSelfHeal(config.projectPath, gateErrors, verifyCommand, {
          sessionTimeoutMs: config.executor.sessionTimeoutMs,
          skipPermissions: config.executor.skipPermissions,
        });

        if (healed) {
          // Re-run verification after fix
          verification = await verify(area, plan.iteration, config.projectPath, gates, config.statePath);
          emit({
            type: 'harness:learning',
            learning: `Self-heal ${verification.requiredFailures === 0 ? 'SUCCEEDED' : 'partially helped'} for ${area.id}`,
          });
        }
      }
    }

    const verifySummary = formatVerificationSummary(verification);

    // ── Update features ────────────────────────────────────────────────────

    let matchedFeatures = 0;
    if (parsed.features) {
      for (const pf of parsed.features) {
        let planFeature = area.features.find(f => f.name === pf.name);
        if (!planFeature) {
          planFeature = area.features.find(f =>
            f.name.toLowerCase() === pf.name.toLowerCase() ||
            pf.name.toLowerCase().includes(f.name.toLowerCase()) ||
            f.name.toLowerCase().includes(pf.name.toLowerCase()),
          );
        }
        if (planFeature) {
          planFeature.status = pf.status === 'pass' ? 'pass' : 'fail';
          planFeature.quality = pf.quality;
          planFeature.lastSession = plan.iteration;
          if (pf.status === 'fail') planFeature.failReason = pf.notes;
          matchedFeatures++;
        }
      }

      const allParsedPass = parsed.features.every(f => f.status === 'pass');
      if (allParsedPass && matchedFeatures === 0 && parsed.features.length > 0) {
        for (const f of area.features) {
          f.status = 'pass';
          f.quality = 4;
          f.lastSession = plan.iteration;
        }
      }
    }

    // ── Outcome ────────────────────────────────────────────────────────────

    const passingCount = area.features.filter(f => f.status === 'pass').length;
    const totalCount = area.features.length;
    const featurePassRate = totalCount > 0 ? passingCount / totalCount : 0;
    const requiredGatesPassed = verification.requiredFailures === 0;
    const areaSuccess = requiredGatesPassed && featurePassRate >= areaPassThreshold;

    area.status = areaSuccess ? 'completed' : 'failed';
    if (areaSuccess) {
      area.completedAt = plan.iteration;
      for (const f of area.features) {
        if (f.status === 'pending') {
          f.status = 'pass';
          f.quality = 3;
          f.lastSession = plan.iteration;
        }
      }
    }

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
          // corrupt earlier passing areas. Then promote-with-gaps to unblock deps.
          await rollbackBeforePromote(result.area.id, plan.iteration);
          result.area.status = 'completed';
          result.area.completedAt = plan.iteration;
          emit({
            type: 'harness:area-completed',
            areaId: result.area.id,
            iteration: plan.iteration,
          });
          emit({
            type: 'harness:learning',
            learning: `Area ${result.area.id} promoted after ${retries} retries — dependents unblocked`,
          });
        }
      }

      // Save state after each area completes
      updatePlanStats(plan);
      savePlan(config.statePath, plan);
      emit({ type: 'harness:progress', plan });

      // Check pass rate
      const passRate = plan.totalFeatures > 0
        ? (plan.passingFeatures / plan.totalFeatures) * 100 : 0;
      if (passRate >= config.targetPassRate) break;

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
    // Heal areas stranded mid-flight by a crash or an old abandoning build:
    // pickNextAreas only picks 'pending', so a persisted 'in-progress' area
    // would never run again and the target pass rate becomes unreachable.
    for (const area of plan.areas) {
      if (area.status === 'in-progress') area.status = 'pending';
    }
    savePlan(config.statePath, plan);
    const guide = loadGuide(config.statePath) ?? createEmptyGuide(plan);
    saveGuide(config.statePath, guide);
    const progress = loadProgress(config.statePath);
    const gates = config.gates.length > 0 ? config.gates : detectGates(config.projectPath);

    // Start dev server for visual gate
    const hasVisualGate = gates.some(g => g.type === 'visual');
    if (hasVisualGate) {
      emit({ type: 'harness:learning', learning: 'Starting dev server for visual gate...' });
      await ensureDevServer(config.projectPath);
    }

    emit({ type: 'harness:started', config, plan });

    // Record a new row in `harness_runs` only on the initial start; resume()
    // reuses the same `runId` so its terminal snapshot overwrites the paused one.
    if (!runId) {
      runId = newRunId();
      const startedAt = new Date().toISOString();
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

      const passRate = plan.totalFeatures > 0
        ? (plan.passingFeatures / plan.totalFeatures) * 100 : 0;
      if (passRate >= config.targetPassRate) {
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
              // before promoting-with-gaps (see runStreamingPool for rationale).
              await rollbackBeforePromote(area.id, plan.iteration);
              area.status = 'completed';
              area.completedAt = plan.iteration;
              emit({ type: 'harness:area-completed', areaId: area.id, iteration: plan.iteration });
              emit({ type: 'harness:learning', learning: `Promoted ${area.id} to unblock dependents` });
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

        // Check if everything is done
        const allDone = plan.areas.every(a => a.status === 'completed');
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
      killDevServer();
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

// ── Default Config Factory ──────────────────────────────────────────────────

export function createDefaultConfig(overrides: Partial<HarnessConfig> & {
  projectPath: string;
  projectName: string;
  ueVersion: string;
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
    gates: overrides.gates ?? detectGates(overrides.projectPath),
    maxIterations: overrides.maxIterations ?? 100,
    generateGuide: overrides.generateGuide ?? true,
    updateAgentsMd: overrides.updateAgentsMd ?? true,
    evalPasses: overrides.evalPasses ?? ['structure', 'quality'],
    targetPassRate: overrides.targetPassRate ?? 90,
    areas: overrides.areas,
    ...(overrides.budgetUsd != null ? { budgetUsd: overrides.budgetUsd } : {}),
    ...(overrides.themeDirective != null ? { themeDirective: overrides.themeDirective } : {}),
    ...(overrides.checkpoint != null ? { checkpoint: overrides.checkpoint } : {}),
  };
}
