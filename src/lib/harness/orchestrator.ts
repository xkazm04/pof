/**
 * Harness Orchestrator — the brain of the autonomous game development loop.
 *
 * Implements the Plan → Execute → Verify cycle from Anthropic's harness
 * engineering research. Each iteration:
 *
 * 1. PLAN  — Pick the next module area (dependency-resolved)
 * 2. EXECUTE — Spawn a Claude Code session (claude -p) for the area
 * 3. VERIFY — Run quality gates (typecheck, lint, test, build)
 * 4. RECORD — Update plan, progress log, guide, and AGENTS.md
 *
 * State is persisted to JSON files between iterations, so the harness
 * can survive context resets and process restarts.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ProjectContext } from '@/lib/prompt-context';
import type {
  GamePlan,
  HarnessConfig,
  HarnessEvent,
  ModuleArea,
  ProgressEntry,
  VerificationReport,
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
import { verify, formatVerificationSummary, DEFAULT_GATES } from './verifier';
import {
  createEmptyGuide,
  appendGuideStep,
  loadGuide,
  saveGuide,
  renderGuideMarkdown,
} from './guide-generator';

// ── State File Paths ────────────────────────────────────────────────────────

function planPath(statePath: string): string {
  return path.join(statePath, 'game-plan.json');
}

function progressPath(statePath: string): string {
  return path.join(statePath, 'progress.json');
}

// ── State I/O ───────────────────────────────────────────────────────────────

function loadPlan(statePath: string): GamePlan | null {
  const p = planPath(statePath);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as GamePlan;
  } catch {
    return null;
  }
}

function savePlan(statePath: string, plan: GamePlan): void {
  fs.writeFileSync(planPath(statePath), JSON.stringify(plan, null, 2));
}

function loadProgress(statePath: string): ProgressEntry[] {
  const p = progressPath(statePath);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as ProgressEntry[];
  } catch {
    return [];
  }
}

function saveProgress(statePath: string, entries: ProgressEntry[]): void {
  fs.writeFileSync(progressPath(statePath), JSON.stringify(entries, null, 2));
}

function appendProgressEntry(statePath: string, entry: ProgressEntry): void {
  const entries = loadProgress(statePath);
  entries.push(entry);
  saveProgress(statePath, entries);
}

// ── Orchestrator ────────────────────────────────────────────────────────────

export type HarnessEventListener = (event: HarnessEvent) => void;

export interface HarnessOrchestrator {
  /** Start the autonomous build loop */
  start(): Promise<GameBuildGuide>;
  /** Pause after current iteration completes */
  pause(): void;
  /** Resume from paused state */
  resume(): Promise<GameBuildGuide>;
  /** Get current plan state */
  getPlan(): GamePlan | null;
  /** Get current guide state */
  getGuide(): GameBuildGuide | null;
  /** Subscribe to events */
  on(listener: HarnessEventListener): () => void;
}

