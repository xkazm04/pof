import type { Intent, IntentResult, IntentHandler, NavigatePayload } from '../types';
import { NEEDS_LLM } from '../director';

// ---------------------------------------------------------------------------
// Navigate Handler Factory
// ---------------------------------------------------------------------------

/**
 * Creates a local handler for navigate intents: focus, scroll-to.
 *
 * - `focus` with panelId: Returns resolved (actual DOM focus is a UI concern).
 * - `focus` without panelId or panelType: Returns NEEDS_LLM (needs search).
 * - `scroll-to`: Returns NEEDS_LLM (complex navigation).
 */
export function createNavigateHandler(): IntentHandler {
  return (intent: Intent): IntentResult | typeof NEEDS_LLM => {
    const payload = intent.payload as NavigatePayload;

    switch (payload.action) {
      case 'focus': {
        if (payload.panelId) {
          return {
            status: 'resolved',
            patches: [],
            origin: 'user',
            description: `Focus panel ${payload.panelId}`,
          };
        }
        if (payload.panelType) {
          // Could search by type, but needs state access -- defer to LLM
          return NEEDS_LLM;
        }
        // No target specified
        return NEEDS_LLM;
      }

      case 'scroll-to': {
        // Complex navigation -- always defer to LLM
        return NEEDS_LLM;
      }

      default:
        return NEEDS_LLM;
    }
  };
}
