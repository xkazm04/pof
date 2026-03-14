import type { WorkspaceState, StateEngine } from '../state/types';
import type {
  Intent,
  IntentResult,
  IntentEvent,
  IntentBus,
  Director,
} from './types';

// ---------------------------------------------------------------------------
// Intent Bus Factory
// ---------------------------------------------------------------------------

/**
 * Creates an IntentBus that dispatches intents through a Director,
 * applies resolved patches to a StateEngine, tracks pending LLM intents,
 * and notifies subscribers.
 *
 * Special handling: if a resolved intent has description 'undo' or 'redo',
 * the bus calls stateEngine.undo()/redo() instead of dispatch() (since undo/redo
 * operate on the undo stack, not on new patches).
 *
 * @param director - The Director that resolves intents.
 * @param stateEngine - The StateEngine to apply resolved patches to.
 */
export function createIntentBus(
  director: Director,
  stateEngine: StateEngine<WorkspaceState>,
): IntentBus {
  const listeners = new Set<(event: IntentEvent) => void>();
  const pendingLLM: Intent[] = [];
  let lastSnapshot = '{"pending":0,"lastEvent":null}';

  function notify(event: IntentEvent): void {
    for (const listener of listeners) {
      listener(event);
    }
  }

  function dispatch(intent: Intent): IntentResult {
    const result = director.resolve(intent);

    if (result.status === 'resolved') {
      // Special-case undo/redo: call engine methods instead of dispatch
      if (result.description === 'undo') {
        stateEngine.undo();
      } else if (result.description === 'redo') {
        stateEngine.redo();
      } else if (result.patches.length > 0) {
        stateEngine.dispatch(result.patches, result.origin, result.description);
      }
    } else if (result.status === 'needs-llm') {
      pendingLLM.push(intent);
    }
    // error results: no state mutation, no pending tracking

    const event: IntentEvent = {
      intent,
      result,
      timestamp: Date.now(),
    };

    lastSnapshot = JSON.stringify({
      pending: pendingLLM.length,
      lastEvent: event,
    });

    notify(event);
    return result;
  }

  function subscribe(listener: (event: IntentEvent) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getSnapshot(): string {
    return lastSnapshot;
  }

  return { dispatch, subscribe, getSnapshot };
}
