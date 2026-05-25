import type { LayoutTemplateId } from '../layout/types';

// ---------------------------------------------------------------------------
// Message Role
// ---------------------------------------------------------------------------

/** The role of a chat message sender. */
export type MessageRole = 'user' | 'assistant' | 'system';

// ---------------------------------------------------------------------------
// Tool Call Status
// ---------------------------------------------------------------------------

/** Lifecycle status of a tool call. */
export type ToolCallStatus = 'pending' | 'running' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Tool Call
// ---------------------------------------------------------------------------

/** A single tool invocation tracked within a chat message. */
export interface ToolCall {
  /** Unique identifier for this tool call. */
  id: string;
  /** Tool name. */
  name: string;
  /** Arguments passed to the tool. */
  args: Record<string, unknown>;
  /** Current lifecycle status. */
  status: ToolCallStatus;
  /** Result data on success. */
  result?: unknown;
  /** Error message on failure. */
  error?: string;
  /** When the tool call started (epoch ms). */
  startedAt: number;
  /** When the tool call completed (epoch ms). */
  completedAt?: number;
}

// ---------------------------------------------------------------------------
// Suggested Action (compose_on_accept)
// ---------------------------------------------------------------------------

/** Compose actions an advisor suggestion can request when accepted. */
export type SuggestedComposeAction = 'show' | 'hide' | 'replace' | 'clear';

/** A single panel referenced by a suggestion's compose payload. */
export interface SuggestedPanel {
  /** Panel type string matching a PanelDefinition.type. */
  type: string;
  /** Optional role override (primary/secondary/tertiary/sidebar). */
  role?: string;
  /** Optional density override (full/compact/micro). */
  density?: string;
}

/**
 * The parsed `compose_on_accept` payload from a `suggest_action` tool call.
 * Mirrors the `compose_workspace` argument shape so it can be replayed
 * through the IntentBus when the user accepts the suggestion.
 */
export interface SuggestedCompose {
  /** How to apply the panels relative to the current workspace. */
  action: SuggestedComposeAction;
  /** Panels the suggestion proposes (empty for `clear`). */
  panels: SuggestedPanel[];
  /** Optional layout preset to switch to. */
  layout?: LayoutTemplateId;
}

/** Lifecycle of a proactive suggestion card. */
export type SuggestedActionStatus = 'pending' | 'applied' | 'dismissed';

/**
 * A proactive suggestion attached to a system message, rendered as an
 * actionable card with Apply / Dismiss controls.
 */
export interface SuggestedAction {
  /** The composition to dispatch when the user clicks Apply. */
  compose: SuggestedCompose;
  /** Whether the suggestion is still actionable, applied, or dismissed. */
  status: SuggestedActionStatus;
}

// ---------------------------------------------------------------------------
// Chat Message
// ---------------------------------------------------------------------------

/** A single message in the chat conversation. */
export interface ChatMessage {
  /** Unique message identifier. */
  id: string;
  /** Who sent this message. */
  role: MessageRole;
  /** Message text content. */
  content: string;
  /** When the message was created (epoch ms). */
  timestamp: number;
  /** Tool calls associated with this message. */
  toolCalls?: ToolCall[];
  /** Whether content is still being streamed. */
  isStreaming?: boolean;
  /** Proactive suggestion (from `suggest_action` with `compose_on_accept`). */
  suggestedAction?: SuggestedAction;
}

// ---------------------------------------------------------------------------
// Composition Summary
// ---------------------------------------------------------------------------

/** Summary of a workspace composition shown inline in chat. */
export interface CompositionSummary {
  /** Panels in the composed workspace. */
  panels: Array<{ type: string; role?: string }>;
  /** Layout template used. */
  layout: string;
}

// ---------------------------------------------------------------------------
// Slash Command
// ---------------------------------------------------------------------------

/** A registered slash command for the chat input. */
export interface SlashCommand {
  /** Command name (without leading slash). */
  name: string;
  /** Human-readable description. */
  description: string;
  /** Optional icon identifier. */
  icon?: string;
  /** Execute the command with the remaining args string. */
  execute: (args: string) => void;
}

// ---------------------------------------------------------------------------
// Chat Store
// ---------------------------------------------------------------------------

/** The headless chat store interface. */
export interface ChatStore {
  /** Current messages in the conversation. */
  readonly messages: ChatMessage[];

  // Message operations
  addMessage(role: MessageRole, content: string): string;
  /** Add a system message carrying an actionable compose suggestion. */
  addSuggestion(content: string, compose: SuggestedCompose): string;
  updateMessage(id: string, updates: Partial<Pick<ChatMessage, 'content' | 'role' | 'isStreaming' | 'suggestedAction'>>): void;
  appendContent(id: string, chunk: string): void;
  removeMessage(id: string): void;
  clear(): void;

  // Tool call operations
  startToolCall(messageId: string, toolCallId: string, name: string, args: Record<string, unknown>): void;
  updateToolCall(messageId: string, toolCallId: string, updates: Partial<Pick<ToolCall, 'status' | 'result' | 'error'>>): void;
  completeToolCall(messageId: string, toolCallId: string, result: unknown): void;
  failToolCall(messageId: string, toolCallId: string, error: string): void;

  // Subscription
  subscribe(listener: () => void): () => void;
  getSnapshot(): ChatMessage[];
  getVersion(): number;
}
