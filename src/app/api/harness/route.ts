/**
 * Harness API — controls the autonomous game development loop.
 *
 * GET  /api/harness                          → current status (plan + guide summary)
 * GET  /api/harness?action=plan              → full game plan
 * GET  /api/harness?action=guide             → full guide markdown
 * GET  /api/harness?action=progress          → progress log
 * GET  /api/harness?statePath=<dir>[&action] → the same reads from the DURABLE sidecars on
 *                                              disk (also the default when no in-memory run exists)
 * POST /api/harness  { action: 'start', ... } → start harness
 * POST /api/harness  { action: 'pause' }     → pause harness
 * POST /api/harness  { action: 'resume' }    → resume harness
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  createHarnessOrchestrator,
  createDefaultConfig,
  rehydrateHarnessOrchestrator,
  resolveRunIdentity,
  type HarnessOrchestrator,
  type HarnessConfig,
  type HarnessEvent,
  type GamePlan,
  type GameBuildGuide,
} from '@/lib/harness';
import { renderGuideMarkdown, loadGuide } from '@/lib/harness/guide-generator';
import {
  readHarnessPlan,
  readHarnessCost,
  readCheckpoints,
  readRunMeta,
  isResumableStatus,
} from '@/lib/harness/orchestrator';
import type { CheckpointState } from '@/lib/harness/checkpoint';
import { SCENARIOS, scenarioNames } from '@/lib/harness/scenarios';
import { readJsonFileState } from '@/lib/harness/state-io';
import type { HarnessCostTotals, ProgressEntry } from '@/lib/harness/types';
import { reapStrandedRuns, getRun } from '@/lib/harness-runs-db';
import * as path from 'path';

// ── Singleton State ─────────────────────────────────────────────────────────

const globalForHarness = globalThis as unknown as {
  harnessOrchestrator: HarnessOrchestrator | undefined;
  harnessConfig: HarnessConfig | undefined;
  harnessStatus: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  harnessEvents: HarnessEvent[];
};

if (!globalForHarness.harnessStatus) {
  globalForHarness.harnessStatus = 'idle';
  globalForHarness.harnessEvents = [];
}

/**
 * Subscribe the global event buffer + status tracker to an orchestrator. Shared
 * by `start` and the post-restart `resume` rehydrate path so a rehydrated run's
 * events + status transitions are tracked identically to a freshly-started one.
 */
function wireOrchestratorEvents(orchestrator: HarnessOrchestrator): void {
  orchestrator.on((event) => {
    globalForHarness.harnessEvents.push(event);
    if (globalForHarness.harnessEvents.length > 200) {
      globalForHarness.harnessEvents = globalForHarness.harnessEvents.slice(-100);
    }
    switch (event.type) {
      case 'harness:started':
        globalForHarness.harnessStatus = 'running';
        break;
      case 'harness:paused':
        globalForHarness.harnessStatus = 'paused';
        break;
      case 'harness:completed':
        globalForHarness.harnessStatus = 'completed';
        break;
      case 'harness:error':
        if (event.fatal) globalForHarness.harnessStatus = 'error';
        break;
    }
  });
}

// ── GET ─────────────────────────────────────────────────────────────────────

/** The plan block of the status summary — one shape for the in-memory and the on-disk read. */
function summarizePlan(plan: GamePlan) {
  return {
    game: plan.game,
    iteration: plan.iteration,
    totalFeatures: plan.totalFeatures,
    passingFeatures: plan.passingFeatures,
    verifiedFeatures: plan.verifiedFeatures ?? 0,
    // `passRate` kept for backward compat = self-reported. Both bases are also
    // reported explicitly and clearly labeled so a consumer (UI / MCP) can show
    // the honest verified number vs the executor's self-report.
    passRate: plan.totalFeatures > 0
      ? Math.round((plan.passingFeatures / plan.totalFeatures) * 100)
      : 0,
    selfReportedPassRate: plan.totalFeatures > 0
      ? Math.round((plan.passingFeatures / plan.totalFeatures) * 100)
      : 0,
    verifiedPassRate: plan.totalFeatures > 0
      ? Math.round(((plan.verifiedFeatures ?? 0) / plan.totalFeatures) * 100)
      : 0,
    totalAreas: plan.areas.length,
    completedAreas: plan.areas.filter(a => a.status === 'completed').length,
    failedAreas: plan.areas.filter(a => a.status === 'failed').length,
    gappedAreas: plan.areas.filter(a => a.status === 'completed-with-gaps').length,
    currentArea: plan.areas.find(a => a.status === 'in-progress')?.label ?? null,
  };
}

