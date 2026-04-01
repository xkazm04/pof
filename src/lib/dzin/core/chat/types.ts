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
  updateMessage(id: string, updates: Partial<Pick<ChatMessage, 'content' | 'role' | 'isStreaming'>>): void;
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
