import {
  ScanSearch, AlertTriangle, AlertCircle, Info,
  Zap, Shield, Bug, Gauge,
} from 'lucide-react';
import { type EvalPass } from '@/lib/evaluator/module-eval-prompts';
import type { ScanFinding, ScanSeverity } from '@/types/scan';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_IMPROVED,
  ACCENT_ORANGE, OPACITY_8, STATUS_MUTED,
} from '@/lib/chart-colors';

export const SEVERITY_CONFIG: Record<ScanSeverity, { color: string; bg: string; icon: typeof AlertTriangle }> = {
  critical: { color: MODULE_COLORS.evaluator, bg: `${MODULE_COLORS.evaluator}${OPACITY_8}`, icon: AlertTriangle },
  high: { color: ACCENT_ORANGE, bg: `${ACCENT_ORANGE}${OPACITY_8}`, icon: AlertCircle },
  medium: { color: STATUS_WARNING, bg: `${STATUS_WARNING}${OPACITY_8}`, icon: Info },
  low: { color: STATUS_MUTED, bg: `${STATUS_MUTED}${OPACITY_8}`, icon: Info },
};

export const EFFORT_CONFIG: Record<string, { color: string; label: string }> = {
  trivial: { color: STATUS_SUCCESS, label: '~5m' },
  small: { color: STATUS_IMPROVED, label: '~30m' },
  medium: { color: STATUS_WARNING, label: '~2h' },
  large: { color: STATUS_ERROR, label: '>2h' },
};

export const PASS_ICONS: Record<EvalPass, typeof Shield> = {
  'ground-truth': ScanSearch,
  structure: Shield,
  quality: Bug,
  performance: Gauge,
  'combat-trace': Zap,
};

export const ACCENT = MODULE_COLORS.core;
export const EMPTY_FINDINGS: ScanFinding[] = [];
