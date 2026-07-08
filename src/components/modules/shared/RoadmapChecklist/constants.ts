import {
  MODULE_COLORS, STATUS_INFO, OPACITY_8, OPACITY_30,
} from '@/lib/chart-colors';
import type { PatternSuggestion } from '@/types/pattern-library';
import type { VerificationInfo } from '@/stores/moduleStore';
import type { Priority } from './types';

export const NOTE_ACCENT_COLOR = MODULE_COLORS.content;

export const EMPTY_PROGRESS: Record<string, boolean> = {};
export const EMPTY_SUGGESTIONS: PatternSuggestion[] = [];
export const EMPTY_VERIFICATION: Record<string, VerificationInfo> = {};

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; border: string }> = {
  none:          { label: 'No priority', color: 'transparent', bg: 'transparent', border: 'transparent' },
  critical:     { label: 'Critical',     color: MODULE_COLORS.evaluator, bg: `${MODULE_COLORS.evaluator}${OPACITY_8}`, border: `${MODULE_COLORS.evaluator}${OPACITY_30}` },
  important:    { label: 'Important',    color: MODULE_COLORS.content, bg: `${MODULE_COLORS.content}${OPACITY_8}`, border: `${MODULE_COLORS.content}${OPACITY_30}` },
  'nice-to-have': { label: 'Nice to Have', color: STATUS_INFO, bg: `${STATUS_INFO}${OPACITY_8}`, border: `${STATUS_INFO}${OPACITY_30}` },
};

export const PRIORITY_OPTIONS: Priority[] = ['none', 'critical', 'important', 'nice-to-have'];
