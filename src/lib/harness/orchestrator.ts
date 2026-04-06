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
import * as path from 'path';
import { exec, spawn, type ChildProcess } from 'child_process';
import type { ProjectContext } from '@/lib/prompt-context';
import type {
  GamePlan,
  HarnessConfig,
  HarnessEvent,
  ModuleArea,
  ProgressEntry,
} from './types';
import type { GameBuildGuide } from './types';
import { buildGamePlan, pickNextArea, updatePlanStats } from './plan-builder';
import {
  executeArea,
  parseAreaResult,
  readAgentsMd,
  appendAgentsMd,
  type ParsedAreaResult,
} from './executor';
import { verify, formatVerificationSummary, detectGates } from './verifier';
import {
  createEmptyGuide,
  appendGuideStep,
  loadGuide,
  saveGuide,
} from './guide-generator';

// ── State I/O ───────────────────────────────────────────────────────────────

function planPath(sp: string) { return path.join(sp, 'game-plan.json'); }
function progressPath(sp: string) { return path.join(sp, 'progress.json'); }

function loadPlan(sp: string): GamePlan | null {
  try { return JSON.parse(fs.readFileSync(planPath(sp), 'utf-8')); } catch { return null; }
}
function savePlan(sp: string, plan: GamePlan) {
  fs.writeFileSync(planPath(sp), JSON.stringify(plan, null, 2));
}
function loadProgress(sp: string): ProgressEntry[] {
  try { return JSON.parse(fs.readFileSync(progressPath(sp), 'utf-8')); } catch { return []; }
}
function saveProgress(sp: string, entries: ProgressEntry[]) {
  fs.writeFileSync(progressPath(sp), JSON.stringify(entries, null, 2));
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
      detached: false,
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
    const req = require('http').get(`http://localhost:${port}`, () => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

function killDevServer() {
  if (devServerProc) {
    try { devServerProc.kill(); } catch { /* ignore */ }
    devServerProc = null;
  }
}

// ── Self-Healing Fix Session ────────────────────────────────────────────────

/**
 * When verification fails with typecheck/lint errors, spawn a quick fix session.
 * Returns true if the fix succeeded (gates pass after fix).
 */
async function attemptSelfHeal(
  projectPath: string,
  errors: string[],
  config: { sessionTimeoutMs: number; skipPermissions: boolean },
): Promise<boolean> {
  const errorSummary = errors.slice(0, 20).join('\n');
  const fixPrompt = `You are a code fixer. The following typecheck/lint errors occurred after a code generation session.
Fix ALL errors. Do not add features, do not refactor — ONLY fix the errors.
Read each file mentioned in the errors, understand the issue, and apply minimal fixes.

ERRORS:
${errorSummary}

After fixing, verify by running: npx tsc --noEmit
If there are remaining errors, fix those too. Do NOT give up — keep fixing until clean.

When done, output exactly:
@@HARNESS_RESULT
{"areaId":"self-heal","completed":true,"features":[],"filesCreated":[],"filesModified":[],"learnings":[],"summary":"Fixed errors"}
@@END_HARNESS_RESULT`;

  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'claude.cmd' : 'claude';
    const args = ['-p', '-', '--output-format', 'stream-json'];
    if (config.skipPermissions) args.push('--dangerously-skip-permissions');
    args.push('--allowedTools', 'Bash,Read,Edit,Write,Glob,Grep');

    const proc = spawn(command, args, {
      cwd: projectPath,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWindows,
    });

    proc.stdin.write(fixPrompt);
    proc.stdin.end();

    const timeout = setTimeout(() => {
      try { proc.kill('SIGTERM'); } catch { /* */ }
    }, Math.min(config.sessionTimeoutMs, 300_000)); // Max 5 min for fix

    proc.on('close', () => {
      clearTimeout(timeout);
      // Verify fix worked by running typecheck
      exec('npx tsc --noEmit', { cwd: projectPath, timeout: 60_000 }, (err) => {
        resolve(err === null); // true if typecheck passes
      });
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
  on(listener: HarnessEventListener): () => void;
}

export function createHarnessOrchestrator(config: HarnessConfig): HarnessOrchestrator {
  const listeners = new Set<HarnessEventListener>();
  let paused = false;

  const emit = (event: HarnessEvent) => {
    for (const l of listeners) { try { l(event); } catch { /* */ } }
  };

  const ctx: ProjectContext = {
    projectName: config.projectName,
    projectPath: config.projectPath,
    ueVersion: config.ueVersion,
  };

  const maxConcurrent = config.executor.maxConcurrent ?? 1;
  const areaPassThreshold = (config.executor.areaPassThreshold ?? config.targetPassRate) / 100;
  const maxRetries = config.executor.maxRetriesPerArea;

  if (!fs.existsSync(config.statePath)) {
    fs.mkdirSync(config.statePath, { recursive: true });
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
      const gateErrors = verification.gates
        .filter(g => !g.passed)
        .flatMap(g => g.errors?.map(e => e.message) ?? [g.output.slice(0, 500)]);

      if (gateErrors.length > 0) {
        emit({
          type: 'harness:learning',
          learning: `Self-healing: attempting to fix ${gateErrors.length} gate errors for ${area.id}`,
        });

        const healed = await attemptSelfHeal(config.projectPath, gateErrors, {
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
      saveGuide(config.statePath, guide);
      emit({ type: 'harness:guide-updated', step });
    }

    if (areaSuccess) {
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
        const candidates = pickNextAreas(plan, maxConcurrent - active.size, progress, maxRetries);
        // Don't pick areas already in the active pool
        const next = candidates.find(a => !active.has(a.id));
        if (!next) break;

        emit({ type: 'harness:iteration', iteration: plan.iteration, areaId: next.id });
        const promise = processArea(next, plan, progress, gates, guide)
          .then(result => ({ area: next, result }))
          .catch(() => ({ area: next, result: 'failed' as const }));
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
          // Exhausted retries — promote to completed with gaps
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
  }

  // ── Core Loop ───────────────────────────────────────────────────────────

  async function runLoop(): Promise<GameBuildGuide> {
    const plan = loadPlan(config.statePath) ?? buildGamePlan(config);
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

    while (plan.iteration < config.maxIterations) {
      if (paused) {
        emit({ type: 'harness:paused', reason: 'User requested pause' });
        break;
      }

      const passRate = plan.totalFeatures > 0
        ? (plan.passingFeatures / plan.totalFeatures) * 100 : 0;
      if (passRate >= config.targetPassRate) {
        emit({ type: 'harness:completed', plan, guide });
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
          break;
        }

        // Safety: nothing can advance
        emit({ type: 'harness:error', error: 'No areas can advance — halting', fatal: true });
        break;
      }

      // Run streaming pool for this iteration
      savePlan(config.statePath, plan);
      await runStreamingPool(plan, progress, gates, guide);

      updatePlanStats(plan);
      savePlan(config.statePath, plan);
    }

    // Cleanup
    killDevServer();
    savePlan(config.statePath, plan);
    saveGuide(config.statePath, guide);
    emit({ type: 'harness:completed', plan, guide });
    return guide;
  }

  return {
    async start() { paused = false; return runLoop(); },
    pause() { paused = true; },
    async resume() { paused = false; return runLoop(); },
    getPlan() { return loadPlan(config.statePath); },
    getGuide() { return loadGuide(config.statePath); },
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
  };
}
