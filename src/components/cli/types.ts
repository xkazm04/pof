/**
 * CLI Component Types
 * Simplified from vibeman - no ProjectRequirement dependency.
 */

import type { SkillId } from './skills';
export type { SkillId };

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
  usage?: { inputTokens: number; outputTokens: number };
  durationMs?: number;
  totalCostUsd?: number;
  isError?: boolean;
}

export interface CLISSEEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface CompactTerminalProps {
  instanceId: string;
  projectPath: string;
  title?: string;
  className?: string;
  taskQueue?: QueuedTask[];
  onTaskStart?: (taskId: string) => void;
  onTaskComplete?: (taskId: string, success: boolean) => void;
  onQueueEmpty?: () => void;
  autoStart?: boolean;
  enabledSkills?: SkillId[];
  onStreamingChange?: (streaming: boolean) => void;
  /** Whether this terminal is currently visible (not hidden by display:none). Used to restore scroll position. */
  visible?: boolean;
}
