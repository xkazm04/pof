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
  type HarnessOrchestrator,
  type HarnessConfig,
  type HarnessEvent,
  type GamePlan,
  type GameBuildGuide,
} from '@/lib/harness';
import { renderGuideMarkdown } from '@/lib/harness/guide-generator';
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

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action');
  const config = globalForHarness.harnessConfig;
  const orchestrator = globalForHarness.harnessOrchestrator;

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

  return apiSuccess({
    status: globalForHarness.harnessStatus,
    plan: plan ? {
      game: plan.game,
      iteration: plan.iteration,
      totalFeatures: plan.totalFeatures,
      passingFeatures: plan.passingFeatures,
      passRate: plan.totalFeatures > 0
        ? Math.round((plan.passingFeatures / plan.totalFeatures) * 100)
        : 0,
      totalAreas: plan.areas.length,
      completedAreas: plan.areas.filter(a => a.status === 'completed').length,
      failedAreas: plan.areas.filter(a => a.status === 'failed').length,
      currentArea: plan.areas.find(a => a.status === 'in-progress')?.label ?? null,
    } : null,
    guide: guide ? {
      totalSteps: guide.steps.length,
      totalDurationMs: guide.totalDurationMs,
      lastStep: guide.steps[guide.steps.length - 1]?.label ?? null,
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
  };

  if (body.action === 'start') {
    if (globalForHarness.harnessStatus === 'running') {
      return apiError('Harness is already running', 409);
    }

    if (!body.projectPath || !body.projectName || !body.ueVersion) {
      return apiError('Missing required fields: projectPath, projectName, ueVersion', 400);
    }

    const config = createDefaultConfig({
      projectPath: body.projectPath,
      projectName: body.projectName,
      ueVersion: body.ueVersion,
      statePath: body.statePath,
      maxIterations: body.maxIterations,
      targetPassRate: body.targetPassRate,
      executor: body.sessionTimeoutMs ? {
        sessionTimeoutMs: body.sessionTimeoutMs,
        maxRetriesPerArea: 3,
        allowedTools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],
        skipPermissions: true,
        bareMode: false,
      } : undefined,
    });

    globalForHarness.harnessConfig = config;
    globalForHarness.harnessEvents = [];

    const orchestrator = createHarnessOrchestrator(config);
    globalForHarness.harnessOrchestrator = orchestrator;

    // Subscribe to events
    orchestrator.on((event) => {
      globalForHarness.harnessEvents.push(event);
      // Keep event buffer bounded
      if (globalForHarness.harnessEvents.length > 200) {
        globalForHarness.harnessEvents = globalForHarness.harnessEvents.slice(-100);
      }

      // Track status changes
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
      message: 'Harness loop started — poll GET /api/harness for progress',
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
    const orchestrator = globalForHarness.harnessOrchestrator;
    if (!orchestrator || globalForHarness.harnessStatus !== 'paused') {
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

    return apiSuccess({ status: 'resumed', message: 'Harness resumed' });
  }

  return apiError(`Unknown action: ${body.action}`, 400);
}
