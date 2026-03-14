import type { PanelDensity } from '../types/panel';
import type { PanelDefinition } from '../registry/types';

// ---------------------------------------------------------------------------
// Fallback Density Thresholds
// ---------------------------------------------------------------------------

/**
 * Default thresholds used when a panel has no densityModes config for a
 * given density level. These ensure every panel gets a reasonable density
 * assignment even without explicit configuration.
 */
const FALLBACK_THRESHOLDS: Record<PanelDensity, { minWidth: number; minHeight: number }> = {
  full: { minWidth: 400, minHeight: 300 },
  compact: { minWidth: 180, minHeight: 120 },
  micro: { minWidth: 60, minHeight: 40 },
};

/** Density levels ordered from highest to lowest. */
const DENSITY_ORDER: PanelDensity[] = ['full', 'compact', 'micro'];

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
    const thresholds = config ?? FALLBACK_THRESHOLDS[density];

    if (slotWidthPx >= thresholds.minWidth && slotHeightPx >= thresholds.minHeight) {
      return density;
    }
  }

  // Nothing fits -- micro is the floor
  return 'micro';
}
