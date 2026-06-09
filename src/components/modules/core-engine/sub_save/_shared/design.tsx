export {
  CornerBrackets, ScanlineOverlay, BlueprintPanel,
  SectionHeader, GlowStat, NeonBar,
} from '../../unique-tabs/_design';

/**
 * Save-module type scale — a deliberate hierarchy so the eye has an anchor.
 *
 * The save panels used to be wall-to-wall `text-xs font-mono uppercase
 * tracking-[0.15em]`, which flattens hierarchy: titles, numbers and field
 * labels all shout at the same volume and the result reads as dense and
 * engineer-only. These roles restore a calm hierarchy and, crucially,
 * **reserve mono + UPPERCASE strictly for `code` and `axis`** — identifiers,
 * enum/status badges and chart ticks. Everything else is sentence-case copy
 * sitting at or above an 11px legibility floor (no more `text-[9px]`).
 *
 * Pairs with the app-wide floor in {@link file://src/lib/typography-scale.ts}
 * (`text-xs` is the readable floor); this scale just adds the title/hero/code
 * roles the save panels need and lifts the local metadata floor to 11px.
 */
export const SAVE_TYPE = {
  /** Panel & sub-section titles — the anchors. Sentence case, never forced caps. */
  title: 'text-sm font-semibold',
  /** Hero stat values — the numbers that matter most. */
  hero: 'text-lg font-bold tabular-nums leading-none',
  /** Supporting copy — descriptions, field labels, captions. Sentence case, 12px. */
  body: 'text-xs',
  /** Smallest metadata — counts/units kept above the 11px legibility floor. */
  meta: 'text-[11px]',
  /** Codes, identifiers & enum/status badges — the ONLY home for mono + uppercase. */
  code: 'font-mono uppercase tracking-[0.15em]',
  /** Chart-axis / diagram tick labels — small mono, never below 11px. */
  axis: 'text-[11px] font-mono leading-none',
} as const;

export type SaveTypeRole = keyof typeof SAVE_TYPE;
