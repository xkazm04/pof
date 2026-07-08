import type { ModuleHealthStatus } from '@/types/project-health';
import { ACCENT_EMERALD, STATUS_WARNING, STATUS_ERROR, STATUS_NEUTRAL } from '@/lib/chart-colors';

// ── Constants ───────────────────────────────────────────────────────────────

export const STATUS_COLORS: Record<ModuleHealthStatus, string> = {
  healthy: ACCENT_EMERALD,
  warning: STATUS_WARNING,
  critical: STATUS_ERROR,
  'not-started': '#4b5563',
};

export const STATUS_BADGE: Record<ModuleHealthStatus, 'success' | 'warning' | 'error' | 'default'> = {
  healthy: 'success',
  warning: 'warning',
  critical: 'error',
  'not-started': 'default',
};

export const SIGNAL_COLORS: Record<string, string> = {
  healthy: ACCENT_EMERALD,
  warning: STATUS_WARNING,
  critical: STATUS_ERROR,
  inactive: STATUS_NEUTRAL,
};
