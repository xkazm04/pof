import {
  AlertOctagon, AlertTriangle, Info, ArrowDown, CheckCircle2,
  Settings, Play, Activity, Search,
  ShieldCheck, BellOff, EyeOff, Clock, type LucideIcon,
} from 'lucide-react';
import type { FindingSeverity, FindingCategory, PlaytestStatus, TriageStatus } from '@/types/game-director';
import type { RegressionStatus } from '@/types/regression-tracker';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, STATUS_BLOCKER, ACCENT_PURPLE,
  OPACITY_8, OPACITY_12, OPACITY_20,
} from '@/lib/chart-colors';

/** Shared shape for severity, session status, and regression status tokens. */
export interface SemanticToken {
  icon: LucideIcon;
  color: string;
  label: string;
}

export type SemanticDensity = 'default' | 'dense';

// Each severity carries a DISTINCT icon — never color alone — so the level is
// legible to colorblind users (WCAG 1.4.1). `medium` (Info, amber) and `low`
// (ArrowDown, blue) previously shared the Info icon and differed only by hue.
export const SEVERITY_TOKENS: Record<FindingSeverity, SemanticToken> = {
  critical: { icon: AlertOctagon, color: STATUS_ERROR, label: 'Critical' },
  high: { icon: AlertTriangle, color: STATUS_BLOCKER, label: 'High' },
  medium: { icon: Info, color: STATUS_WARNING, label: 'Medium' },
  low: { icon: ArrowDown, color: STATUS_INFO, label: 'Low' },
  positive: { icon: CheckCircle2, color: STATUS_SUCCESS, label: 'Positive' },
};

/** Display order for severity, most → least urgent (legends, breakdowns). */
export const SEVERITY_ORDER: FindingSeverity[] = ['critical', 'high', 'medium', 'low', 'positive'];

/**
 * Plain-language, one-line explanation of each severity for the dismissible
 * severity legend — lets non-technical users grasp finding levels without
 * guessing from color or icon alone.
 */
export const SEVERITY_DESCRIPTIONS: Record<FindingSeverity, string> = {
  critical: 'Game-breaking — crashes or blocks play',
  high: 'Major problem that hurts the experience',
  medium: 'Noticeable issue worth fixing soon',
  low: 'Minor polish or an edge case',
  positive: 'Something that works well',
};

export const SESSION_STATUS_TOKENS: Record<PlaytestStatus, SemanticToken> = {
  configuring: { icon: Settings, color: 'var(--text-muted)', label: 'Configuring' },
  launching: { icon: Play, color: STATUS_WARNING, label: 'Launching' },
  playing: { icon: Activity, color: STATUS_INFO, label: 'Playing' },
  analyzing: { icon: Search, color: ACCENT_PURPLE, label: 'Analyzing' },
  complete: { icon: CheckCircle2, color: STATUS_SUCCESS, label: 'Complete' },
  failed: { icon: AlertOctagon, color: STATUS_ERROR, label: 'Failed' },
};

export const REGRESSION_STATUS_TOKENS: Record<RegressionStatus, SemanticToken> = {
  open: { icon: AlertTriangle, color: STATUS_BLOCKER, label: 'Open' },
  fixed: { icon: CheckCircle2, color: STATUS_SUCCESS, label: 'Fixed' },
  regressed: { icon: AlertOctagon, color: STATUS_ERROR, label: 'Regressed' },
  resolved: { icon: CheckCircle2, color: STATUS_INFO, label: 'Resolved' },
};

/**
 * Card-level surface styling derived from a severity color. Density `default`
 * yields a subtle bg + a colored border (for finding cards / breakdown tiles);
 * `dense` yields a stronger bg with no border (for inline icon wrappers).
 */
export function severitySurface(
  severity: FindingSeverity,
  density: SemanticDensity = 'default',
): { backgroundColor: string; borderColor: string } {
  const color = SEVERITY_TOKENS[severity].color;
  if (density === 'dense') {
    return { backgroundColor: `${color}${OPACITY_12}`, borderColor: 'transparent' };
  }
  return { backgroundColor: `${color}${OPACITY_8}`, borderColor: `${color}${OPACITY_20}` };
}

export const TRIAGE_TOKENS: Record<TriageStatus, SemanticToken> = {
  active: { icon: Activity, color: 'var(--text-muted)', label: 'Active' },
  confirmed: { icon: ShieldCheck, color: STATUS_BLOCKER, label: 'Confirmed' },
  'false-positive': { icon: BellOff, color: STATUS_INFO, label: 'False positive' },
  ignore: { icon: EyeOff, color: 'var(--text-muted)', label: 'Ignored' },
  snooze: { icon: Clock, color: ACCENT_PURPLE, label: 'Snoozed' },
};

export const CATEGORY_LABELS: Record<FindingCategory, string> = {
  'visual-glitch': 'Visual Glitch',
  'animation-issue': 'Animation',
  'gameplay-feel': 'Gameplay Feel',
  'ux-problem': 'UX Problem',
  'performance': 'Performance',
  'crash-bug': 'Crash/Bug',
  'level-pacing': 'Level Pacing',
  'audio-issue': 'Audio',
  'save-load': 'Save/Load',
  'ai-behavior': 'AI Behavior',
  'positive-feedback': 'Positive',
};
