import type { Intent, IntentResult, IntentHandler, SystemPayload } from '../types';
import { NEEDS_LLM } from '../director';

// ---------------------------------------------------------------------------
// System Handler Factory
// ---------------------------------------------------------------------------

/**
 * Creates a local handler for system intents: undo, redo, clear, toggle-chat.
 *
 * - `undo`: Returns resolved with empty patches and description 'undo'.
 *   The bus detects this description and calls stateEngine.undo() instead.
 * - `redo`: Same pattern with 'redo' description.
 * - `clear`: Returns resolved with description 'clear' (bus can reset state).
 * - `toggle-chat`: Returns resolved with description (UI concern, no patches).
 */
export function createSystemHandler(): IntentHandler {
  return (intent: Intent): IntentResult | typeof NEEDS_LLM => {
    const payload = intent.payload as SystemPayload;

    switch (payload.action) {
      case 'undo':
        return {
          status: 'resolved',
          patches: [],
          origin: 'user',
          description: 'undo',
        };

      case 'redo':
        return {
          status: 'resolved',
          patches: [],
          origin: 'user',
          description: 'redo',
        };

      case 'clear':
        return {
          status: 'resolved',
          patches: [],
          origin: 'user',
          description: 'clear',
        };

      case 'toggle-chat':
        return {
          status: 'resolved',
          patches: [],
          origin: 'user',
          description: 'toggle-chat',
        };

      default:
        return NEEDS_LLM;
    }
  };
}
