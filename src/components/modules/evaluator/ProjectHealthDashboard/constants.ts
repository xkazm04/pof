import { MODULE_COLORS, STATUS_ERROR, STATUS_BLOCKER, STATUS_WARNING, OPACITY_10 } from '@/lib/chart-colors';

export const EVAL_ACCENT = MODULE_COLORS.evaluator;

// ── Priority color ──

export const PRIORITY_COLORS: Record<string, { text: string; bg: string; border: string; badge: string }> = {
  critical: { text: STATUS_ERROR, bg: STATUS_ERROR + OPACITY_10, border: STATUS_ERROR + '25', badge: STATUS_ERROR + '15' },
  high: { text: STATUS_BLOCKER, bg: STATUS_BLOCKER + OPACITY_10, border: STATUS_BLOCKER + '25', badge: STATUS_BLOCKER + '15' },
  medium: { text: STATUS_WARNING, bg: STATUS_WARNING + OPACITY_10, border: STATUS_WARNING + '25', badge: STATUS_WARNING + '15' },
  // A CSS variable cannot take a hex alpha suffix, so `low` mixes instead.
  low: {
    text: 'var(--text-muted)',
    bg: 'color-mix(in srgb, var(--text-muted) 7%, transparent)',
    border: 'color-mix(in srgb, var(--text-muted) 15%, transparent)',
    badge: 'color-mix(in srgb, var(--text-muted) 8%, transparent)',
  },
};

// ── Radar chart geometry helpers ──

export const RADAR_CX = 160;
export const RADAR_CY = 140;
export const RADAR_R = 110;
export const RADAR_RINGS = 5; // 20, 40, 60, 80, 100
