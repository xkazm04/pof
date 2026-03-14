import type {
  Intent,
  IntentType,
  IntentResult,
  IntentHandler,
  Director,
} from './types';

// ---------------------------------------------------------------------------
// NEEDS_LLM Sentinel
// ---------------------------------------------------------------------------

/**
 * Unique sentinel value returned by handlers to indicate the intent
 * cannot be resolved locally and should be routed to the LLM.
 */
export const NEEDS_LLM: unique symbol = Symbol('NEEDS_LLM');

// ---------------------------------------------------------------------------
// Director Factory
// ---------------------------------------------------------------------------

/**
 * Creates a Director that dispatches intents to registered handlers.
 *
 * If no handler is registered for an intent type, or the handler returns
 * NEEDS_LLM, the Director returns `{ status: 'needs-llm', intent }`.
 *
 * @param handlers - Optional initial handler map.
 */
export function createDirector(
  handlers?: Partial<Record<IntentType, IntentHandler>>,
): Director {
  const handlerMap = new Map<IntentType, IntentHandler>(
    Object.entries(handlers ?? {}) as [IntentType, IntentHandler][],
  );

  function resolve(intent: Intent): IntentResult {
    const handler = handlerMap.get(intent.type);

    if (!handler) {
      return { status: 'needs-llm', intent };
    }

    const result = handler(intent);

    if (result === NEEDS_LLM) {
      return { status: 'needs-llm', intent };
    }

    return result as IntentResult;
  }

  function registerHandler(type: IntentType, handler: IntentHandler): void {
    handlerMap.set(type, handler);
  }

  return { resolve, registerHandler };
}
