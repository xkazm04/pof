'use client';

import {
  Heart, AlertTriangle, TrendingUp, TrendingDown,
} from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  MODULE_COLORS,
} from '@/lib/chart-colors';
import type { FeedbackInsightSeverity } from '@/types/combat-simulator';

/* ── Accent ──────────────────────────────────────────────────────────── */

export const ACCENT = MODULE_COLORS.core;

/* ── Insight mappings ────────────────────────────────────────────────── */

export const INSIGHT_COLORS: Record<FeedbackInsightSeverity, string> = {
  positive: STATUS_SUCCESS,
  warning: STATUS_WARNING,
  critical: STATUS_ERROR,
};

export const INSIGHT_ICONS: Record<FeedbackInsightSeverity, typeof Heart> = {
  positive: TrendingUp,
  warning: AlertTriangle,
  critical: TrendingDown,
};

/* ── Scenario presets ────────────────────────────────────────────────── */

export const SCENARIO_PRESETS = [
  { id: 'grunt-pack', name: '3x Grunts', enemies: [{ archetypeId: 'melee-grunt', count: 3, level: 8 }] },
  { id: 'knight', name: '1x Knight', enemies: [{ archetypeId: 'elite-knight', count: 1, level: 10 }] },
  { id: 'mixed', name: 'Knight + Mage', enemies: [{ archetypeId: 'elite-knight', count: 1, level: 10 }, { archetypeId: 'ranged-caster', count: 1, level: 10 }] },
  { id: 'brute', name: '1x Stone Brute', enemies: [{ archetypeId: 'brute', count: 1, level: 12 }] },
];

/* ── Severity helpers ────────────────────────────────────────────────── */

export const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, positive: 2 };

export const SEVERITY_FILTERS: { key: string; label: string; color: string }[] = [
  { key: 'critical', label: 'Critical', color: STATUS_ERROR },
  { key: 'warning', label: 'Warning', color: STATUS_WARNING },
  { key: 'positive', label: 'Positive', color: STATUS_SUCCESS },
];

/* ── MiniViz type ────────────────────────────────────────────────────── */

export type MiniViz =
  | { type: 'donut'; ratio: number }
  | { type: 'bar'; ratio: number }
  | { type: 'gauge'; ratio: number };

/* ── Format helpers ──────────────────────────────────────────────────── */

export function formatMetricValue(value: number, unit?: string): string {
  if (typeof value === 'number' && value < 1 && unit === '%') return `${(value * 100).toFixed(1)}%`;
  return `${value.toFixed(1)}${unit ?? ''}`;
}

export function formatDelta(delta: number, unit?: string): string {
  if (typeof delta === 'number' && Math.abs(delta) < 1 && unit === '%') return `${(delta * 100).toFixed(1)}%`;
  return delta.toFixed(1);
}
