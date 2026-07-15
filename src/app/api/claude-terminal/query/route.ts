/**
 * Claude Terminal Query API Route (CLI-based)
 * Copied from vibeman as-is.
 */

import { NextRequest } from 'next/server';
import {
  startExecution,
  abortExecution,
  getExecution,
} from '@/lib/claude-terminal/cli-service';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { resolveDispatchModelChoice } from '@/lib/model-policy';

interface QueryRequestBody {
  projectPath: string;
  prompt: string;
  resumeSessionId?: string;
  /** Model-policy wiring: the dispatch task type (a CLITaskType or 'interactive') — the
   *  route maps it to a policy class and resolves the pinned model + effort server-side. */
  taskType?: string;
  /** Explicit policy class (bypasses the taskType map) — used by tooling that knows it. */
  taskClass?: string;
  /** Explicit model/effort override (scripts / autonomous spawns). Validated; unknown → ignored. */
  model?: string;
  effort?: string;
  /** Spend attribution — recorded server-side with the run's terminal outcome. */
  moduleId?: string;
  taskLabel?: string | null;
  sessionKey?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as QueryRequestBody;
    const { projectPath, prompt, resumeSessionId } = body;

    if (!projectPath) {
      return apiError('Project path is required', 400);
    }
    if (!prompt || !prompt.trim()) {
      return apiError('Prompt is required', 400);
    }

    // Resolve the model + effort this run should pin from the model policy (Quality
    // Program WS0). Only known values pass through; an unmapped task type / unknown
    // override yields {} so no `--model`/`--effort` args are appended (unchanged behaviour).
    const { model, effort } = resolveDispatchModelChoice({
      model: body.model,
      effort: body.effort,
      taskClass: body.taskClass,
      taskType: body.taskType,
    });

    const executionId = startExecution(projectPath, prompt, resumeSessionId, undefined, {
      model,
      effort,
      // Attribute this run's spend to the dispatching session. Recorded server-side
      // for every outcome (completed/failed/aborted) — see cli-service recordExecutionSpend.
      attribution: {
        moduleId: body.moduleId,
        taskType: body.taskType,
        taskLabel: body.taskLabel ?? null,
        sessionKey: body.sessionKey ?? null,
      },
    });
    const execution = getExecution(executionId);

    return apiSuccess({
      executionId,
      streamUrl: `/api/claude-terminal/stream?executionId=${executionId}`,
      logFilePath: execution?.logFilePath ?? null,
      // Surface the resolved pin so the terminal can honestly label the run's model.
      model: model ?? null,
      effort: effort ?? null,
    });
  } catch (error) {
    console.error('Claude Terminal query error:', error);
    return apiError(error instanceof Error ? error.message : 'Failed to start execution');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get('executionId');

    if (!executionId) {
      return apiError('Execution ID is required', 400);
    }

    const execution = getExecution(executionId);
    if (!execution) {
      return apiError('Execution not found', 404);
    }

    const aborted = abortExecution(executionId);
    return apiSuccess({
      aborted,
      message: aborted ? 'Execution aborted' : 'Failed to abort execution',
    });
  } catch (error) {
    console.error('Claude Terminal abort error:', error);
    return apiError(error instanceof Error ? error.message : 'Failed to abort execution');
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get('executionId');

    if (!executionId) {
      return apiError('Execution ID is required', 400);
    }

    const execution = getExecution(executionId);
    if (!execution) {
      return apiError('Execution not found', 404);
    }

    return apiSuccess({
      execution: {
        id: execution.id,
        projectPath: execution.projectPath,
        status: execution.status,
        sessionId: execution.sessionId,
        startTime: execution.startTime,
        endTime: execution.endTime,
        eventCount: execution.events.length,
        logFilePath: execution.logFilePath,
      },
    });
  } catch (error) {
    console.error('Claude Terminal status error:', error);
    return apiError(error instanceof Error ? error.message : 'Failed to get execution status');
  }
}
