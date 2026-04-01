import type { PanelDensity } from '../types/panel';
import type { PanelDefinition } from '../registry/types';
import { DENSITY_CONFIG, DENSITY_ORDER } from '@/lib/dzin/animation-constants';

// ---------------------------------------------------------------------------
// Density Assignment
// ---------------------------------------------------------------------------

/**
 * Determine the best density for a panel given the slot's pixel dimensions.
 *
 * Tries densities in order: full -> compact -> micro.
 * For each density, checks the panel's densityModes config (or FALLBACK_THRESHOLDS)
 * to see if the slot meets minimum width/height requirements.
 *
 * If explicitDensity is provided (LLM override), it is returned immediately
 * regardless of slot dimensions.
 *
 * Falls back to 'micro' if no density fits.
 *
 * @param panel - Panel definition with optional densityModes
 * @param slotWidthPx - Available slot width in pixels
 * @param slotHeightPx - Available slot height in pixels
 * @param explicitDensity - Optional LLM-specified density override
 * @returns The assigned PanelDensity
 */
export function assignSlotDensity(
  panel: PanelDefinition,
  slotWidthPx: number,
  slotHeightPx: number,
  explicitDensity?: PanelDensity,
): PanelDensity {
  // LLM override takes precedence
  if (explicitDensity) {
    return explicitDensity;
  }

  const modes = panel.densityModes;

  for (const density of DENSITY_ORDER) {
    const config = modes?.[density];
    const thresholds = config ?? DENSITY_CONFIG.fallback[density];

    if (slotWidthPx >= thresholds.minWidth && slotHeightPx >= thresholds.minHeight) {
      return density;
    }
  }

  // Nothing fits -- micro is the floor
  return 'micro';
}
