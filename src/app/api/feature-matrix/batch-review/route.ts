import { NextRequest } from 'next/server';
import { startExecution } from '@/lib/claude-terminal/cli-service';
import { settleExecution } from '@/lib/claude-terminal/run-settle';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { TaskFactory, buildTaskPrompt, resolveCallback } from '@/lib/cli-task';
import { MODULE_LABELS } from '@/lib/module-registry';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getOriginFromRequest, UI_TIMEOUTS } from '@/lib/constants';
import type { SubModuleId } from '@/types/modules';
import type { BatchReviewAbortRequest, BatchReviewStartRequest, BatchReviewState } from '@/types/batch-review';
import { resolveBatchModules } from '@/lib/evaluator/stale-review-plan';

// ── In-memory batch state (single batch at a time) ──

let activeBatch: BatchReviewState | null = null;
/** Aborting it cancels the batch AND kills the module run in flight (settleExecution). */
let batchController: AbortController | null = null;

function getModulesWithDefinitions(): { moduleId: SubModuleId; label: string; featureCount: number }[] {
  return Object.entries(MODULE_FEATURE_DEFINITIONS)
    .filter(([, defs]) => defs.length > 0)
    .map(([moduleId, defs]) => ({
      moduleId: moduleId as SubModuleId,
      label: MODULE_LABELS[moduleId] ?? moduleId,
      featureCount: defs.length,
    }));
}

async function runBatchReview(projectPath: string, projectName: string, ueVersion: string, appOrigin: string, signal: AbortSignal) {
  if (!activeBatch) return;

  for (let i = 0; i < activeBatch.modules.length; i++) {
    if (signal.aborted) {
      activeBatch.status = 'aborted';
      activeBatch.completedAt = new Date().toISOString();
      return;
    }

    const mod = activeBatch.modules[i];
    activeBatch.currentIndex = i;
    mod.status = 'running';
    mod.startedAt = new Date().toISOString();

    const defs = MODULE_FEATURE_DEFINITIONS[mod.moduleId];
    if (!defs || defs.length === 0) {
      mod.status = 'skipped';
      mod.completedAt = new Date().toISOString();
      continue;
    }

    try {
      const task = TaskFactory.featureReview(mod.moduleId, mod.label, defs, appOrigin, `${mod.label} Review`);
      const ctx = { projectName, projectPath, ueVersion };
      const prompt = buildTaskPrompt(task, ctx);

      const executionId = startExecution(projectPath, prompt, undefined, undefined, {
        enableMcp: true,
        attribution: { moduleId: mod.moduleId, taskType: 'batch-review', taskLabel: `${mod.label} Review` },
      });
      mod.executionId = executionId;

      // One settlement (run-settle.ts): ends the moment the run ends, with a typed reason.
      const settled = await settleExecution(executionId, {
        expect: 'callback',
        timeoutMs: UI_TIMEOUTS.batchReviewTimeout,
        signal,
      });

      if (!settled.ok && settled.error.reason === 'cancelled' && signal.aborted) {
        mod.status = 'error';
        mod.error = 'Batch aborted';
        mod.completedAt = new Date().toISOString();
        activeBatch.status = 'aborted';
        activeBatch.completedAt = new Date().toISOString();
        return;
      }

      if (!settled.ok) {
        // A run that recorded nothing is a failure with its reason, never `completed`.
        mod.status = 'error';
        mod.error = `${settled.error.reason}: ${settled.error.message}`;
      } else {
        const cb = settled.data.callback; // always set when expect is 'callback'
        const posted = cb
          ? await resolveCallback(cb.callbackId, cb.payload)
          : { success: false, error: 'no callback marker' };
        mod.status = posted.success ? 'completed' : 'error';
        if (!posted.success) mod.error = `callback-rejected: ${posted.error ?? 'unknown'}`;
      }
      mod.completedAt = new Date().toISOString();
    } catch (err) {
      mod.status = 'error';
      mod.error = err instanceof Error ? err.message : 'Unknown error';
      mod.completedAt = new Date().toISOString();
    }
  }

  activeBatch.status = activeBatch.modules.some((m) => m.status === 'error')
    ? 'error'
    : 'completed';
  activeBatch.completedAt = new Date().toISOString();
}

// ── Route handlers ──

/**
 * GET — Poll batch review status
 */
export async function GET() {
  if (!activeBatch) {
    return apiSuccess({ batch: null });
  }
  return apiSuccess({ batch: activeBatch });
}

/**
 * POST — Start a new batch review (or abort current one)
 */
export async function POST(request: NextRequest) {
  try {
    const raw = (await request.json()) as BatchReviewStartRequest | BatchReviewAbortRequest;

    // Abort active batch
    if ('action' in raw && raw.action === 'abort') {
      if (activeBatch && activeBatch.status === 'running') {
        batchController?.abort();
        return apiSuccess({ message: 'Batch abort requested' });
      }
      return apiError('No active batch to abort', 400);
    }

    // Prevent concurrent batches
    if (activeBatch && activeBatch.status === 'running') {
      return apiError('A batch review is already running', 409, { batchId: activeBatch.batchId });
    }

    // Read project settings from request body (client sends from localStorage)
    const body = raw as BatchReviewStartRequest;
    const projectPath = body.projectPath;
    const projectName = body.projectName || '';
    const ueVersion = body.ueVersion || '5.5';

    if (!projectPath) {
      return apiError('Project path not configured', 400);
    }

    const appOrigin = body.appOrigin || getOriginFromRequest(request);
    // Optional scope: the Quality tab sends its stale set (or one module); omitted =
    // every module with definitions. An unknown id refuses the whole request.
    const scoped = resolveBatchModules(getModulesWithDefinitions(), body.moduleIds);
    if (!scoped.ok) {
      return apiError(scoped.error, 400);
    }
    const modules = scoped.data;

    if (modules.length === 0) {
      return apiError('No modules with feature definitions found', 400);
    }

    const batchId = `batch-${Date.now()}`;
    batchController = new AbortController();

    activeBatch = {
      batchId,
      status: 'running',
      startedAt: new Date().toISOString(),
      completedAt: null,
      currentIndex: 0,
      modules: modules.map((m) => ({
        moduleId: m.moduleId,
        label: m.label,
        featureCount: m.featureCount,
        status: 'pending',
        executionId: null,
        startedAt: null,
        completedAt: null,
        error: null,
      })),
    };

    // Start batch in background (don't await — return immediately)
    runBatchReview(projectPath, projectName, ueVersion, appOrigin, batchController.signal);

    return apiSuccess({
      batchId,
      moduleCount: modules.length,
      totalFeatures: modules.reduce((sum, m) => sum + m.featureCount, 0),
    });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to start batch review', 500);
  }
}

/**
 * DELETE — Clear completed batch state
 */
export async function DELETE() {
  if (activeBatch && activeBatch.status === 'running') {
    return apiError('Cannot clear while batch is running', 400);
  }
  activeBatch = null;
  return apiSuccess({ cleared: true });
}
