/**
 * Harness API — controls the autonomous game development loop.
 *
 * GET  /api/harness                          → current status (plan + guide summary)
 * GET  /api/harness?action=plan              → full game plan
 * GET  /api/harness?action=guide             → full guide markdown
 * GET  /api/harness?action=progress          → progress log
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
import { renderGuideMarkdown } from '@/lib/harness/guide-generator';
import { SCENARIOS, scenarioNames } from '@/lib/harness/scenarios';
import { reapStrandedRuns } from '@/lib/harness-runs-db';
import * as fs from 'fs';
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

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action');
  const config = globalForHarness.harnessConfig;
  const orchestrator = globalForHarness.harnessOrchestrator;

  // First status read after a crash/restart heals any `harness_runs` row left
  // stranded in 'running' (see reapStrandedRuns — excludes runs still live in
  // this process). Best-effort; never blocks the status response.
  try { reapStrandedRuns(); } catch { /* reaping is best-effort */ }

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

  if (action === 'progress' && config) {
    const progressFile = path.join(config.statePath, 'progress.json');
    if (!fs.existsSync(progressFile)) return apiSuccess([]);
    try {
      const entries = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
      return apiSuccess(entries);
    } catch {
      return apiSuccess([]);
    }
  }

  if (action === 'events') {
    return apiSuccess(globalForHarness.harnessEvents.slice(-50));
  }

  // Default: status summary
  const plan = orchestrator?.getPlan();
  const guide = orchestrator?.getGuide();
  const cost = orchestrator?.getCost?.() ?? null;
  const runId = orchestrator?.getRunId?.() ?? null;
  const checkpoints = orchestrator?.getCheckpoints?.() ?? null;

  return apiSuccess({
    status: globalForHarness.harnessStatus,
    runId,
    plan: plan ? {
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
    } : null,
    guide: guide ? {
      totalSteps: guide.steps.length,
      totalDurationMs: guide.totalDurationMs,
      lastStep: guide.steps[guide.steps.length - 1]?.label ?? null,
    } : null,
    cost: cost ? {
      spentUsd: Number(cost.spentUsd.toFixed(4)),
      budgetUsd: cost.budgetUsd,
      sessions: cost.sessions,
      paused: cost.paused,
      byArea: cost.byArea,
      remainingUsd: cost.budgetUsd != null ? Number((cost.budgetUsd - cost.spentUsd).toFixed(4)) : null,
    } : null,
    checkpoints: checkpoints ? {
      branch: checkpoints.branch,
      count: checkpoints.checkpoints.length,
      lastGreenSha: checkpoints.checkpoints.length > 0
        ? checkpoints.checkpoints[checkpoints.checkpoints.length - 1].sha
        : null,
      areas: checkpoints.checkpoints.map(c => ({ areaId: c.areaId, sha: c.sha, tag: c.tag, iteration: c.iteration })),
    } : null,
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
    const identity = resolveRunIdentity(config.statePath, {
      forceFork: body.fork === true,
      // Guard: a start with a different projectPath than this statePath's run
      // refuses (400 via the catch below) instead of resuming a mismatched run.
      projectPath: config.projectPath,
    });
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
