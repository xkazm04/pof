import { ClipboardCheck, ShieldCheck, Wrench, Sprout, HelpCircle } from 'lucide-react';
import { normalizeFeatureSource } from '@/types/feature-matrix';
import type { FeatureSource } from '@/types/feature-matrix';
import { STATUS_NEUTRAL, ACCENT_CYAN_LIGHT, STATUS_SUCCESS, STATUS_WARNING } from '@/lib/chart-colors';
import { formatRelativeTime } from './helpers';

/**
 * Per-row provenance: WHEN this row was last given a verdict and by WHICH write path.
 *
 * The matrix used to carry a single module-level freshness dot, so a module whose
 * rows were reviewed months apart rendered one age for all of them — and no row could
 * say whether its status came from a code review, an asset-manifest match, the CLI
 * that performed the fix, or a bare seed. Source is encoded by GLYPH + WORD, never by
 * hue alone (WCAG 1.4.1).
 */
export const SOURCE_CONFIG: Record<
  FeatureSource,
  { label: string; color: string; icon: typeof ShieldCheck; title: string }
> = {
  review: {
    label: 'reviewed',
    color: STATUS_SUCCESS,
    icon: ClipboardCheck,
    title: 'Set by a CLI code review — an independent verdict on the implementation.',
  },
  verify: {
    label: 'verified',
    color: ACCENT_CYAN_LIGHT,
    icon: ShieldCheck,
    title: 'Set by matching the live UE5 asset manifest — observed, but only as far as the rule looks.',
  },
  fix: {
    label: 'fixed',
    color: STATUS_WARNING,
    icon: Wrench,
    title:
      'Self-reported by the CLI that made the change — a dated assertion about the new state, not an independent review.',
  },
  seed: {
    label: 'seeded',
    color: STATUS_NEUTRAL,
    icon: Sprout,
    title: 'Inserted from the static feature definitions — no verdict has ever been given.',
  },
  unknown: {
    label: 'unrecorded',
    color: STATUS_NEUTRAL,
    icon: HelpCircle,
    title: 'Written before provenance was recorded — nothing knows how this status was set.',
  },
};

export function FeatureProvenanceBadge({
  lastReviewedAt,
  source,
  testId,
}: {
  lastReviewedAt: string | null;
  source?: FeatureSource;
  testId?: string;
}) {
  const cfg = SOURCE_CONFIG[normalizeFeatureSource(source)];
  const SourceGlyph = cfg.icon;
  // A row with no review date is not "just now" and not zero days old — it is
  // undated, and says so.
  const age = lastReviewedAt ? formatRelativeTime(lastReviewedAt) : null;

  return (
    <span
      data-testid={testId}
      data-source={normalizeFeatureSource(source)}
      className="flex items-center gap-1 text-2xs flex-shrink-0"
      style={{ color: cfg.color }}
      title={`${cfg.title}${age ? `\nLast set: ${new Date(lastReviewedAt!).toLocaleString()}` : '\nNo review date recorded.'}`}
    >
      <SourceGlyph className="w-2.5 h-2.5" aria-hidden="true" />
      <span className="hidden md:inline">{cfg.label}</span>
      <span className="text-text-muted">{age ? age.label : 'never'}</span>
    </span>
  );
}
