'use client';

import type { SessionSource } from '@/types/game-director';
import type { ScoreSource } from '@/lib/game-director-db';
import { StatusChip } from '@/components/ui/StatusChip';
import {
  SOURCE_TOKENS, SOURCE_DESCRIPTIONS, resolveSessionSource,
} from '@/lib/game-director-styles';
import { withOpacity, OPACITY_8, OPACITY_20, ACCENT_PURPLE } from '@/lib/chart-colors';

/**
 * The Game Director's honesty surface. Every score, coverage figure and trend in
 * this module can come from either the in-repo simulator (authored findings, no
 * build launched, nothing measured) or a real harness writing through the
 * external writer API — and until this component existed the UI showed both as
 * the same authoritative number.
 *
 * Display only: it reads provenance, it never sets or influences it.
 */

/** Chip form — sits beside a score/session title. */
export function ProvenanceChip({
  source,
  className = '',
}: {
  source: SessionSource;
  className?: string;
}) {
  return (
    <StatusChip
      token={SOURCE_TOKENS[source]}
      showIcon
      density="dense"
      className={className}
    />
  );
}

/**
 * Banner form — states what the number on screen is, and what it is not.
 * `findingsCount`, when given, names how many canned findings the figure is
 * arithmetic over ("Simulated · 5 canned findings").
 */
export function ProvenanceNotice({
  source,
  findingsCount,
  detail,
  className = '',
}: {
  source: SessionSource;
  findingsCount?: number;
  /** Extra sentence appended after the standard description. */
  detail?: string;
  className?: string;
}) {
  const token = SOURCE_TOKENS[source];
  const Icon = token.icon;
  const counted =
    source === 'simulated' && findingsCount != null
      ? ` ${findingsCount} canned finding${findingsCount === 1 ? '' : 's'}.`
      : '';

  return (
    <div
      className={`flex items-start gap-2 px-3 py-2 rounded-lg ${className}`}
      style={{
        backgroundColor: withOpacity(token.color, OPACITY_8),
        border: `1px solid ${withOpacity(token.color, OPACITY_20)}`,
      }}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: token.color }} />
      <p className="text-2xs text-text-muted-hover leading-relaxed">
        <span className="font-semibold" style={{ color: token.color }}>{token.label}</span>
        {' — '}
        {SOURCE_DESCRIPTIONS[source]}
        {counted}
        {detail ? ` ${detail}` : ''}
      </p>
    </div>
  );
}

/**
 * Aggregate form for figures rolled up across many sessions (avg score, trend).
 * `'mixed'` is called out explicitly rather than rounded to either side — an
 * average that blends measured and simulated rows is its own thing.
 */
export function AggregateProvenanceNotice({
  scoreSource,
  sessionCount,
  what,
  className = '',
}: {
  /** Absent/unknown provenance is read as 'simulated' — never as measured. */
  scoreSource: ScoreSource | null | undefined;
  sessionCount?: number;
  /** What the figure is, e.g. "This average" / "This trend". */
  what: string;
  className?: string;
}) {
  if (scoreSource === 'external') {
    return (
      <ProvenanceNotice
        source="external"
        detail={`${what} covers ${sessionCount ?? 0} measured session${sessionCount === 1 ? '' : 's'}.`}
        className={className}
      />
    );
  }

  if (scoreSource === 'mixed') {
    return (
      <div
        className={`flex items-start gap-2 px-3 py-2 rounded-lg ${className}`}
        style={{
          backgroundColor: withOpacity(ACCENT_PURPLE, OPACITY_8),
          border: `1px solid ${withOpacity(ACCENT_PURPLE, OPACITY_20)}`,
        }}
      >
        <p className="text-2xs text-text-muted-hover leading-relaxed">
          <span className="font-semibold" style={{ color: ACCENT_PURPLE }}>Partly simulated</span>
          {' — '}
          {what} blends sessions measured by a real harness with sessions produced by
          the dev-fixture simulator. Open a session to see which it is.
        </p>
      </div>
    );
  }

  return (
    <ProvenanceNotice
      source="simulated"
      detail={
        sessionCount != null
          ? `${what} covers ${sessionCount} simulated session${sessionCount === 1 ? '' : 's'}; none of them measured a build.`
          : `${what} did not measure a build.`
      }
      className={className}
    />
  );
}

/**
 * Accessible-name qualifier for a `ScoreRing` whose value came from simulated
 * data. The ring primitive is shared and read-only here, so provenance rides in
 * on `ariaLabel` — a screen-reader user must not hear a bare "Score: 74 out of
 * 100" for a number nothing measured.
 */
export function scoreRingLabel(value: number, source: SessionSource, what = 'Score'): string {
  return source === 'external'
    ? `${what}: ${Math.round(value)} out of 100, measured`
    : `Simulated ${what.toLowerCase()}: ${Math.round(value)} out of 100 — not measured, derived from canned findings`;
}

/** `scoreRingLabel` for a session object, applying the safe provenance default. */
export function sessionScoreRingLabel(
  value: number,
  session: { source?: SessionSource } | null | undefined,
  what = 'Score',
): string {
  return scoreRingLabel(value, resolveSessionSource(session), what);
}
