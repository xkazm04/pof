import type { Operation } from 'fast-json-patch';
import type { LayoutTemplateId, PanelDirective } from '../layout/types';
import type { PatchOrigin } from '../state/types';
import type { PanelDensity } from '../types/panel';

// ---------------------------------------------------------------------------
// Intent Type
// ---------------------------------------------------------------------------

/**
 * Coarse intent categories. Payload discriminates specific actions within each.
 */
export type IntentType = 'compose' | 'manipulate' | 'navigate' | 'query' | 'system';

// ---------------------------------------------------------------------------
// Intent Source
// ---------------------------------------------------------------------------

/** Where the intent originated. */
export type IntentSource = 'click' | 'keyboard' | 'drag' | 'menu' | 'llm' | 'slash-command';

// ---------------------------------------------------------------------------
// Payload Types
// ---------------------------------------------------------------------------

export interface ComposePayload {
  action: 'open' | 'close' | 'swap' | 'set-layout' | 'apply-preset';
  panelType?: string;
  panelId?: string;
  targetSlot?: number;
  template?: LayoutTemplateId;
  directives?: PanelDirective[];
  /** Preset ID — used with apply-preset action. */
  presetId?: string;
  /** Panel directives — used with apply-preset to set all panels at once. */
  panels?: PanelDirective[];
}

export interface ManipulatePayload {
  action: 'resize' | 'set-density';
  panelId: string;
  /** For resize: new width in pixels after drag. */
  width?: number;
  /** For resize: new height in pixels after drag. */
  height?: number;
  /** For set-density: explicit density override. */
  density?: PanelDensity;
}

export interface NavigatePayload {
  action: 'focus' | 'scroll-to';
  panelId?: string;
  panelType?: string;
  entityId?: string;
}

export interface QueryPayload {
  action: 'search' | 'filter' | 'suggest';
  query: string;
  domain?: string;
}

export interface SystemPayload {
  action: 'undo' | 'redo' | 'clear' | 'toggle-chat';
}

// ---------------------------------------------------------------------------
// Payload Map (discriminated union key)
// ---------------------------------------------------------------------------

export interface IntentPayloadMap {
  compose: ComposePayload;
  manipulate: ManipulatePayload;
  navigate: NavigatePayload;
  query: QueryPayload;
  system: SystemPayload;
}

// ---------------------------------------------------------------------------
// Intent
// ---------------------------------------------------------------------------

/**
 * A typed Intent object representing any structured user input.
 * The `type` field selects the payload shape via IntentPayloadMap.
 */
export interface Intent<T extends IntentType = IntentType> {
  /** Unique intent instance ID. */
  id: string;
  /** Coarse intent category. */
  type: T;
  /** Discriminated payload -- shape depends on type. */
  payload: IntentPayloadMap[T];
  /** Where the intent originated. */
  source: IntentSource;
  /** When the intent was created (epoch ms). */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Intent Result
// ---------------------------------------------------------------------------

export type IntentResult =
  | { status: 'resolved'; patches: Operation[]; origin: PatchOrigin; description: string }
  | { status: 'needs-llm'; intent: Intent }
  | { status: 'error'; error: string };

// ---------------------------------------------------------------------------
// Intent Handler
// ---------------------------------------------------------------------------

/**
 * A synchronous handler that resolves an intent locally.
 * Returns an IntentResult on success/error, or NEEDS_LLM symbol to pass through.
 */
export type IntentHandler = (intent: Intent) => IntentResult | symbol;

// ---------------------------------------------------------------------------
// Intent Event
// ---------------------------------------------------------------------------

/** Emitted by the bus on every dispatch. */
export interface IntentEvent {
  intent: Intent;
  result: IntentResult;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Intent Bus Interface
// ---------------------------------------------------------------------------

export interface IntentBus {
  /** Dispatch an intent through the Director and apply resolved patches. */
  dispatch(intent: Intent): IntentResult;
  /** Subscribe to intent events. Returns unsubscribe function. */
  subscribe(listener: (event: IntentEvent) => void): () => void;
  /** JSON snapshot for useSyncExternalStore. */
  getSnapshot(): string;
}

// ---------------------------------------------------------------------------
// Director Interface
// ---------------------------------------------------------------------------

export interface Director {
  /** Resolve an intent via registered handlers. */
  resolve(intent: Intent): IntentResult;
  /** Register or override a handler for an intent type. */
  registerHandler(type: IntentType, handler: IntentHandler): void;
}
