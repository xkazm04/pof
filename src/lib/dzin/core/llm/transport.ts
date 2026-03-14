import type { Intent, IntentResult } from '../intent/types';
import { serializeForClaude } from './serializer';
import type {
  LLMResponse,
  LLMTransport,
  LLMTransportConfig,
  LLMTransportStatus,
  WorkspaceSnapshot,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 1000;

// ---------------------------------------------------------------------------
// createLLMTransport
// ---------------------------------------------------------------------------

/**
 * Factory for creating a headless LLM transport.
 *
 * The transport serializes intents + workspace snapshots into structured JSON,
 * sends them via the provided `sendToLLM` callback, and handles timeout/retry
 * with exponential backoff. Status is exposed via the useSyncExternalStore
 * subscribe/getSnapshot pattern.
 */
export function createLLMTransport(config: LLMTransportConfig): LLMTransport {
  const {
    sendToLLM,
    onStatusChange,
    timeout = DEFAULT_TIMEOUT,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = config;

  // -----------------------------------------------------------------------
  // Internal state
  // -----------------------------------------------------------------------

  let status: LLMTransportStatus = 'idle';
  let lastSnapshot = JSON.stringify({ status });
  const listeners = new Set<() => void>();

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function setStatus(next: LLMTransportStatus): void {
    if (next === status) return;
    status = next;
    lastSnapshot = JSON.stringify({ status });
    onStatusChange?.(status);
    for (const listener of listeners) {
      listener();
    }
  }

  /**
   * Race sendToLLM against a timeout. Rejects with a special sentinel
   * error when the timeout fires so the retry loop can distinguish it.
   */
  function sendWithTimeout(context: string): Promise<LLMResponse> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new TimeoutError());
        }
      }, timeout);

      sendToLLM(context).then(
        (res) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(res);
          }
        },
        (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        },
      );
    });
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // -----------------------------------------------------------------------
  // processIntent
  // -----------------------------------------------------------------------

  async function processIntent(
    intent: Intent,
    snapshot: WorkspaceSnapshot,
  ): Promise<IntentResult> {
    const context = serializeForClaude(intent, snapshot);

    setStatus('sending');

    let lastError: unknown = null;
    const totalAttempts = 1 + maxRetries;

    for (let attempt = 0; attempt < totalAttempts; attempt++) {
      try {
        const response = await sendWithTimeout(context);

        if (response.status === 'resolved') {
          setStatus('idle');
          return {
            status: 'resolved',
            patches: response.patches ?? [],
            origin: response.origin ?? 'llm',
            description: response.description ?? '',
          };
        }

        // LLM returned error status
        setStatus('error');
        return {
          status: 'error',
          error: response.error ?? 'Unknown LLM error',
        };
      } catch (err) {
        lastError = err;

        if (err instanceof TimeoutError && attempt < totalAttempts - 1) {
          // Exponential backoff before next retry
          const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt);
          await delay(backoffMs);
          continue;
        }

        // Non-timeout error or last attempt -- bail out
        break;
      }
    }

    // All retries exhausted or non-timeout error
    setStatus('error');

    if (lastError instanceof TimeoutError) {
      return {
        status: 'error',
        error: `LLM timeout after ${maxRetries} retries`,
      };
    }

    return {
      status: 'error',
      error: lastError instanceof Error ? lastError.message : String(lastError),
    };
  }

  // -----------------------------------------------------------------------
  // useSyncExternalStore interface
  // -----------------------------------------------------------------------

  function getStatus(): LLMTransportStatus {
    return status;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getSnapshot(): string {
    return lastSnapshot;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  function destroy(): void {
    listeners.clear();
  }

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------

  return {
    processIntent,
    getStatus,
    subscribe,
    getSnapshot,
    destroy,
  };
}

// ---------------------------------------------------------------------------
// TimeoutError sentinel
// ---------------------------------------------------------------------------

class TimeoutError extends Error {
  constructor() {
    super('LLM request timed out');
    this.name = 'TimeoutError';
  }
}