function summarizeGuide(guide: GameBuildGuide) {
  return {
    totalSteps: guide.steps.length,
    totalDurationMs: guide.totalDurationMs,
    lastStep: guide.steps[guide.steps.length - 1]?.label ?? null,
  };
}

function summarizeCost(cost: HarnessCostTotals) {
  return {
    spentUsd: Number(cost.spentUsd.toFixed(4)),
    budgetUsd: cost.budgetUsd,
    sessions: cost.sessions,
    paused: cost.paused,
    byArea: cost.byArea,
    remainingUsd: cost.budgetUsd != null ? Number((cost.budgetUsd - cost.spentUsd).toFixed(4)) : null,
  };
}

function summarizeCheckpoints(checkpoints: CheckpointState) {
  return {
    branch: checkpoints.branch,
    count: checkpoints.checkpoints.length,
    lastGreenSha: checkpoints.checkpoints.length > 0
      ? checkpoints.checkpoints[checkpoints.checkpoints.length - 1].sha
      : null,
    areas: checkpoints.checkpoints.map(c => ({ areaId: c.areaId, sha: c.sha, tag: c.tag, iteration: c.iteration })),
  };
}

/**
 * Read the progress log honouring the state-io contract: `missing` is a
 * legitimate empty log (first run); `corrupt` is NOT — a truncated
 * progress.json read as `[]` would tell the UI / MCP that nothing ever ran.
 */
function progressResponse(statePath: string) {
  const read = readJsonFileState<ProgressEntry[]>(path.join(statePath, 'progress.json'), []);
  if (read.state === 'corrupt') {
    return apiError(`Harness progress log is CORRUPT at ${statePath}/progress.json — ${read.error ?? 'unparseable'}`, 500);
  }
  return apiSuccess(read.value);
}

/**
 * The DISK read of the control surface. After a server restart the in-memory
 * orchestrator is gone, but every run leaves durable sidecars under its
 * statePath (`run-meta.json`, `game-plan.json`, `cost.json`,
 * `checkpoints.json`, `guide.json`, `progress.json`). Serving the same
 * summary shape from those files is what lets a status read after a restart
 * report "a resumable run is bound to this path" instead of `idle` — the
 * same information `action:'resume'` rehydrates from, exposed READ-only.
 * `source:'disk'` says which read the caller got; `resumable` mirrors
 * `resolveRunIdentity` (a run-meta whose DB row is gone still resumes).
 */
