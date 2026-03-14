import type { LayoutTemplate, LayoutTemplateId } from './types';

// ---------------------------------------------------------------------------
// Spatial Budget Types
// ---------------------------------------------------------------------------

/** Pixel dimensions for a single slot. */
export interface SlotDimensions {
  width: number;
  height: number;
}

/** A spatial option: one template with computed slot dimensions. */
export interface SpatialOption {
  templateId: LayoutTemplateId;
  slots: SlotDimensions[];
}

/** The full spatial budget: viewport info plus per-template options. */
export interface SpatialBudget {
  viewport: { width: number; height: number };
  options: SpatialOption[];
}

// ---------------------------------------------------------------------------
// Grid Fraction Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a CSS grid-template-columns or grid-template-rows value into
 * an array of fractional proportions that sum to 1.
 *
 * Handles:
 * - Plain fr units: "1fr", "3fr 2fr"
 * - Fixed px values: "300px 1fr" (px treated as fixed proportion of a reference)
 * - clamp() values: "clamp(200px, 18vw, 280px)" averaged as (min+max)/2
 * - repeat(auto-fill, ...) treated as a single 1fr
 */
export function parseGridFractions(template: string): number[] {
  // Handle repeat() notation as single fraction
  if (template.includes('repeat(')) {
    return [1.0];
  }

  const segments: Array<{ type: 'fr'; value: number } | { type: 'px'; value: number }> = [];

  // Tokenize: split on spaces but keep clamp() together
  const tokens: string[] = [];
  let depth = 0;
  let current = '';

  for (const ch of template) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ' ' && depth === 0) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());

  for (const token of tokens) {
    if (token.startsWith('clamp(')) {
      // clamp(min, preferred, max) => average of min and max
      const inner = token.slice(6, -1); // remove "clamp(" and ")"
      const parts = inner.split(',').map((s) => s.trim());
      const minVal = parseFloat(parts[0]);
      const maxVal = parseFloat(parts[2] ?? parts[0]);
      const avg = (minVal + maxVal) / 2;
      segments.push({ type: 'px', value: avg });
    } else if (token.endsWith('fr')) {
      const val = parseFloat(token);
      segments.push({ type: 'fr', value: isNaN(val) ? 1 : val });
    } else if (token.endsWith('px')) {
      const val = parseFloat(token);
      segments.push({ type: 'px', value: isNaN(val) ? 0 : val });
    } else {
      // Unknown token, treat as 1fr
      segments.push({ type: 'fr', value: 1 });
    }
  }

  if (segments.length === 0) return [1.0];

  // Calculate: fixed px segments get their proportion, fr segments share the rest
  // Use a reference total of 1920px for proportional calculation of px values
  const REFERENCE = 1920;
  const totalFixedPx = segments
    .filter((s) => s.type === 'px')
    .reduce((sum, s) => sum + s.value, 0);
  const totalFr = segments
    .filter((s) => s.type === 'fr')
    .reduce((sum, s) => sum + s.value, 0);

  const remainingFraction = Math.max(0, 1 - totalFixedPx / REFERENCE);

  const fractions = segments.map((seg) => {
    if (seg.type === 'px') {
      return seg.value / REFERENCE;
    }
    // fr: share of remaining space proportional to fr value
    return totalFr > 0 ? (seg.value / totalFr) * remainingFraction : remainingFraction;
  });

  // Normalize so they sum to exactly 1.0
  const sum = fractions.reduce((a, b) => a + b, 0);
  if (sum > 0) {
    return fractions.map((f) => f / sum);
  }
  return fractions;
}

// ---------------------------------------------------------------------------
// Slot Dimension Estimation
// ---------------------------------------------------------------------------

/**
 * Parse a grid style value (e.g. "1", "1 / -1", "2") to determine which
 * row/column indices a slot spans. Returns [startIdx, endIdx] (0-based).
 */
function parseGridSpan(
  value: string | undefined,
  trackCount: number,
): [number, number] {
  if (!value) return [0, 1];

  const str = String(value).trim();

  // Handle "N / -1" (span to end)
  if (str.includes('/')) {
    const [startStr, endStr] = str.split('/').map((s) => s.trim());
    const start = parseInt(startStr, 10) - 1; // CSS grid is 1-based
    const end = endStr === '-1' ? trackCount : parseInt(endStr, 10) - 1;
    return [Math.max(0, start), Math.max(start + 1, end)];
  }

  // Single value: "1", "2", etc. (1-based)
  const idx = parseInt(str, 10) - 1;
  return [Math.max(0, idx), Math.max(0, idx) + 1];
}

/**
 * Estimate pixel dimensions for each slot in a layout template given
 * viewport dimensions.
 *
 * Uses parseGridFractions to convert grid-template-columns and
 * grid-template-rows into proportional fractions, then maps each slot's
 * grid placement to pixel widths and heights.
 */
export function estimateSlotDimensions(
  template: LayoutTemplate,
  viewportWidth: number,
  viewportHeight: number,
): SlotDimensions[] {
  const colFractions = parseGridFractions(template.gridTemplateColumns);
  const rowFractions = parseGridFractions(template.gridTemplateRows);

  const colWidths = colFractions.map((f) => f * viewportWidth);
  const rowHeights = rowFractions.map((f) => f * viewportHeight);

  return template.slots.map((slot) => {
    const [colStart, colEnd] = parseGridSpan(
      slot.style.gridColumn as string | undefined,
      colFractions.length,
    );
    const [rowStart, rowEnd] = parseGridSpan(
      slot.style.gridRow as string | undefined,
      rowFractions.length,
    );

    let width = 0;
    for (let c = colStart; c < colEnd && c < colWidths.length; c++) {
      width += colWidths[c];
    }

    let height = 0;
    for (let r = rowStart; r < rowEnd && r < rowHeights.length; r++) {
      height += rowHeights[r];
    }

    // Fallback: if somehow 0, use full viewport
    if (width <= 0) width = viewportWidth;
    if (height <= 0) height = viewportHeight;

    return { width: Math.round(width), height: Math.round(height) };
  });
}

// ---------------------------------------------------------------------------
// Spatial Budget Computation
// ---------------------------------------------------------------------------

/**
 * Compute the spatial budget for a set of templates at a given viewport size.
 * Returns pixel-level slot dimensions for each template option.
 */
export function computeSpatialBudget(
  viewport: { width: number; height: number },
  templates: LayoutTemplate[],
): SpatialBudget {
  const options: SpatialOption[] = templates.map((template) => ({
    templateId: template.id,
    slots: estimateSlotDimensions(template, viewport.width, viewport.height),
  }));

  return { viewport, options };
}
