/**
 * AdvisorClient — Server-proxied Gemini advisor for PoF.
 *
 * Stateless HTTP client: each call sends current context to /api/agents/advisor.
 * Reads the SSE stream and dispatches events to registered handlers.
 */

import { logger } from '@/lib/logger';
import { UI_TIMEOUTS } from '@/lib/constants';

/* ── Types ────────────────────────────────────────────────────────────── */

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface AdvisorToolCall {
  name: string;
  args: Record<string, unknown>;
}

interface WorkspaceSnapshot {
  panels: Array<{ type: string; role: string }>;
  layout: string;
}

interface SSEEvent {
  type: 'status' | 'text' | 'tool_call' | 'error' | 'done';
  status?: string;
  text?: string;
  toolCall?: AdvisorToolCall;
  error?: string;
  turn?: number;
}

type ToolCallHandler = (calls: AdvisorToolCall[]) => void;
type MessageHandler = (text: string) => void;
type StreamingTextHandler = (chunk: string, accumulated: string) => void;
type StateHandler = (state: ConnectionState) => void;
type ProcessingHandler = (isProcessing: boolean, status?: string | null) => void;
type ErrorHandler = (errorMessage: string) => void;

const MAX_RETRIES = 2;
const MIN_CALL_INTERVAL_MS = UI_TIMEOUTS.pofReconnectBase;

/* ── Client ───────────────────────────────────────────────────────────── */

export class AdvisorClient {
  private onToolCallHandlers: ToolCallHandler[] = [];
  private onMessageHandlers: MessageHandler[] = [];
  private onStreamingTextHandlers: StreamingTextHandler[] = [];
  private onStateChangeHandlers: StateHandler[] = [];
  private onProcessingChangeHandlers: ProcessingHandler[] = [];
  private onErrorHandlers: ErrorHandler[] = [];
  private _state: ConnectionState = 'disconnected';
  private _available: boolean | null = null;
  private lastCallTimestamp = 0;
  private pendingCall: ReturnType<typeof setTimeout> | null = null;
  private history: Array<{ role: 'user' | 'model'; text: string }> = [];
  private abortController: AbortController | null = null;

  get state(): ConnectionState {
    return this._state;
  }

  get isConnected(): boolean {
    return this._state === 'connected';
  }

  /* ── Event registration ───────────────────────────────────────────── */

  onToolCall(handler: ToolCallHandler): () => void {
    this.onToolCallHandlers.push(handler);
    return () => { this.onToolCallHandlers = this.onToolCallHandlers.filter(h => h !== handler); };
  }

  onMessage(handler: MessageHandler): () => void {
    this.onMessageHandlers.push(handler);
    return () => { this.onMessageHandlers = this.onMessageHandlers.filter(h => h !== handler); };
  }

  onStreamingText(handler: StreamingTextHandler): () => void {
    this.onStreamingTextHandlers.push(handler);
    return () => { this.onStreamingTextHandlers = this.onStreamingTextHandlers.filter(h => h !== handler); };
  }

  onStateChange(handler: StateHandler): () => void {
    this.onStateChangeHandlers.push(handler);
    return () => { this.onStateChangeHandlers = this.onStateChangeHandlers.filter(h => h !== handler); };
  }

  onProcessingChange(handler: ProcessingHandler): () => void {
    this.onProcessingChangeHandlers.push(handler);
    return () => { this.onProcessingChangeHandlers = this.onProcessingChangeHandlers.filter(h => h !== handler); };
  }

  onError(handler: ErrorHandler): () => void {
    this.onErrorHandlers.push(handler);
    return () => { this.onErrorHandlers = this.onErrorHandlers.filter(h => h !== handler); };
  }

  /* ── Connection (health check only) ───────────────────────────────── */

  async connect(): Promise<boolean> {
    if (this._available === true) {
      this.setState('connected');
      return true;
    }

    this.setState('connecting');
    try {
      const res = await fetch('/api/agents/advisor');
      const data = await res.json();
      this._available = !!data.available;
      this.setState(this._available ? 'connected' : 'disconnected');
      return this._available;
    } catch {
      this._available = false;
      this.setState('disconnected');
      return false;
    }
  }

  disconnect(): void {
    if (this.pendingCall) {
      clearTimeout(this.pendingCall);
      this.pendingCall = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.history = [];
    this._available = null;
    this.setState('disconnected');
  }

  /* ── Send request ─────────────────────────────────────────────────── */

  async sendContext(workspace: WorkspaceSnapshot, userMessage?: string): Promise<void> {
    if (this._state !== 'connected') return;

    const now = Date.now();
    const elapsed = now - this.lastCallTimestamp;
    if (elapsed < MIN_CALL_INTERVAL_MS) {
      const waitMs = MIN_CALL_INTERVAL_MS - elapsed;
      if (this.pendingCall) clearTimeout(this.pendingCall);
      this.pendingCall = setTimeout(() => {
        this.pendingCall = null;
        this.sendContext(workspace, userMessage);
      }, waitMs);
      return;
    }

    this.lastCallTimestamp = now;

    if (this.abortController) this.abortController.abort();
    this.abortController = new AbortController();

    this.emitProcessing(true, 'Thinking...');

    const body = {
      workspace,
      userMessage,
      history: this.history.slice(-6),
    };

    if (userMessage) {
      this.history.push({ role: 'user' as const, text: userMessage });
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          this.emitProcessing(true, `Retrying (${attempt}/${MAX_RETRIES})...`);
        }

        const res = await fetch('/api/agents/advisor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: this.abortController.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error((errData as { error?: string }).error ?? `HTTP ${res.status}`);
        }

        await this.consumeStream(res);
        this.emitProcessing(false);
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          this.emitProcessing(false);
          return;
        }
        lastError = error as Error;
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    this.emitProcessing(false);
    logger.warn('[advisor] Failed after retries:', lastError?.message);
    this.onErrorHandlers.forEach(h => h(lastError?.message ?? 'unknown error'));
  }

  /* ── Stream consumer ──────────────────────────────────────────────── */

  private async consumeStream(res: Response): Promise<void> {
    const reader = res.body?.getReader();
    if (!reader) throw new Error('Response body is not readable');

    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line) continue;

          let event: SSEEvent;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          switch (event.type) {
            case 'status':
              if (event.status) this.emitProcessing(true, event.status);
              break;

            case 'text':
              if (event.text) {
                accumulatedText += event.text;
                this.onStreamingTextHandlers.forEach(h => h(event.text!, accumulatedText));
              }
              break;

            case 'tool_call':
              if (event.toolCall) {
                this.onToolCallHandlers.forEach(h => h([event.toolCall!]));
              }
              break;

            case 'error':
              throw new Error(event.error ?? 'Stream error');

            case 'done':
              if (accumulatedText) {
                this.onMessageHandlers.forEach(h => h(accumulatedText));
              }
              break;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (accumulatedText) {
      this.history.push({ role: 'model', text: accumulatedText });
    }
  }

  /* ── Helpers ──────────────────────────────────────────────────────── */

  private setState(state: ConnectionState): void {
    if (this._state === state) return;
    this._state = state;
    this.onStateChangeHandlers.forEach(h => h(state));
  }

  private emitProcessing(isProcessing: boolean, status?: string | null): void {
    this.onProcessingChangeHandlers.forEach(h => h(isProcessing, status));
  }
}
