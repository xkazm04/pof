import type { ChatMessage, ChatStore, MessageRole, ToolCall } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of messages retained in the store. */
const MAX_MESSAGES = 200;

// ---------------------------------------------------------------------------
// Chat Store Factory
// ---------------------------------------------------------------------------

/**
 * Creates a headless chat store with bounded message array, tool call lifecycle,
 * and subscribe/getSnapshot contract for React integration via useSyncExternalStore.
 */
export function createChatStore(): ChatStore {
  let messages: ChatMessage[] = [];
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function addMessage(role: MessageRole, content: string): string {
    const id = crypto.randomUUID();
    const message: ChatMessage = {
      id,
      role,
      content,
      timestamp: Date.now(),
    };
    messages = [...messages, message];

    // Trim oldest if over capacity
    if (messages.length > MAX_MESSAGES) {
      messages = messages.slice(messages.length - MAX_MESSAGES);
    }

    notify();
    return id;
  }

  function updateMessage(
    id: string,
    updates: Partial<Pick<ChatMessage, 'content' | 'role' | 'isStreaming'>>
  ): void {
    messages = messages.map((msg) =>
      msg.id === id ? { ...msg, ...updates } : msg
    );
    notify();
  }

  function appendContent(id: string, chunk: string): void {
    messages = messages.map((msg) =>
      msg.id === id ? { ...msg, content: msg.content + chunk } : msg
    );
    notify();
  }

  function removeMessage(id: string): void {
    messages = messages.filter((msg) => msg.id !== id);
    notify();
  }

  function clear(): void {
    messages = [];
    notify();
  }

  function startToolCall(
    messageId: string,
    toolCallId: string,
    name: string,
    args: Record<string, unknown>
  ): void {
    const toolCall: ToolCall = {
      id: toolCallId,
      name,
      args,
      status: 'running',
      startedAt: Date.now(),
    };

    messages = messages.map((msg) => {
      if (msg.id !== messageId) return msg;
      const existing = msg.toolCalls ?? [];
      return { ...msg, toolCalls: [...existing, toolCall] };
    });
    notify();
  }

  function updateToolCall(
    messageId: string,
    toolCallId: string,
    updates: Partial<Pick<ToolCall, 'status' | 'result' | 'error'>>
  ): void {
    messages = messages.map((msg) => {
      if (msg.id !== messageId || !msg.toolCalls) return msg;
      return {
        ...msg,
        toolCalls: msg.toolCalls.map((tc) =>
          tc.id === toolCallId ? { ...tc, ...updates } : tc
        ),
      };
    });
    notify();
  }

  function completeToolCall(
    messageId: string,
    toolCallId: string,
    result: unknown
  ): void {
    messages = messages.map((msg) => {
      if (msg.id !== messageId || !msg.toolCalls) return msg;
      return {
        ...msg,
        toolCalls: msg.toolCalls.map((tc) =>
          tc.id === toolCallId
            ? { ...tc, status: 'success' as const, result, completedAt: Date.now() }
            : tc
        ),
      };
    });
    notify();
  }

  function failToolCall(
    messageId: string,
    toolCallId: string,
    error: string
  ): void {
    messages = messages.map((msg) => {
      if (msg.id !== messageId || !msg.toolCalls) return msg;
      return {
        ...msg,
        toolCalls: msg.toolCalls.map((tc) =>
          tc.id === toolCallId
            ? { ...tc, status: 'error' as const, error, completedAt: Date.now() }
            : tc
        ),
      };
    });
    notify();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getSnapshot(): string {
    return JSON.stringify(messages);
  }

  return {
    get messages() {
      return messages;
    },
    addMessage,
    updateMessage,
    appendContent,
    removeMessage,
    clear,
    startToolCall,
    updateToolCall,
    completeToolCall,
    failToolCall,
    subscribe,
    getSnapshot,
  };
}
