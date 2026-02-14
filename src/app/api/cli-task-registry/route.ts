/**
 * Server-side Task Registry
 * Copied from vibeman as-is.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';

interface TaskRecord {
  taskId: string;
  sessionId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  requirementName?: string;
}

const taskRegistry = new Map<string, TaskRecord>();
const RECORD_TTL = 60 * 60 * 1000;
const TASK_TIMEOUT = 10 * 60 * 1000;

function cleanupOldRecords() {
  const now = Date.now();
  for (const [key, record] of taskRegistry.entries()) {
    if (now - record.startedAt > RECORD_TTL) taskRegistry.delete(key);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');
  const sessionId = searchParams.get('sessionId');

  cleanupOldRecords();

  if (taskId) {
    const record = taskRegistry.get(taskId);
    if (!record) return apiSuccess({ found: false, taskId });
    const isStale = record.status === 'running' && (Date.now() - record.startedAt) > TASK_TIMEOUT;
    return apiSuccess({ found: true, ...record, isStale });
  }

  if (sessionId) {
    const sessionTasks: TaskRecord[] = [];
    for (const record of taskRegistry.values()) {
      if (record.sessionId === sessionId) sessionTasks.push(record);
    }
    return apiSuccess({ sessionId, tasks: sessionTasks });
  }

  return apiSuccess({
    totalTasks: taskRegistry.size,
    running: Array.from(taskRegistry.values()).filter(t => t.status === 'running').length,
    completed: Array.from(taskRegistry.values()).filter(t => t.status === 'completed').length,
    failed: Array.from(taskRegistry.values()).filter(t => t.status === 'failed').length,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, taskId, sessionId, status, requirementName } = body;

    if (!taskId) return apiError('taskId is required', 400);
    cleanupOldRecords();

    switch (action) {
      case 'start': {
        if (!sessionId) return apiError('sessionId is required for start', 400);
        let existingRunning: TaskRecord | null = null;
        for (const record of taskRegistry.values()) {
          if (record.sessionId === sessionId && record.status === 'running') { existingRunning = record; break; }
        }
        if (existingRunning && existingRunning.taskId !== taskId) {
          const isStale = (Date.now() - existingRunning.startedAt) > TASK_TIMEOUT;
          if (isStale) { existingRunning.status = 'failed'; existingRunning.completedAt = Date.now(); }
          else return apiError('Session already has a running task', 409, { runningTask: existingRunning });
        }
        const record: TaskRecord = { taskId, sessionId, status: 'running', startedAt: Date.now(), requirementName };
        taskRegistry.set(taskId, record);
        return apiSuccess({ record });
      }
      case 'complete': {
        const record = taskRegistry.get(taskId);
        if (!record) {
          const newRecord: TaskRecord = { taskId, sessionId: sessionId || 'unknown', status: status === 'failed' ? 'failed' : 'completed', startedAt: Date.now(), completedAt: Date.now() };
          taskRegistry.set(taskId, newRecord);
          return apiSuccess({ record: newRecord, wasUntracked: true });
        }
        record.status = status === 'failed' ? 'failed' : 'completed';
        record.completedAt = Date.now();
        return apiSuccess({ record });
      }
      case 'heartbeat': {
        const record = taskRegistry.get(taskId);
        if (record && record.status === 'running') { record.startedAt = Date.now(); return apiSuccess({ record }); }
        return apiError('Task not found or not running');
      }
      case 'clear': {
        if (!sessionId) return apiError('sessionId is required for clear', 400);
        let cleared = 0;
        for (const [key, record] of taskRegistry.entries()) {
          if (record.sessionId === sessionId) { taskRegistry.delete(key); cleared++; }
        }
        return apiSuccess({ cleared });
      }
      default:
        return apiError('Invalid action', 400);
    }
  } catch (error) {
    console.error('Task registry error:', error);
    return apiError(error instanceof Error ? error.message : 'Internal error');
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');
  if (!taskId) return apiError('taskId is required', 400);
  const deleted = taskRegistry.delete(taskId);
  return apiSuccess({ deleted, taskId });
}
