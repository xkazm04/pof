import type { HazardSeverity, TranslationStatus } from '@/types/localization-pipeline';
import { SUPPORTED_LOCALES } from '@/lib/localization/definitions';
import { SEVERITY_TOKENS } from '@/lib/chart-colors';
import { TEXT_SCALE } from '@/lib/typography-scale';
import type { StringPreset, TranslationPreset } from './types';

// ── Constants ───────────────────────────────────────────────────────────────

// Type scale — three tiers give this dense localization data a scannable
// hierarchy instead of a flat wall of muted text-2xs. Sizes compose the app-wide
// TEXT_SCALE floor (text-xs) so the view never dips below the readable minimum;
// this layer adds the weight + text tone that separates a section title from
// primary content from dense metadata.
export const SCALE = {
  /** Card / section heading — anchors each panel (text-sm sits above the floor). */
  title: 'text-sm font-semibold text-text',
  /** Primary content — strings, translations, finding labels. */
  body: `${TEXT_SCALE.body} text-text`,
  /** Dense metadata — counts, paths, locale codes, units. */
  meta: `${TEXT_SCALE.meta} text-text-muted`,
} as const;

// Hazard severity and translation status colors are routed through SEVERITY_TOKENS
// (chart-colors) so they share one theme-aware source with the rest of the
// evaluator instead of drifting Tailwind palette classes. `HazardSeverity`
// (critical/warning/info) maps directly onto the matching token keys; the Badge
// variant is the only piece SEVERITY_TOKENS doesn't carry, so it stays a small map.
export const SEVERITY_BADGE: Record<HazardSeverity, 'error' | 'warning' | 'default'> = {
  critical: 'error',
  warning:  'warning',
  info:     'default',
};

// Translation status → solid token color + label. `pending` has no severity
// (it's the "not started" neutral), so it keeps the theme-aware muted text var.
export const STATUS_STYLE: Record<TranslationStatus, { color: string; label: string }> = {
  pending:      { color: 'var(--text-muted)',           label: 'Pending' },
  translated:   { color: SEVERITY_TOKENS.positive.color, label: 'Translated' },
  reviewed:     { color: SEVERITY_TOKENS.info.color,     label: 'Reviewed' },
  approved:     { color: SEVERITY_TOKENS.positive.color, label: 'Approved' },
  needs_review: { color: SEVERITY_TOKENS.warning.color,  label: 'Needs Review' },
};

export const STRING_PRESET_LABELS: Record<StringPreset, string> = {
  'hardcoded': 'Hardcoded Only',
  'low-confidence': 'Low Confidence',
  'missing-translations': 'Missing Translations',
  'critical-hazards': 'Critical Hazards',
};

export const TRANSLATION_PRESET_LABELS: Record<TranslationPreset, string> = {
  'low-confidence': 'Low Confidence',
  'needs-review': 'Needs Review',
  'qa-failures': 'QA',
  'missing-translations': 'Missing Translations',
  'expansion-warnings': 'Expansion Warnings',
};

export const MAX_EXPANSION = Math.max(...SUPPORTED_LOCALES.map((l) => l.expansionFactor));
