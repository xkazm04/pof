import { MODULE_COLORS, STATUS_ERROR, STATUS_BLOCKER, STATUS_WARNING, OPACITY_10 } from '@/lib/chart-colors';

export const EVAL_ACCENT = MODULE_COLORS.evaluator;

// ── Priority color ──

export const PRIORITY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  critical: { text: STATUS_ERROR, bg: STATUS_ERROR + OPACITY_10, border: STATUS_ERROR + '25' },
  high: { text: STATUS_BLOCKER, bg: STATUS_BLOCKER + OPACITY_10, border: STATUS_BLOCKER + '25' },
  medium: { text: STATUS_WARNING, bg: STATUS_WARNING + OPACITY_10, border: STATUS_WARNING + '25' },
  low: { text: 'var(--text-muted)', bg: 'var(--text-muted)12', border: 'var(--text-muted)25' },
};

// ── Radar chart geometry helpers ──

export const RADAR_CX = 160;
export const RADAR_CY = 140;
export const RADAR_R = 110;
export const RADAR_RINGS = 5; // 20, 40, 60, 80, 100
