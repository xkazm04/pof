import type { WorkspaceState } from '../../state/types';
import type { PanelDensity } from '../../types/panel';
import type { Intent, IntentResult, IntentHandler, ManipulatePayload } from '../types';
import { NEEDS_LLM } from '../director';

// ---------------------------------------------------------------------------
// Density from Dimensions (inline, avoids needing PanelDefinition)
// ---------------------------------------------------------------------------

/**
 * Determine density from pixel dimensions using fallback thresholds.
 * This mirrors the logic in layout/density.ts but without requiring
 * a PanelDefinition, since the manipulate handler operates on panel instances.
 */
const FALLBACK_THRESHOLDS: Record<PanelDensity, { minWidth: number; minHeight: number }> = {
  full: { minWidth: 400, minHeight: 300 },
  compact: { minWidth: 180, minHeight: 120 },
  micro: { minWidth: 60, minHeight: 40 },
};

const DENSITY_ORDER: PanelDensity[] = ['full', 'compact', 'micro'];

function densityFromDimensions(width: number, height: number): PanelDensity {
  for (const density of DENSITY_ORDER) {
    const t = FALLBACK_THRESHOLDS[density];
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
