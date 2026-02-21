import { NextRequest } from 'next/server';
import { startExecution, getExecution, subscribeToExecution } from '@/lib/claude-terminal/cli-service';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { TaskFactory, buildTaskPrompt, extractCallbackPayload, resolveCallback } from '@/lib/cli-task';
import { MODULE_LABELS } from '@/lib/module-registry';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { getOriginFromRequest } from '@/lib/constants';
import type { SubModuleId } from '@/types/modules';

// ── Types ──

type ModuleReviewStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

interface ModuleProgress {
  moduleId: SubModuleId;
  label: string;
  featureCount: number;
  status: ModuleReviewStatus;
  executionId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

interface BatchReviewState {
  batchId: string;
  status: 'running' | 'completed' | 'error' | 'aborted';
  startedAt: string;
  completedAt: string | null;
  modules: ModuleProgress[];
  currentIndex: number;
}

// ── In-memory batch state (single batch at a time) ──

let activeBatch: BatchReviewState | null = null;
let batchAborted = false;

function getModulesWithDefinitions(): { moduleId: SubModuleId; label: string; featureCount: number }[] {
  return Object.entries(MODULE_FEATURE_DEFINITIONS)
    .filter(([, defs]) => defs.length > 0)
    .map(([moduleId, defs]) => ({
      moduleId: moduleId as SubModuleId,
      label: MODULE_LABELS[moduleId] ?? moduleId,
      featureCount: defs.length,
    }));
}

async function waitForExecution(executionId: string, timeoutMs = 600000): Promise<{ result: 'completed' | 'error' | 'aborted'; assistantOutput: string }> {
  let assistantOutput = '';

  // Subscribe to events to collect assistant output for callback processing
  const unsub = subscribeToExecution(executionId, (event) => {
    if (event.type === 'text') {
      const content = event.data.content as string | undefined;
      if (content) {
        assistantOutput += content;
      }
    }
  });

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (batchAborted) { unsub?.(); return { result: 'aborted', assistantOutput }; }
    const exec = getExecution(executionId);
    if (!exec) { unsub?.(); return { result: 'error', assistantOutput }; }
    if (exec.status === 'completed') { unsub?.(); return { result: 'completed', assistantOutput }; }
    if (exec.status === 'error' || exec.status === 'aborted') { unsub?.(); return { result: exec.status, assistantOutput }; }
    await new Promise((r) => setTimeout(r, 2000));
  }
  unsub?.();
  return { result: 'error', assistantOutput }; // timeout
}

async function runBatchReview(projectPath: string, projectName: string, ueVersion: string, appOrigin: string) {
  if (!activeBatch) return;

  for (let i = 0; i < activeBatch.modules.length; i++) {
    if (batchAborted) {
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

      const executionId = startExecution(projectPath, prompt);
      mod.executionId = executionId;

      const { result, assistantOutput } = await waitForExecution(executionId);

      if (result === 'aborted') {
        mod.status = 'error';
        mod.error = 'Batch aborted';
        mod.completedAt = new Date().toISOString();
        activeBatch.status = 'aborted';
        activeBatch.completedAt = new Date().toISOString();
        return;
      }

      // Process structured callback from assistant output
      if (result === 'completed' && assistantOutput) {
        const cbMatch = extractCallbackPayload(assistantOutput);
        if (cbMatch) {
          await resolveCallback(cbMatch.callbackId, cbMatch.payload);
        }
      }

      mod.status = result === 'completed' ? 'completed' : 'error';
      if (result === 'error') mod.error = 'CLI execution failed';
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
    const body = await request.json();
    const { action } = body;

    // Abort active batch
    if (action === 'abort') {
      if (activeBatch && activeBatch.status === 'running') {
        batchAborted = true;
        return apiSuccess({ message: 'Batch abort requested' });
      }
      return apiError('No active batch to abort', 400);
    }

    // Prevent concurrent batches
    if (activeBatch && activeBatch.status === 'running') {
      return apiError('A batch review is already running', 409, { batchId: activeBatch.batchId });
    }

    // Read project settings from request body (client sends from localStorage)
    const projectPath = body.projectPath;
    const projectName = body.projectName || '';
    const ueVersion = body.ueVersion || '5.5';

    if (!projectPath) {
      return apiError('Project path not configured', 400);
    }

    const appOrigin = body.appOrigin || getOriginFromRequest(request);
    const modules = getModulesWithDefinitions();

    if (modules.length === 0) {
      return apiError('No modules with feature definitions found', 400);
    }

    const batchId = `batch-${Date.now()}`;
    batchAborted = false;

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
    runBatchReview(projectPath, projectName, ueVersion, appOrigin);

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