function respondFromDisk(action: string | null, statePath: string) {
  if (action === 'plan') {
    const plan = readHarnessPlan(statePath);
    if (!plan) return apiError(`No plan on disk at ${statePath}`, 404);
    return apiSuccess(plan);
  }
  if (action === 'guide') {
    const guide = loadGuide(statePath);
    if (!guide) return apiError(`No guide on disk at ${statePath}`, 404);
    return apiSuccess({ guide, markdown: renderGuideMarkdown(guide) });
  }
  if (action === 'progress') return progressResponse(statePath);
  if (action === 'events') {
    // Events are process-local (never persisted) — the buffer, whatever run it holds.
    return apiSuccess(globalForHarness.harnessEvents.slice(-50));
  }

  const meta = readRunMeta(statePath);
  const row = meta ? getRun(meta.runId) : null;
  const plan = readHarnessPlan(statePath);
  const guide = loadGuide(statePath);
  const cost = readHarnessCost(statePath);
  const checkpoints = readCheckpoints(statePath);
  return apiSuccess({
    status: globalForHarness.harnessStatus,
    source: 'disk' as const,
    statePath,
    runId: meta?.runId ?? null,
    runMeta: meta,
    /** The `harness_runs` row's own word for the run, or null when the row is gone. */
    runStatus: row?.status ?? null,
    /** True when `action:'resume'` with this statePath would continue this run (same rule as resolveRunIdentity). */
    resumable: !!meta && (!row || isResumableStatus(row.status)),
    plan: plan ? summarizePlan(plan) : null,
    guide: guide ? summarizeGuide(guide) : null,
    cost: cost ? summarizeCost(cost) : null,
    checkpoints: checkpoints ? summarizeCheckpoints(checkpoints) : null,
    recentEvents: globalForHarness.harnessEvents.slice(-10),
  });
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action');
  const config = globalForHarness.harnessConfig;
  const orchestrator = globalForHarness.harnessOrchestrator;

  // First status read after a crash/restart heals any `harness_runs` row left
  // stranded in 'running' (see reapStrandedRuns — excludes runs still live in
  // this process). Best-effort; never blocks the status response.
  try { reapStrandedRuns(); } catch { /* reaping is best-effort */ }

  // An explicit `?statePath=` always reads the durable sidecars (the screenshot
  // routes take the same override); with no in-memory orchestrator, the last
  // config's statePath is read from disk too. Only a live in-memory run with no
  // override answers from memory.
  const override = request.nextUrl.searchParams.get('statePath');
  const diskPath = override || (!orchestrator ? config?.statePath ?? null : null);
  if (diskPath) return respondFromDisk(action, diskPath);

  if (action === 'plan' && orchestrator) {
    const plan = orchestrator.getPlan();
    if (!plan) return apiError('No plan loaded', 404);
    return apiSuccess(plan);
  }

  if (action === 'guide' && orchestrator) {
    const guide = orchestrator.getGuide();
    if (!guide) return apiError('No guide generated yet', 404);
    const markdown = renderGuideMarkdown(guide);
    return apiSuccess({ guide, markdown });
  }

  if (action === 'progress' && config) return progressResponse(config.statePath);

  if (action === 'events') {
    return apiSuccess(globalForHarness.harnessEvents.slice(-50));
  }

  // Default: status summary from the live orchestrator
  const plan = orchestrator?.getPlan();
  const guide = orchestrator?.getGuide();
  const cost = orchestrator?.getCost?.() ?? null;
  const runId = orchestrator?.getRunId?.() ?? null;
  const checkpoints = orchestrator?.getCheckpoints?.() ?? null;

  return apiSuccess({
    status: globalForHarness.harnessStatus,
    source: 'memory' as const,
    runId,
    plan: plan ? summarizePlan(plan) : null,
    guide: guide ? summarizeGuide(guide) : null,
    cost: cost ? summarizeCost(cost) : null,
    checkpoints: checkpoints ? summarizeCheckpoints(checkpoints) : null,
    recentEvents: globalForHarness.harnessEvents.slice(-10),
  });
}

