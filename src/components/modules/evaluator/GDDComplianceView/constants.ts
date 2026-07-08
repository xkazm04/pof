import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { GapSeverity, GapDirection } from '@/types/gdd-compliance';
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
  ahead: GapSide;
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
};
