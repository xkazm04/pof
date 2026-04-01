import { AlertOctagon, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import type { FindingSeverity, FindingCategory } from '@/types/game-director';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO, STATUS_BLOCKER,
  OPACITY_8, OPACITY_12, OPACITY_20,
} from '@/lib/chart-colors';

export const SEVERITY_STYLES: Record<FindingSeverity, { icon: typeof AlertOctagon; color: string; bg: string; border: string }> = {
  critical: { icon: AlertOctagon, color: STATUS_ERROR, bg: `${STATUS_ERROR}${OPACITY_8}`, border: `${STATUS_ERROR}${OPACITY_20}` },
  high: { icon: AlertTriangle, color: STATUS_BLOCKER, bg: `${STATUS_BLOCKER}${OPACITY_8}`, border: `${STATUS_BLOCKER}${OPACITY_20}` },
  medium: { icon: Info, color: STATUS_WARNING, bg: `${STATUS_WARNING}${OPACITY_8}`, border: `${STATUS_WARNING}${OPACITY_20}` },
  low: { icon: Info, color: STATUS_INFO, bg: `${STATUS_INFO}${OPACITY_8}`, border: `${STATUS_INFO}${OPACITY_20}` },
  positive: { icon: CheckCircle2, color: STATUS_SUCCESS, bg: `${STATUS_SUCCESS}${OPACITY_8}`, border: `${STATUS_SUCCESS}${OPACITY_20}` },
};

/** Denser bg variant used by regression tracker (OPACITY_12, no border). */
export const SEVERITY_STYLES_DENSE: Record<FindingSeverity, { icon: typeof AlertOctagon; color: string; bg: string }> = {
  critical: { icon: AlertOctagon, color: STATUS_ERROR, bg: `${STATUS_ERROR}${OPACITY_12}` },
  high: { icon: AlertTriangle, color: STATUS_BLOCKER, bg: `${STATUS_BLOCKER}${OPACITY_12}` },
  medium: { icon: Info, color: STATUS_WARNING, bg: `${STATUS_WARNING}${OPACITY_12}` },
  low: { icon: Info, color: STATUS_INFO, bg: `${STATUS_INFO}${OPACITY_12}` },
  positive: { icon: CheckCircle2, color: STATUS_SUCCESS, bg: `${STATUS_SUCCESS}${OPACITY_12}` },
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