// ── POST ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    action: 'start' | 'pause' | 'resume';
    projectPath?: string;
    projectName?: string;
    ueVersion?: string;
    statePath?: string;
    maxIterations?: number;
    targetPassRate?: number;
    sessionTimeoutMs?: number;
    budgetUsd?: number;
    unlimited?: boolean;
    checkpoint?: boolean;
    maxConcurrent?: number;
    scenario?: string;
    ueTests?: boolean;
    ueTestFilter?: string;
    ueVisual?: boolean;
    themeDirective?: string;
    areaPassThreshold?: number;
    passRateBasis?: 'verified' | 'self-reported';
    /** Force a fresh forked run (new runId → parent) even over a resumable statePath. */
    fork?: boolean;
  };

  // Shared validation cap for the free-text creative direction so an unbounded
  // string can't be smuggled into every executor prompt.
  const THEME_DIRECTIVE_MAX = 2000;

  if (body.action === 'start') {
    if (globalForHarness.harnessStatus === 'running') {
      return apiError('Harness is already running', 409);
    }

    if (!body.projectPath || !body.projectName || !body.ueVersion) {
      return apiError('Missing required fields: projectPath, projectName, ueVersion', 400);
    }

    // Validate the new steering levers loudly rather than silently coercing.
    if (body.themeDirective != null) {
      if (typeof body.themeDirective !== 'string' || body.themeDirective.length > THEME_DIRECTIVE_MAX) {
        return apiError(`themeDirective must be a string of at most ${THEME_DIRECTIVE_MAX} characters`, 400);
      }
    }
    if (body.areaPassThreshold != null) {
      const t = body.areaPassThreshold;
      // Accepts a 0–1 fraction OR a 0–100 percent (normalizePassRatePercent
      // canonicalizes downstream); reject non-finite / non-positive / >100.
      if (typeof t !== 'number' || !Number.isFinite(t) || t <= 0 || t > 100) {
        return apiError('areaPassThreshold must be a number in (0, 100] (a 0–1 fraction or a 0–100 percent)', 400);
      }
    }
    if (body.passRateBasis != null && body.passRateBasis !== 'verified' && body.passRateBasis !== 'self-reported') {
      return apiError('passRateBasis must be "verified" or "self-reported"', 400);
    }

    // Scenario selection (Direction 1c) — the same curated area sets the CLI
    // exposes are now reachable from the API. Reject an unknown name loudly.
    let scenarioAreas;
    if (body.scenario) {
      const def = SCENARIOS[body.scenario];
      if (!def) {
        return apiError(`Unknown scenario "${body.scenario}". Available: ${scenarioNames().join(', ')}`, 400);
      }
      scenarioAreas = def.areas;
    }

    // Build the executor block unconditionally so maxConcurrent (Direction 1b)
    // is reachable even when sessionTimeoutMs is omitted; previously it was only
    // built when a timeout was passed, so the API could never raise concurrency.
    const executorOverride = (body.sessionTimeoutMs != null || body.maxConcurrent != null || body.areaPassThreshold != null)
      ? {
          sessionTimeoutMs: body.sessionTimeoutMs ?? 30 * 60 * 1000,
          maxRetriesPerArea: 3,
          allowedTools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],
          skipPermissions: true,
          bareMode: false,
          ...(body.maxConcurrent != null ? { maxConcurrent: body.maxConcurrent } : {}),
          ...(body.areaPassThreshold != null ? { areaPassThreshold: body.areaPassThreshold } : {}),
        }
      : undefined;

    const config = createDefaultConfig({
      projectPath: body.projectPath,
      projectName: body.projectName,
      ueVersion: body.ueVersion,
      statePath: body.statePath,
      maxIterations: body.maxIterations,
      targetPassRate: body.targetPassRate,
      ...(body.budgetUsd != null ? { budgetUsd: body.budgetUsd } : {}),
      ...(body.unlimited != null ? { unlimited: body.unlimited } : {}),
      ...(body.checkpoint != null ? { checkpoint: body.checkpoint } : {}),
      ...(scenarioAreas ? { areas: scenarioAreas } : {}),
      ...(body.ueTests != null ? { ueTests: body.ueTests } : {}),
      ...(body.ueTestFilter != null ? { ueTestFilter: body.ueTestFilter } : {}),
      ...(body.ueVisual != null ? { ueVisual: body.ueVisual } : {}),
      ...(body.themeDirective != null ? { themeDirective: body.themeDirective } : {}),
      ...(body.passRateBasis != null ? { passRateBasis: body.passRateBasis } : {}),
      executor: executorOverride,
    });

    globalForHarness.harnessConfig = config;
    globalForHarness.harnessEvents = [];

    // Durable identity: a start pointed at an existing statePath RESUMES the same
    // run (same runId) rather than silently minting a new one and fragmenting
    // history. A prior TERMINAL run at the statePath forks with recorded
    // provenance; `fork: true` forces a fork even from a resumable run.
    // Guard: a start with a different projectPath than this statePath's run
    // REFUSES (resolveRunIdentity throws) instead of resuming a mismatched run.
    // The throw must become a 400 — uncaught it is a 500 with no body, and the
    // caller (UI / pof_harness_start) never learns which run owns the path.
    let identity: ReturnType<typeof resolveRunIdentity>;
    try {
      identity = resolveRunIdentity(config.statePath, {
        forceFork: body.fork === true,
        projectPath: config.projectPath,
      });
    } catch (err) {
      return apiError(err instanceof Error ? err.message : String(err), 400);
    }
    const orchestrator = createHarnessOrchestrator(config, {
      ...(identity.resumeRunId ? { resumeRunId: identity.resumeRunId } : {}),
      ...(identity.parentRunId ? { parentRunId: identity.parentRunId } : {}),
    });
    globalForHarness.harnessOrchestrator = orchestrator;

    wireOrchestratorEvents(orchestrator);

    globalForHarness.harnessStatus = 'running';

    // Fire and forget — don't await the loop
    orchestrator.start().catch((err) => {
      globalForHarness.harnessStatus = 'error';
      globalForHarness.harnessEvents.push({
        type: 'harness:error',
        error: err instanceof Error ? err.message : String(err),
        fatal: true,
      });
    });

    return apiSuccess({
      status: 'started',
      mode: identity.mode,
      ...(identity.resumeRunId ? { resumedRunId: identity.resumeRunId } : {}),
      ...(identity.parentRunId ? { parentRunId: identity.parentRunId } : {}),
      message: identity.mode === 'resume'
        ? 'Resumed the existing run at this statePath (same runId) — poll GET /api/harness for progress'
        : identity.mode === 'fork'
          ? 'Forked a new run from the prior run at this statePath (provenance recorded) — poll GET /api/harness'
          : 'Harness loop started — poll GET /api/harness for progress',
    });
  }

  if (body.action === 'pause') {
    const orchestrator = globalForHarness.harnessOrchestrator;
    if (!orchestrator || globalForHarness.harnessStatus !== 'running') {
      return apiError('Harness is not running', 409);
    }
    orchestrator.pause();
    return apiSuccess({ status: 'pausing', message: 'Will pause after current iteration completes' });
  }

  if (body.action === 'resume') {
    let orchestrator = globalForHarness.harnessOrchestrator;
    let rehydrated = false;

    // DURABLE RESUME: after a process restart the in-memory orchestrator is gone.
    // Rehydrate it from disk (run-meta + config snapshot) so the SAME run
    // continues — this also picks up a reaped 'interrupted' row and makes it live
    // again. The stranded in-progress→pending healing runs inside runLoop.
    if (!orchestrator) {
      const statePath = body.statePath ?? globalForHarness.harnessConfig?.statePath;
      if (!statePath) {
        return apiError('Harness is not running and no statePath was provided to rehydrate a resumable run', 409);
      }
      const rh = rehydrateHarnessOrchestrator(statePath);
      if (!rh) {
        return apiError('No resumable run found at the given statePath (missing run-meta or config snapshot)', 404);
      }
      orchestrator = rh.orchestrator;
      globalForHarness.harnessOrchestrator = orchestrator;
      globalForHarness.harnessConfig = rh.config;
      globalForHarness.harnessEvents = [];
      wireOrchestratorEvents(orchestrator);
      rehydrated = true;
    } else if (globalForHarness.harnessStatus !== 'paused') {
      return apiError('Harness is not paused', 409);
    }

    globalForHarness.harnessStatus = 'running';

    orchestrator.resume().catch((err) => {
      globalForHarness.harnessStatus = 'error';
      globalForHarness.harnessEvents.push({
        type: 'harness:error',
        error: err instanceof Error ? err.message : String(err),
        fatal: true,
      });
    });

    return apiSuccess({
      status: 'resumed',
      rehydrated,
      runId: orchestrator.getRunId(),
      message: rehydrated ? 'Rehydrated + resumed the run from disk (same runId)' : 'Harness resumed',
    });
  }

  return apiError(`Unknown action: ${body.action}`, 400);
}
