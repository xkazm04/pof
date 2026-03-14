import type { PanelDensity } from '../types/panel';
import type { PanelDefinition } from '../registry/types';
import { assignSlotDensity } from '../layout/density';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum panel dimension in pixels. No panel can be resized smaller than this. */
export const MIN_PANEL_PX = 60;

/** Hysteresis buffer in pixels. After a density change, require this much additional
 *  movement past the threshold before allowing another density change. */
const HYSTERESIS_BUFFER_PX = 20;

// ---------------------------------------------------------------------------
// Resize State
// ---------------------------------------------------------------------------

/**
 * Captures the starting state for a drag-resize operation.
 * Passed to `computeResize` on every pointer move to compute new fractions.
 */
export interface ResizeState {
  /** Panel being resized. */
  panelId: string;
  /** Which edge the user is dragging. */
  edge: 'left' | 'right' | 'top' | 'bottom';
  /** Starting pointer X. */
  startX: number;
  /** Starting pointer Y. */
  startY: number;
  /** Starting grid fractions (column or row depending on edge). */
  startFractions: number[];
  /** Index of the track being adjusted. */
  trackIndex: number;
  /** Panel definition for density threshold lookups. */
  panelDef: PanelDefinition;
  /** Density at the start of the drag (or after last density change). */
  lastDensity: PanelDensity;
  /** The pixel dimension at which the last density change occurred. 0 means no change yet. */
  densityChangePx: number;
}

// ---------------------------------------------------------------------------
// initResizeState
// ---------------------------------------------------------------------------

/**
 * Capture starting state for a drag-resize operation.
 *
 * @param panelId - ID of the panel being resized.
 * @param edge - Which edge is being dragged.
 * @param startX - Starting pointer X position.
 * @param startY - Starting pointer Y position.
 * @param currentFractions - Current grid fractions (column or row).
 * @param trackIndex - Index of the track being adjusted.
 * @param panelDef - Panel definition for density lookups.
 * @param currentDensity - Current density of the panel.
 */
export function initResizeState(
  panelId: string,
  edge: 'left' | 'right' | 'top' | 'bottom',
  startX: number,
  startY: number,
  currentFractions: number[],
  trackIndex: number,
  panelDef: PanelDefinition,
  currentDensity: PanelDensity,
): ResizeState {
  return {
    panelId,
    edge,
    startX,
    startY,
    startFractions: [...currentFractions],
    trackIndex,
    panelDef,
    lastDensity: currentDensity,
    densityChangePx: 0,
  };
}

// ---------------------------------------------------------------------------
// computeResize
// ---------------------------------------------------------------------------

/**
 * Given a pointer delta and the current resize state, compute new grid
 * fractions and the resulting density for the resized panel.
 *
 * Pure function -- no side effects, no DOM access.
 *
 * Per research pitfall #1: works in pixel space during drag, converts to
 * fractions at the end (single conversion per call, not cumulative drift).
 *
 * @param state - Resize state captured at drag start.
 * @param deltaX - Horizontal pointer displacement from start (px).
 * @param deltaY - Vertical pointer displacement from start (px).
 * @param containerWidth - Total container width in pixels.
 * @param containerHeight - Total container height in pixels.
 * @returns New fractions, resulting density, and pixel dimensions.
 */
export function computeResize(
  state: ResizeState,
  deltaX: number,
  deltaY: number,
  containerWidth: number,
  containerHeight: number,
): { fractions: number[]; density: PanelDensity; widthPx: number; heightPx: number } {
  const isHorizontal = state.edge === 'left' || state.edge === 'right';
  const containerSize = isHorizontal ? containerWidth : containerHeight;
  const delta = isHorizontal ? deltaX : deltaY;

  // Work in pixel space: compute starting pixel sizes from fractions
  const startPixels = state.startFractions.map((f) => f * containerSize);

  // Apply delta: add to trackIndex, subtract from trackIndex + 1
  const idx = state.trackIndex;
  const nextIdx = idx + 1;

  if (nextIdx >= startPixels.length) {
    // No adjacent track to adjust -- return unchanged
    return {
      fractions: [...state.startFractions],
      density: state.lastDensity,
      widthPx: startPixels[idx],
      heightPx: isHorizontal ? containerHeight : startPixels[idx],
    };
  }

  let leftPx = startPixels[idx] + delta;
  let rightPx = startPixels[nextIdx] - delta;

  // Clamp: minimum panel dimension
  const minFraction = MIN_PANEL_PX / containerSize;

  if (leftPx < MIN_PANEL_PX) {
    const overflow = MIN_PANEL_PX - leftPx;
    leftPx = MIN_PANEL_PX;
    rightPx -= overflow; // give overflow back -- but actually rightPx already had the delta removed, so just clamp
    rightPx = startPixels[idx] + startPixels[nextIdx] - MIN_PANEL_PX;
  }

  if (rightPx < MIN_PANEL_PX) {
    const overflow = MIN_PANEL_PX - rightPx;
    rightPx = MIN_PANEL_PX;
    leftPx = startPixels[idx] + startPixels[nextIdx] - MIN_PANEL_PX;
  }

  // Convert back to fractions
  const newFractions = [...state.startFractions];
  newFractions[idx] = leftPx / containerSize;
  newFractions[nextIdx] = rightPx / containerSize;

  // Compute resulting panel pixel dimensions
  const widthPx = isHorizontal ? leftPx : containerWidth;
  const heightPx = isHorizontal ? containerHeight : leftPx;

  // Determine density via assignSlotDensity
  const rawDensity = assignSlotDensity(state.panelDef, widthPx, heightPx);

  // Apply hysteresis: after a density change, require HYSTERESIS_BUFFER_PX
  // movement past the threshold before allowing another change
  let density = rawDensity;
  const relevantDimension = isHorizontal ? widthPx : heightPx;

  if (state.densityChangePx > 0 && rawDensity !== state.lastDensity) {
    // A previous density change occurred at densityChangePx
    // To change back, must move at least HYSTERESIS_BUFFER_PX past that point
    const distanceFromLastChange = Math.abs(relevantDimension - state.densityChangePx);
    if (distanceFromLastChange < HYSTERESIS_BUFFER_PX) {
      density = state.lastDensity; // suppress the change
    }
  }

  return { fractions: newFractions, density, widthPx, heightPx };
}
