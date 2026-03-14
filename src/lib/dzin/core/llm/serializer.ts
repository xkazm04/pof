import type { Intent } from '../intent/types';
import type { SerializedContext, WorkspaceSnapshot } from './types';

// ---------------------------------------------------------------------------
// serializeForClaude
// ---------------------------------------------------------------------------

/**
 * Converts an intent + workspace snapshot into a structured JSON string
 * suitable for sending to Claude (or any LLM).
 *
 * The output is a stable JSON representation of {@link SerializedContext}.
 * Optional entities (selected project/act/scene IDs) are included only
 * when provided, keeping the payload lean for simple intents.
 */
export function serializeForClaude(
  intent: Intent,
  snapshot: WorkspaceSnapshot,
  entities?: SerializedContext['entities'],
): string {
  const context: SerializedContext = {
    intent: {
      id: intent.id,
      type: intent.type,
      payload: intent.payload,
      source: intent.source,
    },
    workspace: snapshot,
  };

  if (entities) {
    context.entities = entities;
  }

  return JSON.stringify(context);
}