export function createHarnessOrchestrator(
  config: HarnessConfig,
): HarnessOrchestrator {
  const listeners = new Set<HarnessEventListener>();
  let paused = false;

  const emit = (event: HarnessEvent) => {
    for (const l of listeners) {
      try { l(event); } catch { /* ignore */ }
    }
  };

  // Build project context for prompt assembly
  const ctx: ProjectContext = {
    projectName: config.projectName,
    projectPath: config.projectPath,
    ueVersion: config.ueVersion,
  };

  // Ensure state directory exists
  if (!fs.existsSync(config.statePath)) {
    fs.mkdirSync(config.statePath, { recursive: true });
  }

  // ── Core Loop ───────────────────────────────────────────────────────────

  async function runLoop(): Promise<GameBuildGuide> {
    // Load or create plan
    let plan = loadPlan(config.statePath) ?? buildGamePlan(config);
    savePlan(config.statePath, plan);

    // Load or create guide
    let guide = loadGuide(config.statePath) ?? createEmptyGuide(plan);
    saveGuide(config.statePath, guide);

    const progress = loadProgress(config.statePath);
    const gates = config.gates.length > 0 ? config.gates : DEFAULT_GATES;

    emit({ type: 'harness:started', config, plan });

    while (plan.iteration < config.maxIterations) {
      if (paused) {
        emit({ type: 'harness:paused', reason: 'User requested pause' });
        break;
      }

      // Check if we've hit the target pass rate
      const passRate = plan.totalFeatures > 0
        ? (plan.passingFeatures / plan.totalFeatures) * 100
        : 0;
      if (passRate >= config.targetPassRate) {
        emit({ type: 'harness:completed', plan, guide });
        break;
      }

      plan.iteration++;
      emit({ type: 'harness:planning', iteration: plan.iteration });

      // ── PLAN: Pick next area ──────────────────────────────────────────

      const area = pickNextArea(plan);
      if (!area) {
        // All areas either completed or blocked
        const anyFailed = plan.areas.some(a => a.status === 'failed');
        if (anyFailed) {
          emit({ type: 'harness:error', error: 'All remaining areas are blocked or failed', fatal: false });
          // Reset failed areas for retry
          for (const a of plan.areas) {
            if (a.status === 'failed') {
              a.status = 'pending';
            }
          }
          savePlan(config.statePath, plan);
          continue;
        }
        emit({ type: 'harness:completed', plan, guide });
        break;
      }

      emit({ type: 'harness:iteration', iteration: plan.iteration, areaId: area.id });

      // ── EXECUTE: Spawn Claude Code session ────────────────────────────

      area.status = 'in-progress';
      savePlan(config.statePath, plan);
      emit({ type: 'harness:executing', iteration: plan.iteration, areaId: area.id });

      const agentsMd = config.updateAgentsMd
        ? readAgentsMd(config.statePath)
        : '';

      const execResult = await executeArea(
        area,
        plan,
        progress,
        ctx,
        config.executor,
        agentsMd,
        (chunk) => {
          // Live output forwarding could go here
        },
        config.themeDirective,
      );

      // Parse structured result from executor output
      const parsed = parseAreaResult(execResult.assistantOutput);

      if (!execResult.completed || !parsed) {
        // Execution failed
        const retryCount = progress.filter(
          p => p.areaId === area.id && p.outcome === 'failure',
        ).length;

        const entry: ProgressEntry = {
          iteration: plan.iteration,
          timestamp: new Date().toISOString(),
          areaId: area.id,
          moduleId: area.moduleId,
          action: 'execute',
          outcome: 'failure',
          summary: `Execution ${execResult.completed ? 'completed but no result markers found' : 'failed'}. ${execResult.errors?.join('; ') ?? ''}`,
          durationMs: execResult.durationMs,
          featuresChanged: [],
          errors: execResult.errors,
        };

        appendProgressEntry(config.statePath, entry);
        progress.push(entry);

        if (retryCount >= config.executor.maxRetriesPerArea) {
          area.status = 'failed';
          emit({
            type: 'harness:area-failed',
            areaId: area.id,
            iteration: plan.iteration,
            reason: `Failed after ${retryCount + 1} attempts`,
          });
        } else {
          area.status = 'pending'; // Allow retry
          emit({
            type: 'harness:error',
            error: `Area ${area.id} execution failed (attempt ${retryCount + 1}/${config.executor.maxRetriesPerArea})`,
            fatal: false,
          });
        }

        savePlan(config.statePath, plan);
        continue;
      }

      // ── VERIFY: Run quality gates ─────────────────────────────────────

      emit({ type: 'harness:verifying', iteration: plan.iteration, areaId: area.id });

      const verification = await verify(
        area,
        plan.iteration,
        config.projectPath,
        gates,
      );

      const verifySummary = formatVerificationSummary(verification);

      // ── RECORD: Update all state ──────────────────────────────────────

      // Update feature statuses from parsed result
      if (parsed.features) {
        for (const pf of parsed.features) {
          const planFeature = area.features.find(f => f.name === pf.name);
          if (planFeature) {
            planFeature.status = pf.status === 'pass' ? 'pass' : 'fail';
            planFeature.quality = pf.quality;
            planFeature.lastSession = plan.iteration;
            if (pf.status === 'fail') {
              planFeature.failReason = pf.notes;
            }
          }
        }
      }

      // Determine area outcome
      const allFeaturesPassed = area.features.every(f => f.status === 'pass');
      const requiredGatesPassed = verification.requiredFailures === 0;
      const areaSuccess = allFeaturesPassed && requiredGatesPassed;

      area.status = areaSuccess ? 'completed' : 'failed';
      if (areaSuccess) {
        area.completedAt = plan.iteration;
      }

      updatePlanStats(plan);
      savePlan(config.statePath, plan);

      // Progress entry
      const entry: ProgressEntry = {
        iteration: plan.iteration,
        timestamp: new Date().toISOString(),
        areaId: area.id,
        moduleId: area.moduleId,
        action: 'execute',
        outcome: areaSuccess ? 'success' : 'partial',
        summary: `${parsed.summary}\n${verifySummary}`,
        durationMs: execResult.durationMs,
        featuresChanged: parsed.features?.map(f => f.name) ?? [],
        errors: verification.gates.filter(g => !g.passed).map(g => g.output.slice(0, 200)),
        learnings: parsed.learnings,
      };

      appendProgressEntry(config.statePath, entry);
      progress.push(entry);

      // Update AGENTS.md with learnings
      if (config.updateAgentsMd && parsed.learnings && parsed.learnings.length > 0) {
        appendAgentsMd(config.statePath, parsed.learnings);
        emit({ type: 'harness:learning', learning: parsed.learnings.join('; ') });
      }

      // Update guide
      if (config.generateGuide && areaSuccess) {
        const step = appendGuideStep(guide, area, parsed, verification, entry);
        saveGuide(config.statePath, guide);
        emit({ type: 'harness:guide-updated', step });
      }

      // Emit area result
      if (areaSuccess) {
        emit({ type: 'harness:area-completed', areaId: area.id, iteration: plan.iteration });
      } else {
        // If verification failed but execution succeeded, allow retry
        const retryCount = progress.filter(
          p => p.areaId === area.id && p.outcome !== 'success',
        ).length;

        if (retryCount < config.executor.maxRetriesPerArea) {
          area.status = 'pending';
          savePlan(config.statePath, plan);
        }

        emit({
          type: 'harness:area-failed',
          areaId: area.id,
          iteration: plan.iteration,
          reason: `Verification failed: ${verification.requiredFailures} required gates failed`,
        });
      }

      emit({ type: 'harness:progress', plan });
    }

    // Final save
    savePlan(config.statePath, plan);
    saveGuide(config.statePath, guide);

    emit({ type: 'harness:completed', plan, guide });
    return guide;
  }

  // ── Public Interface ────────────────────────────────────────────────────

  return {
    async start() {
      paused = false;
      return runLoop();
    },

    pause() {
      paused = true;
    },

    async resume() {
      paused = false;
      return runLoop();
    },

    getPlan() {
      return loadPlan(config.statePath);
    },

    getGuide() {
      return loadGuide(config.statePath);
    },

    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
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
      sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes per area
      maxRetriesPerArea: 3,
      allowedTools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],
      skipPermissions: true,
      bareMode: false, // Keep skills and CLAUDE.md for richer context
    },
    gates: overrides.gates ?? DEFAULT_GATES,
    maxIterations: overrides.maxIterations ?? 100,
    generateGuide: overrides.generateGuide ?? true,
    updateAgentsMd: overrides.updateAgentsMd ?? true,
    evalPasses: overrides.evalPasses ?? ['structure', 'quality'],
    targetPassRate: overrides.targetPassRate ?? 90,
    areas: overrides.areas,
  };
}
