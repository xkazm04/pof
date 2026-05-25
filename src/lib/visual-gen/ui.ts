/**
 * Shared Tailwind class strings for the visual-gen cluster (asset browser,
 * viewer, procedural engine, auto-rig).
 */

/**
 * Keyboard focus-visible ring for selectable controls in the visual-gen cluster.
 * Mirrors the treatment already used on AssetCard so focus is visible and
 * consistent everywhere. Pair it with `aria-pressed` (toggle/option buttons) or
 * `aria-selected` so assistive tech also knows which option is active.
 *
 * NOTE: keep this a static string literal — Tailwind's JIT only picks up the
 * arbitrary `ring-[var(--visual-gen)]` class from literals, never from values
 * built via template interpolation.
 */
export const VISUAL_GEN_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--visual-gen)]';
