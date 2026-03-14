import type { LayoutTemplateId } from './types';

// ---------------------------------------------------------------------------
// Viewport Breakpoints
// ---------------------------------------------------------------------------

/**
 * Viewport width breakpoints for layout filtering.
 * Based on src/workspace/engine/layoutEngine.ts lines 52-98.
 *
 * - mobile: < 768px  -- stack/single only
 * - tablet: < 1024px -- adds split-2, primary-sidebar
 * - desktop: < 1280px -- adds split-3, triptych
 * - wide: >= 1280px  -- all layouts including grid-4, studio
 */
export const VIEWPORT_BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280,
} as const;

// ---------------------------------------------------------------------------
// Layout Availability Per Tier
// ---------------------------------------------------------------------------

/** Mobile: only stack and single. */
const MOBILE_LAYOUTS: LayoutTemplateId[] = ['stack', 'single'];

/** Tablet: adds 2-panel layouts. */
const TABLET_LAYOUTS: LayoutTemplateId[] = [
  ...MOBILE_LAYOUTS,
  'split-2',
  'primary-sidebar',
];

/** Desktop: adds 3-panel layouts. */
const DESKTOP_LAYOUTS: LayoutTemplateId[] = [
  ...TABLET_LAYOUTS,
  'split-3',
  'triptych',
];

/** Wide: all layouts. */
const WIDE_LAYOUTS: LayoutTemplateId[] = [
  ...DESKTOP_LAYOUTS,
  'grid-4',
  'studio',
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the set of layout template IDs allowed for a given viewport width.
 * Wider viewports unlock more complex layouts.
 *
 * @param viewportWidth - Current viewport width in pixels
 * @returns Array of allowed LayoutTemplateId values
 */
export function getAllowedLayouts(viewportWidth: number): LayoutTemplateId[] {
  if (viewportWidth < VIEWPORT_BREAKPOINTS.mobile) {
    return [...MOBILE_LAYOUTS];
  }
  if (viewportWidth < VIEWPORT_BREAKPOINTS.tablet) {
    return [...TABLET_LAYOUTS];
  }
  if (viewportWidth < VIEWPORT_BREAKPOINTS.desktop) {
    return [...DESKTOP_LAYOUTS];
  }
  return [...WIDE_LAYOUTS];
}

/**
 * If a requested layout template is not allowed at the current viewport width,
 * downgrade it to the best available alternative.
 *
 * Downgrade preference:
 * - studio/grid-4 -> split-2 or primary-sidebar -> single
 * - split-3/triptych -> split-2 or primary-sidebar -> single
 * - split-2/primary-sidebar -> single
 *
 * @param templateId - Requested template
 * @param viewportWidth - Current viewport width in pixels
 * @returns The same templateId if allowed, or a downgraded alternative
 */
export function clampLayoutToViewport(
  templateId: LayoutTemplateId,
  viewportWidth: number,
): LayoutTemplateId {
  const allowed = getAllowedLayouts(viewportWidth);

  if (allowed.includes(templateId)) {
    return templateId;
  }

  // Downgrade chain: prefer the most complex allowed layout
  // Priority: primary-sidebar > split-2 > single > stack
  const downgradePreference: LayoutTemplateId[] = [
    'triptych',
    'split-3',
    'primary-sidebar',
    'split-2',
    'single',
    'stack',
  ];

  for (const candidate of downgradePreference) {
    if (allowed.includes(candidate)) {
      return candidate;
    }
  }

  // Ultimate fallback
  return 'single';
}
