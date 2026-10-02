/**
 * CLI Component Types
 * Simplified from vibeman - no ProjectRequirement dependency.
 */

import type { SkillId } from './skills';
import type { CallbackStatus } from '@/lib/cli-task';
export type { SkillId };
export type { CallbackStatus };

export interface QueuedTask {
  id: string;
  prompt: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
  moduleId?: string;
}

export interface FileChange {
  id: string;
  sessionId: string;
  filePath: string;
  changeType: 'edit' | 'write' | 'read' | 'delete';
  timestamp: number;
  toolUseId?: string;
  preview?: string;
}

export interface LogEntry {
  id: string;
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'system' | 'error';
  content: string;
  timestamp: number;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  model?: string;
}

export interface ExecutionInfo {
  sessionId?: string;
  model?: string;
  tools?: string[];
  version?: string;
}

export interface ExecutionResult {
  sessionId?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
  };
  durationMs?: number;
  totalCostUsd?: number;
  isError?: boolean;
}

/** A declared `@@CALLBACK` the server could not land (payload kept for Resubmit). */
export interface ServerFailedCallback {
  callbackId: string;
  payload: string;
  error: string;
}

/** The execution status a hidden terminal polls (GET /api/claude-terminal/query). */
export interface HiddenRunStatus {
  status: 'running' | 'completed' | 'error' | 'aborted';
  /** The server's callback verdict — null when none declared or still settling. */
  callbackStatus?: CallbackStatus | null;
  callbacksFailed?: ServerFailedCallback[];
  /** The CLI reported an error result. */
  isError?: boolean;
}

export interface CLISSEEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
  /** Position of the execution event this frame carries (1-based) — the `?after=` resume cursor. */
  seq?: number;
}

/** What a run's single completion reports beyond success. */
export interface TaskCompleteMeta {
  /** The server's verdict on the run's declared @@CALLBACKs (additive truth). */
  callbackStatus?: CallbackStatus;
  /** The run was never observed ending (its execution is gone from the server): record the outcome as unknown. */
  outcomeUnknown?: boolean;
}

export interface CompactTerminalProps {
  instanceId: string;
  projectPath: string;
  title?: string;
  className?: string;
  taskQueue?: QueuedTask[];
  onTaskStart?: (taskId: string) => void;
  onTaskComplete?: (taskId: string, success: boolean, meta?: TaskCompleteMeta) => void;
  /** Fired once per dispatched run when the server returns its execution id (the host persists it for re-attach). */
  onExecutionStarted?: (executionId: string) => void;
  onQueueEmpty?: () => void;
  autoStart?: boolean;
  enabledSkills?: SkillId[];
  onStreamingChange?: (streaming: boolean) => void;
  /** Fired when a prompt is dispatched: the raw prompt and its task type (the host's copy for Retry). */
  onDispatch?: (dispatch: { prompt: string; taskType?: string }) => void;
  /** Fired with a run's @@CALLBACK markers whose POST failed (re-POSTable without a new run). */
  onCallbacksUnresolved?: (markers: { callbackId: string; payload: string }[]) => void;
  /** Whether this terminal is currently visible (not hidden by display:none). Used to restore scroll position. */
  visible?: boolean;
}
