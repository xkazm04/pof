import { STATUS_ERROR, STATUS_INFO } from '@/lib/chart-colors';

export const RING_SIZE = 16;
export const RING_STROKE = 2;
export const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const SIDEBAR_MIN = 140;
export const SIDEBAR_MAX = 260;
export const SIDEBAR_DEFAULT = 180;
export const STORAGE_KEY = 'pof-sidebar-l2-width';

// Magnetic snap points + keyboard tuning for the resize handle
export const SNAP_POINTS: number[] = [140, 180, 220, 260];
export const SNAP_THRESHOLD = 8;   // px proximity that pulls the drag onto a snap point
export const SNAP_PULSE_MS = 120;  // border-bright "tick" duration when landing on a snap
export const KEYBOARD_STEP = 10;       // ArrowLeft/Right
export const KEYBOARD_STEP_SHIFT = 20; // Shift + ArrowLeft/Right

export const STATUS_COLORS = {
  failed: STATUS_ERROR,   // red — CLI task failed
  running: STATUS_INFO,  // blue — CLI task running
} as const;

export const WIDE_SIDEBAR_THRESHOLD = 200;
