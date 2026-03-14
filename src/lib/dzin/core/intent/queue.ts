import type { Intent, ManipulatePayload } from './types';
import type { WorkspaceState } from '../state/types';

// ---------------------------------------------------------------------------
// Intent Queue Interface
// ---------------------------------------------------------------------------

/**
 * Buffers LLM intents during active user manipulation.
 * On release, queued intents are either applied (non-conflicting)
 * or silently dropped (conflicting with user's final state).
 */
export interface IntentQueue {
  /** Start buffering LLM intents for the given panel path. */
  startBuffering(path: string, initialState?: WorkspaceState): void;
  /** Stop buffering for the given path, clearing any buffered intents. */
  stopBuffering(path: string): void;
  /** Enqueue an LLM intent that targets a buffered path. Returns true if buffered. */
  enqueue(intent: Intent): boolean;
  /** Drain the queue: return non-conflicting intents, drop conflicts. */
  drain(currentState: WorkspaceState): Intent[];
  /** Check if any path is currently buffering. */
  isBuffering(): boolean;
}

// ---------------------------------------------------------------------------
// Buffer Entry
// ---------------------------------------------------------------------------

interface BufferEntry {
  /** Intents queued for this path. */
  intents: Intent[];
  /** Snapshot of the panel state when buffering started. */
  initialPanelSnapshot: {
    id: string;
    density: string;
    slotIndex: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Helper: Extract panelId from intent
// ---------------------------------------------------------------------------

function extractPanelId(intent: Intent): string | null {
  if (intent.type === 'manipulate' || intent.type === 'compose') {
    const payload = intent.payload as ManipulatePayload;
    return payload.panelId ?? null;
  }
  return null;
}

function panelIdToPath(panelId: string): string {
  return `/panels/${panelId}`;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an IntentQueue for buffering LLM intents during user manipulation.
 *
 * Usage:
 * 1. On pointerdown: `queue.startBuffering('/panels/{id}', currentState)`
 * 2. When LLM intent arrives: `queue.enqueue(intent)` -- returns true if buffered
 * 3. On pointerup: `queue.drain(currentState)` -- returns non-conflicting intents
 */
export function createIntentQueue(): IntentQueue {
  const buffers = new Map<string, BufferEntry>();

  function startBuffering(path: string, initialState?: WorkspaceState): void {
    // Extract panel ID from path like "/panels/p1"
    const panelId = path.replace('/panels/', '');
    let snapshot: BufferEntry['initialPanelSnapshot'] = null;

    if (initialState) {
      const panel = initialState.panels.find((p) => p.id === panelId);
      if (panel) {
        snapshot = {
          id: panel.id,
          density: panel.density,
          slotIndex: panel.slotIndex,
        };
      }
    }

    buffers.set(path, {
      intents: [],
      initialPanelSnapshot: snapshot,
    });
  }

  function stopBuffering(path: string): void {
    buffers.delete(path);
  }

  function enqueue(intent: Intent): boolean {
    const panelId = extractPanelId(intent);
    if (!panelId) return false;

    const path = panelIdToPath(panelId);
    const entry = buffers.get(path);

    if (!entry) return false;

    entry.intents.push(intent);
    return true;
  }

  function drain(currentState: WorkspaceState): Intent[] {
    const result: Intent[] = [];

    for (const [path, entry] of buffers) {
      const panelId = path.replace('/panels/', '');

      for (const intent of entry.intents) {
        // Check for conflict: has the panel's state changed since buffering started?
        if (entry.initialPanelSnapshot) {
          const currentPanel = currentState.panels.find((p) => p.id === panelId);
          if (currentPanel) {
            const hasConflict =
              currentPanel.density !== entry.initialPanelSnapshot.density ||
              currentPanel.slotIndex !== entry.initialPanelSnapshot.slotIndex;

            if (hasConflict) {
              // Silently drop conflicting intent
              continue;
            }
          }
        }

        result.push(intent);
      }

      // Clear the buffer after draining
      entry.intents = [];
    }

    return result;
  }

  function isBuffering(): boolean {
    return buffers.size > 0;
  }

  return { startBuffering, stopBuffering, enqueue, drain, isBuffering };
}
