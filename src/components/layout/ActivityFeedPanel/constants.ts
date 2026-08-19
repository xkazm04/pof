import {
  CheckCircle2,
  XCircle,
  TrendingUp,
  Hammer,
  AlertTriangle,
  CheckSquare,
  Unplug,
} from 'lucide-react';
import type { ActivityEventType } from '@/stores/activityFeedStore';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, MODULE_COLORS } from '@/lib/chart-colors';

// ── Layout constants ──

/** Fixed width of the feed (px) — inline column when wide, drawer when narrow. */
export const PANEL_WIDTH = 320;
/**
 * At or below this viewport width the feed promotes from a layout-shifting inline
 * column to an overlay drawer, so narrow screens aren't crushed by the 320px rail.
 * Mirrors the `/layout` shell's collapse breakpoint.
 */
export const OVERLAY_BREAKPOINT = 1100;

// ── Event type config ──

export const EVENT_CONFIG: Record<ActivityEventType, { icon: typeof CheckCircle2; color: string; label: string }> = {
  'cli-complete': { icon: CheckCircle2, color: STATUS_SUCCESS, label: 'Task Complete' },
  'cli-error': { icon: XCircle, color: STATUS_ERROR, label: 'Task Failed' },
  'quality-change': { icon: TrendingUp, color: STATUS_WARNING, label: 'Quality' },
  'build-result': { icon: Hammer, color: MODULE_COLORS.core, label: 'Build' },
  'evaluator-recommendation': { icon: AlertTriangle, color: MODULE_COLORS.evaluator, label: 'Recommendation' },
  'checklist-progress': { icon: CheckSquare, color: STATUS_SUCCESS, label: 'Progress' },
  'shell-eviction': { icon: Unplug, color: STATUS_ERROR, label: 'Torn Down' },
};
