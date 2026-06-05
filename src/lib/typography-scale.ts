/**
 * Typography scale — the app's two-tier rule for sub-`sm` text, in one place.
 *
 * The readable floor is `text-xs` (12px, `--text-xs`). Descriptive copy — subtitles,
 * descriptions, help text, notes, captions — must sit at or above it. `text-2xs`
 * (10px, `--text-2xs`) is reserved strictly for *dense metadata*: counts, units, mono
 * identifiers, badges, axis/diagram labels, timestamps — where compactness beats prose
 * readability.
 *
 * Reach for these tokens (instead of raw `text-xs` / `text-2xs`) so each call site states
 * its role and the hierarchy stays consistent. `TEXT_SCALE.meta` is exactly the `text-2xs`
 * class, so existing `text-2xs` metadata already complies — no need to churn it.
 *
 * The rule, concretely:
 *   - Promote descriptive copy that sits below the floor → {@link TEXT_SCALE.body}.
 *   - Normalize stray sub-floor literals (`text-[10px]`, `text-[11px]`) on metadata
 *     → {@link TEXT_SCALE.meta} so there is a single metadata size.
 */
export const TEXT_SCALE = {
  /** 12px floor — descriptive copy: subtitles, descriptions, help/notes, captions. */
  body: 'text-xs',
  /** 10px — dense metadata only: counts, units, mono identifiers, badges, diagram labels. */
  meta: 'text-2xs',
} as const;

export type TextScaleRole = keyof typeof TEXT_SCALE;
