import type { Operation } from 'fast-json-patch';
import type { LayoutTemplateId } from '../layout/types';
import type { PatchOrigin } from '../state/types';
import type { PanelDensity } from '../types/panel';
import type { Intent, IntentResult, IntentSource, IntentType } from '../intent/types';

// ---------------------------------------------------------------------------
// LLM Transport Status
// ---------------------------------------------------------------------------

/**
 * Observable status of the LLM transport connection.
 * Follows useSyncExternalStore pattern via subscribe/getSnapshot.
 */
export type LLMTransportStatus = 'idle' | 'sending' | 'streaming' | 'error' | 'disconnected';

// ---------------------------------------------------------------------------
// Workspace Snapshot
// ---------------------------------------------------------------------------

/**
 * A lightweight snapshot of the current workspace state for LLM context.
 * Captures panel layout, density modes, and viewport dimensions.
 */
export interface WorkspaceSnapshot {
  panels: Array<{ type: string; role: string; density: PanelDensity }>;
  layout: LayoutTemplateId;
  focusedPanel?: string;
  viewport: { width: number; height: number };
}

// ---------------------------------------------------------------------------
// Serialized Context
// ---------------------------------------------------------------------------

/**
 * The structured JSON shape sent to the LLM.
 * Contains the triggering intent, workspace snapshot, and optional entity IDs.
 */
export interface SerializedContext {
  intent: {
    id: string;
    type: IntentType;
    payload: unknown;
    source: IntentSource;
  };
  workspace: WorkspaceSnapshot;
  entities?: {
    selectedProject?: string;
    selectedAct?: string;
    selectedScene?: string;
  };
}

// ---------------------------------------------------------------------------
// LLM Response
// ---------------------------------------------------------------------------

/**
 * The response shape expected from the LLM callback.
 * Mirrors IntentResult but scoped to LLM-resolvable outcomes.
 */
export interface LLMResponse {
  status: 'resolved' | 'error';
  patches?: Operation[];
  origin?: PatchOrigin;
  description?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// LLM Transport Config
// ---------------------------------------------------------------------------

/**
 * Configuration for creating an LLM transport instance.
 * The sendToLLM callback is the integration point -- callers provide
 * their own implementation (e.g. Claude CLI, HTTP API, mock).
 */
export interface LLMTransportConfig {
  /** Callback that sends serialized context to the LLM and returns a response. */
  sendToLLM: (context: string) => Promise<LLMResponse>;
  /** Optional callback invoked on each status transition. */
  onStatusChange?: (status: LLMTransportStatus) => void;
  /** Timeout in ms before aborting a sendToLLM call. Default: 30000. */
  timeout?: number;
  /** Max retry attempts after timeout/failure. Default: 2. */
  maxRetries?: number;
}

// ---------------------------------------------------------------------------
// LLM Transport Interface
// ---------------------------------------------------------------------------

/**
 * The headless LLM transport contract.
 * Processes needs-llm intents by serializing context and forwarding
 * to the configured sendToLLM callback with timeout and retry.
 */
export interface LLMTransport {
  /** Serialize intent + snapshot and send to LLM. Returns an IntentResult. */
  processIntent(intent: Intent, snapshot: WorkspaceSnapshot): Promise<IntentResult>;
  /** Current transport status. */
  getStatus(): LLMTransportStatus;
  /** Subscribe to status changes. Returns unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** JSON snapshot for useSyncExternalStore compatibility. */
  getSnapshot(): string;
  /** Cleanup hook for session teardown. */
  destroy(): void;
}
