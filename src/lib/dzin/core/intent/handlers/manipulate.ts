import type { WorkspaceState } from '../../state/types';
import type { PanelDensity } from '../../types/panel';
import type { Intent, IntentResult, IntentHandler, ManipulatePayload } from '../types';
import { NEEDS_LLM } from '../director';
import { DENSITY_CONFIG, DENSITY_ORDER } from '@/lib/dzin/animation-constants';

// ---------------------------------------------------------------------------
// Density from Dimensions
// ---------------------------------------------------------------------------

/**
 * Determine density from pixel dimensions using canonical fallback thresholds.
 * Uses DENSITY_CONFIG.fallback since the manipulate handler operates on panel
 * instances without a PanelDefinition.
 */
function densityFromDimensions(width: number, height: number): PanelDensity {
  for (const density of DENSITY_ORDER) {
    const t = DENSITY_CONFIG.fallback[density];
    if (width >= t.minWidth && height >= t.minHeight) {
      return density;
    }
  }
  return 'micro';
}

// ---------------------------------------------------------------------------
// Manipulate Handler Factory
// ---------------------------------------------------------------------------

/**
 * Creates a local handler for manipulate intents: resize, set-density.
 *
 * - `resize`: Finds panel by ID, computes new density from width/height,
 *   generates replace patch for panel density.
 * - `set-density`: Finds panel by ID, generates replace patch for density field.
 * - Returns error if panelId not found.
 *
 * @param getState - Accessor for current workspace state.
 */
export function createManipulateHandler(
  getState: () => WorkspaceState,
): IntentHandler {
  return (intent: Intent): IntentResult | typeof NEEDS_LLM => {
    const payload = intent.payload as ManipulatePayload;
    const state = getState();
    const index = state.panels.findIndex((p) => p.id === payload.panelId);

    if (index === -1) {
      return {
        status: 'error',
        error: `Panel not found: ${payload.panelId}`,
      };
    }

    switch (payload.action) {
      case 'resize': {
        const width = payload.width ?? 0;
        const height = payload.height ?? 0;
        const newDensity = densityFromDimensions(width, height);

        return {
          status: 'resolved',
          patches: [
            { op: 'replace', path: `/panels/${index}/density`, value: newDensity },
          ],
          origin: 'user',
          description: `Resize panel ${payload.panelId} to ${newDensity}`,
        };
      }

      case 'set-density': {
        if (!payload.density) {
          return { status: 'error', error: 'set-density requires density value' };
        }
        return {
          status: 'resolved',
          patches: [
            { op: 'replace', path: `/panels/${index}/density`, value: payload.density },
          ],
          origin: 'user',
          description: `Set density of ${payload.panelId} to ${payload.density}`,
        };
      }

      default:
        return NEEDS_LLM;
    }
  };
}
