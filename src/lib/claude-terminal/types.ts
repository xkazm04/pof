/**
 * Claude Terminal Types
 * Copied from vibeman as-is.
 */

export type SessionStatus = 'idle' | 'running' | 'waiting_approval' | 'completed' | 'error';
export type ApprovalDecision = 'approve' | 'deny';

export type TerminalMessageType =
  | 'user' | 'assistant' | 'tool_use' | 'tool_result'
  | 'error' | 'system' | 'approval_request' | 'streaming';

export interface TerminalMessage {
  id: string;
  type: TerminalMessageType;
  content: string;
  timestamp: number;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

export interface TerminalSession {
  id: string;
  projectPath: string;
  status: SessionStatus;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastPrompt?: string;
  totalTokensIn?: number;
  totalTokensOut?: number;
  totalCostUsd?: number;
}

export interface PendingApproval {
  id: string;
  sessionId: string;
  toolUseId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  createdAt: number;
  status: 'pending' | 'approved' | 'denied';
  decision?: ApprovalDecision;
  decisionReason?: string;
  decidedAt?: number;
}

export interface TerminalQueryOptions {
  sessionId?: string;
  resume?: boolean;
  maxTurns?: number;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  systemPromptAppend?: string;
  model?: string;
}

export type SSEEventType =
  | 'message' | 'tool_use' | 'tool_result' | 'approval_request'
  | 'streaming' | 'result' | 'error' | 'connected' | 'heartbeat';

export interface SSEEvent {
  type: SSEEventType;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface ResultData {
  sessionId: string;
  result: string;
  isError: boolean;
  numTurns: number;
  durationMs: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
  };
  totalCostUsd: number;
}

export interface ErrorData {
  sessionId: string;
  error: string;
  errorCode?: string;
}

export interface ConnectedData {
  sessionId: string;
  model: string;
  tools: string[];
  permissionMode: string;
}
