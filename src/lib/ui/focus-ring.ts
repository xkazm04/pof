/**
 * Shared focus-ring utility — restores a visible 2px keyboard-focus indicator
 * in the active module accent (with offset) and replaces the dozens of
 * `focus:outline-none focus:border-blue-500/50` snippets scattered across the
 * loot/catalog/AI-designer UIs.
 *
 * Usage pattern:
 *
 *   <input
 *     className={`... ${FOCUS_RING_CLASS}`}
 *     style={focusRingStyle(ACCENT)}
 *   />
 *
 *   <input type="range" style={accentColorStyle(ACCENT)} />
 *
 * Or — if the control sits inside a `<BlueprintPanel color={ACCENT}>` (which
 * already sets `--focus-accent` via inline style) — only the class is needed:
 *
 *   <input className={`... ${FOCUS_RING_CLASS}`} />
 *
 * The CSS for `.focus-ring` / `.focus-ring-inset` lives in `src/app/globals.css`
 * and reads `var(--focus-accent, <fallback>)`.
 */
import type { CSSProperties } from 'react';

/** Outer 2px ring with 2px offset — for buttons, cards, anything with breathing room. */
export const FOCUS_RING_CLASS = 'focus-ring';

/** Inset 1px ring + border — for inputs/selects/textareas that already have a border. */
export const FOCUS_RING_INSET_CLASS = 'focus-ring-inset';

/**
 * Inline style that sets the `--focus-accent` CSS variable for this element and
 * its descendants. Apply at panel/section level so every interactive control
 * inside picks up the surrounding module accent automatically.
 */
export function focusRingStyle(accent: string): CSSProperties {
  return { ['--focus-accent' as string]: accent } as CSSProperties;
}

/**
 * Inline style for `<input type="range">` so its track/thumb (`accent-color`)
 * matches the active module accent — replaces hardcoded `accent-blue-500`.
 */
export function accentColorStyle(accent: string): CSSProperties {
  return { accentColor: accent };
}
