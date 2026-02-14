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

interface QueryRequestBody {
  projectPath: string;
  prompt: string;
  resumeSessionId?: string;
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

    const executionId = startExecution(projectPath, prompt, resumeSessionId);
    const execution = getExecution(executionId);

    return apiSuccess({
      executionId,
      streamUrl: `/api/claude-terminal/stream?executionId=${executionId}`,
      logFilePath: execution?.logFilePath ?? null,
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
