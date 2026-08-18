import { AlertTriangle, AlertCircle, Clock, Info, HelpCircle } from 'lucide-react';
import type {
  ComplianceConfidence, EvidenceFreshness, GapSeverity, GapDirection,
} from '@/types/gdd-compliance';
import {
  SEVERITY_TOKENS, ACCENT_VIOLET, ACCENT_CYAN_LIGHT,
  type SeverityToken,
} from '@/lib/chart-colors';

// Gap severities use the shared SEVERITY_TOKENS map so a critical gap matches a
// critical finding in Deep Eval / the Archeologist (major→high, minor→low).
export const SEVERITY_CONFIG: Record<GapSeverity, SeverityToken & { icon: typeof AlertTriangle; label: string }> = {
  critical: { icon: AlertCircle, label: 'Critical', ...SEVERITY_TOKENS.critical },
  major: { icon: AlertTriangle, label: 'Major', ...SEVERITY_TOKENS.major },
  minor: { icon: Info, label: 'Minor', ...SEVERITY_TOKENS.minor },
  info: { icon: Info, label: 'Info', ...SEVERITY_TOKENS.info },
};

// ── Evidence confidence ──────────────────────────────────────────────────────
//
// A compliance score is only as good as the fraction of the surface that was
// actually evaluated. `none` is not a bad score — it is the absence of one, and
// is rendered as a word (UNMEASURED), never as a number or a colour band, so it
// cannot be read as "evaluated, and fine".

export const CONFIDENCE_META: Record<ComplianceConfidence, { label: string; color: string; note: string }> = {
  none: {
    label: 'UNMEASURED',
    color: 'var(--text-subtle)',
    note: 'No feature here has a verdict, so there is no compliance score to read.',
  },
  low: {
    label: 'Low confidence',
    color: SEVERITY_TOKENS.high.color,
    note: 'Under a third of the declared features have been evaluated.',
  },
  moderate: {
    label: 'Moderate confidence',
    color: SEVERITY_TOKENS.medium.color,
    note: 'Most but not all of the declared features have been evaluated.',
  },
  high: {
    label: 'High confidence',
    color: SEVERITY_TOKENS.positive.color,
    note: 'At least three quarters of the declared features have been evaluated.',
  },
};

/** Icon for the unmeasured/no-evidence state, kept beside the severity icons. */
export const UNMEASURED_ICON = HelpCircle;

// ── Evidence freshness ───────────────────────────────────────────────────────
//
// Distinct from the audit timestamp. The audit is regenerated on every button
// press, so "Last audit: just now" was the only freshness signal on screen even
// when every feature verdict behind it was months old. These read the age of the
// EVIDENCE, and `unknown` is never quietly rounded up to fresh.

export const FRESHNESS_META: Record<EvidenceFreshness, { label: string; color: string }> = {
  unknown: { label: 'Evidence age unknown', color: 'var(--text-subtle)' },
  fresh: { label: 'Fresh evidence', color: SEVERITY_TOKENS.positive.color },
  aging: { label: 'Aging evidence', color: SEVERITY_TOKENS.medium.color },
  stale: { label: 'Stale evidence', color: SEVERITY_TOKENS.high.color },
};

export const FRESHNESS_ICON = Clock;

export const EFFORT_LABELS: Record<string, string> = {
  trivial: '< 1h',
  small: '1-4h',
  medium: '1-3 days',
  large: '1+ week',
};

// ── Design-vs-code split visual language ─────────────────────────────────────
//
// Every gap has two sides — what the GDD (design) specifies vs. what the code
// implements — and a *lean* showing which side is ahead. Each side gets one fixed
// semantic color: violet = design / intent, cyan = code / implementation. Both are
// drawn from *outside* the severity ramp (red/orange/amber/blue) so a split never
// reads as a severity. The same `GapSplitIndicator` + side colors are reused on the
// collapsed row and the expanded panel (incl. the Design says / Code says cards), so
// the directional metaphor repeats and every gap is legible at a glance.

export type GapSide = 'design' | 'code';

export const SIDE: Record<GapSide, { color: string; label: string }> = {
  design: { color: ACCENT_VIOLET, label: 'Design' },
  code: { color: ACCENT_CYAN_LIGHT, label: 'Code' },
};

export const DIRECTION_META: Record<GapDirection, {
  /** Which side is ahead — `null` when nothing was measured, so neither is. */
  ahead: GapSide | null;
  short: string;
  /** Full sentence — drives the indicator's aria-label + the panel banner. */
  label: string;
  /** Plain-language consequence, for non-technical triage. */
  consequence: string;
}> = {
  'design-ahead': {
    ahead: 'design',
    short: 'Design ahead',
    label: 'Design is ahead of code',
    consequence: 'The design specifies more than the code implements — code needs to catch up.',
  },
  'code-ahead': {
    ahead: 'code',
    short: 'Code ahead',
    label: 'Code is ahead of design',
    consequence: 'The code implements more than the design documents — update the GDD to match.',
  },
  'unmeasured': {
    ahead: null,
    short: 'No evidence',
    label: 'Neither side is verified — no evidence',
    consequence: 'Nothing has been scanned here, so design and code cannot be compared at all.',
  },
};
