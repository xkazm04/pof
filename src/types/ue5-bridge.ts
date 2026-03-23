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

// ── WebSocket Live State types ──────────────────────────────────────────────

/** WebSocket connection status (mirrors UE5ConnectionStatus). */
export type WSConnectionStatus = UE5ConnectionStatus;

/** An actor currently selected in the UE5 editor. */
export interface SelectedActor {
  path: string;
  label: string;
  className: string;
  location?: { x: number; y: number; z: number };
}

/** Viewport camera state. */
export interface UE5ViewportState {
  cameraLocation: { x: number; y: number; z: number };
  cameraRotation: { pitch: number; yaw: number; roll: number };
  fov: number;
  viewMode: string;
}

/** PIE session state. */
export interface UE5PieState {
  isRunning: boolean;
  isPaused: boolean;
  sessionId?: string;
  playerCount: number;
  elapsedSeconds: number;
}

/** Full editor snapshot received over WebSocket. */
export interface UE5EditorSnapshot {
  timestamp: number;
  editorState: string;
  viewport: UE5ViewportState;
  selectedActors: SelectedActor[];
  pieState: UE5PieState | null;
  openLevel: string;
  dirtyPackages: string[];
}

/** Partial snapshot delta update. */
export interface UE5StateDelta {
  timestamp: number;
  editorState?: string;
  viewport?: Partial<UE5ViewportState>;
  selectedActors?: SelectedActor[];
  pieState?: UE5PieState | null;
  openLevel?: string;
  dirtyPackages?: string[];
}

/** Request to watch a UObject property for live value streaming. */
export interface PropertyWatchRequest {
  watchId: string;
  objectPath: string;
  propertyName: string;
  intervalMs?: number;
}

/** A property value update received from a watch subscription. */
export interface PropertyWatchUpdate {
  watchId: string;
  objectPath: string;
  propertyName: string;
  value: unknown;
  /** Previous value before this update — used for conflict detection. */
  previousValue?: unknown;
  timestamp?: number;
}

/** Aggregated live editor state used by the hook/store bridge. */
export interface LiveEditorState {
  wsStatus: WSConnectionStatus;
  snapshot: UE5EditorSnapshot | null;
  propertyWatches: Map<string, PropertyWatchUpdate>;
  lastSnapshotTime: number | null;
  frameRate: number;
}

// ── WebSocket message types ─────────────────────────────────────────────────

/** Inbound messages from UE5 plugin to the web client. */
export type WSInboundMessage =
  | { type: 'state.snapshot'; payload: UE5EditorSnapshot }
  | { type: 'state.delta'; payload: UE5StateDelta }
  | { type: 'property.update'; payload: PropertyWatchUpdate }
  | { type: 'event.pie'; payload: { action: string; sessionId?: string } }
  | { type: 'event.selection'; payload: { actors: SelectedActor[] } }
  | { type: 'pong' };

/** Outbound messages from the web client to UE5 plugin. */
export type WSOutboundMessage =
  | { type: 'subscribe.property'; payload: PropertyWatchRequest }
  | { type: 'unsubscribe.property'; payload: { watchId: string } }
  | { type: 'set.property'; payload: { objectPath: string; propertyName: string; value: unknown } }
  | { type: 'request.snapshot' }
  | { type: 'ping' };

// ── Item Injection types ────────────────────────────────────────────────────

/** A single affix to inject onto an item in UE5. */
export interface InjectAffix {
  tag: string;
  displayName: string;
  magnitude: number;
  bIsPrefix: boolean;
}

/** Request payload for the /api/ue5-inject-item endpoint. */
export interface InjectItemRequest {
  /** Base item definition asset name (e.g., "DA_Iron_Sword"). */
  definitionAsset: string;
  /** Item level for scaling. */
  itemLevel: number;
  /** Pre-rolled affixes with exact magnitudes. */
  affixes: InjectAffix[];
}

/** Response from the inject-item endpoint. */
export interface InjectItemResponse {
  injected: boolean;
  itemName: string;
  affixCount: number;
}
