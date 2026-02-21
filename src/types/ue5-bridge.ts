import type { BuildDiagnostic } from '@/components/cli/UE5BuildParser';

// ── Remote Control types ────────────────────────────────────────────────────

export type UE5ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

export interface UE5RemoteControlInfo {
  version: string;
  serverName: string;
}

export interface UE5ConnectionState {
  status: UE5ConnectionStatus;
  info: UE5RemoteControlInfo | null;
  error: string | null;
  lastConnected: string | null;
  reconnectAttempts: number;
}

export interface UE5PropertyRequest {
  objectPath: string;
  propertyName: string;
}

export interface UE5FunctionCall {
  objectPath: string;
  functionName: string;
  parameters?: Record<string, unknown>;
}

export interface UE5AssetSearchResult {
  assetPath: string;
  assetClass: string;
  assetName: string;
}

export interface UE5BatchRequest {
  requests: Array<{
    requestId: number;
    url: string;
    verb: 'GET' | 'PUT' | 'POST' | 'DELETE';
    body?: unknown;
  }>;
}

export interface UE5BatchResponse {
  responses: Array<{
    requestId: number;
    responseCode: number;
    responseBody: unknown;
  }>;
}

// ── Build Pipeline types ────────────────────────────────────────────────────

export type BuildTargetPlatform = 'Win64' | 'Linux' | 'Mac';
export type BuildConfiguration = 'Debug' | 'DebugGame' | 'Development' | 'Shipping' | 'Test';
export type BuildTargetType = 'Editor' | 'Game' | 'Server' | 'Client';
export type BuildStatus = 'queued' | 'running' | 'success' | 'failed' | 'aborted';

export interface BuildRequest {
  projectPath: string;
  targetName: string;
  ueVersion: string;
  platform: BuildTargetPlatform;
  configuration: BuildConfiguration;
  targetType: BuildTargetType;
  additionalArgs?: string[];
}

export interface BuildResult {
  buildId: string;
  status: BuildStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  exitCode: number | null;
  errorCount: number;
  warningCount: number;
  diagnostics: BuildDiagnostic[];
  output: string;
}

export interface BuildQueueItem {
  buildId: string;
  request: BuildRequest;
  status: BuildStatus;
  queuedAt: string;
  startedAt: string | null;
}

export interface BuildOptions {
  onProgress?: (message: string, percent?: number) => void;
  abortSignal?: AbortSignal;
  moduleId?: string;
}
