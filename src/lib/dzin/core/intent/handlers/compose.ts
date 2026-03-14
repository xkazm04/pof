import type { Operation } from 'fast-json-patch';
import type { PanelDirective } from '../../layout/types';
import type { WorkspaceState } from '../../state/types';
import type { Intent, IntentResult, IntentHandler, ComposePayload } from '../types';
import { NEEDS_LLM } from '../director';

// ---------------------------------------------------------------------------
// Workflow Hints Type
// ---------------------------------------------------------------------------

type WorkflowHints = Record<string, PanelDirective[]>;

// ---------------------------------------------------------------------------
// Compose Handler Factory
// ---------------------------------------------------------------------------

/**
 * Creates a local handler for compose intents: open, close, swap, set-layout.
 *
 * - `close`: Finds the panel by ID in current state and generates a remove patch.
 * - `set-layout`: Generates a replace patch for /layout/template.
 * - `open`: Checks registry for panel type existence. If hint exists, resolves
 *   locally with add patches. If no hint, returns NEEDS_LLM.
 * - `swap`: Always returns NEEDS_LLM (complex composition).
 *
 * @param registryHas - Function to check if a panel type exists in the registry.
 * @param hints - Workflow hints map (panel type -> directive arrays).
 * @param getState - Accessor for current workspace state.
 */
export function createComposeHandler(
  registryHas: (type: string) => boolean,
  hints: WorkflowHints,
  getState: () => WorkspaceState,
): IntentHandler {
  return (intent: Intent): IntentResult | typeof NEEDS_LLM => {
    const payload = intent.payload as ComposePayload;

    switch (payload.action) {
      case 'close': {
        if (!payload.panelId) {
          return NEEDS_LLM;
        }
        const state = getState();
        const index = state.panels.findIndex((p) => p.id === payload.panelId);
        if (index === -1) {
          return { status: 'error', error: `Panel not found: ${payload.panelId}` };
        }
        return {
          status: 'resolved',
          patches: [{ op: 'remove', path: `/panels/${index}` }],
          origin: 'user',
          description: `Close panel ${payload.panelId}`,
        };
      }

      case 'set-layout': {
        if (!payload.template) {
          return NEEDS_LLM;
        }
        return {
          status: 'resolved',
          patches: [
            { op: 'replace', path: '/layout/template', value: payload.template },
          ],
          origin: 'user',
          description: `Switch layout to ${payload.template}`,
        };
      }

      case 'open': {
        if (!payload.panelType) {
          return NEEDS_LLM;
        }
        // Check if panel type exists in registry
        if (!registryHas(payload.panelType)) {
          return {
            status: 'error',
            error: `Unknown panel type: ${payload.panelType}`,
          };
        }
        // Check for workflow hints (local composition)
        const hintDirectives = hints[payload.panelType];
        if (!hintDirectives) {
          // Complex composition -- needs LLM
          return NEEDS_LLM;
        }
        // Resolve locally: generate add patches for each directive panel
        const patches: Operation[] = hintDirectives.map((directive, i) => ({
          op: 'add' as const,
          path: '/panels/-',
          value: {
            id: `${directive.type}-${Date.now()}-${i}`,
            type: directive.type,
            slotIndex: i,
            density: directive.density ?? 'full',
            role: directive.role ?? 'primary',
            dataSlice: directive.dataSlice,
            uiState: {},
          },
        }));
        return {
          status: 'resolved',
          patches,
          origin: 'user',
          description: `Open ${payload.panelType} with workflow hint`,
        };
      }

      case 'swap': {
        // Complex: always defer to LLM
        return NEEDS_LLM;
      }

      default:
        return NEEDS_LLM;
    }
  };
}
