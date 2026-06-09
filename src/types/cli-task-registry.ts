/**
 * Shared CLI Task Registry wire contract.
 *
 * Canonical types for the `/api/cli-task-registry` endpoint, imported by both the
 * server route (`src/app/api/cli-task-registry/route.ts`) and the client helper
 * (`src/components/cli/taskRegistry.ts`) so the request/record contract is
 * type-checked end to end instead of being hand-synced in two places.
 */

/** Lifecycle status of a tracked CLI task. */
export type TaskStatus = 'running' | 'completed' | 'failed';

/** A single task record held by the server registry and returned over the wire. */
export interface TaskRecord {
  taskId: string;
  sessionId: string;
  status: TaskStatus;
  startedAt: number;
  completedAt?: number;
  requirementName?: string;
}

/** Discriminator for the task registry POST body. */
export type TaskRegistryAction = 'start' | 'complete' | 'heartbeat' | 'clear';
