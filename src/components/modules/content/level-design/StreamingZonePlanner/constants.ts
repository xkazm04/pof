import { STATUS_INFO, STATUS_SUCCESS, ACCENT_VIOLET, STATUS_ERROR, STATUS_BLOCKER, STATUS_WARNING, STATUS_SUBDUED, ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';
import { ZONE_TYPE_LABELS } from '@/lib/level-design/streaming-plan';
import type { ZoneType, LoadPriority, TransitionStyle } from './types';

// ── Constants ──

export const CELL_SIZE = 72;

export const ZONE_TYPES: Record<ZoneType, { color: string; label: string; letter: string }> = {
  'town': { color: STATUS_INFO, label: ZONE_TYPE_LABELS['town'], letter: 'T' },
  'forest': { color: STATUS_SUCCESS, label: ZONE_TYPE_LABELS['forest'], letter: 'F' },
  'ruins': { color: ACCENT_VIOLET, label: ZONE_TYPE_LABELS['ruins'], letter: 'R' },
  'catacombs': { color: STATUS_SUBDUED, label: ZONE_TYPE_LABELS['catacombs'], letter: 'C' },
  'boss-arena': { color: STATUS_ERROR, label: ZONE_TYPE_LABELS['boss-arena'], letter: 'B' },
  'hub': { color: ACCENT_CYAN_LIGHT, label: ZONE_TYPE_LABELS['hub'], letter: 'H' },
  'dungeon': { color: STATUS_BLOCKER, label: ZONE_TYPE_LABELS['dungeon'], letter: 'D' },
  'custom': { color: 'var(--text-muted)', label: ZONE_TYPE_LABELS['custom'], letter: '?' },
};

export const PRIORITY_COLORS: Record<LoadPriority, string> = {
  always: STATUS_ERROR,
  high: STATUS_WARNING,
  normal: STATUS_INFO,
  low: 'var(--text-muted)',
};

// ── Transition style config ──

export const TRANSITION_STYLES: Record<TransitionStyle, { color: string; label: string }> = {
  seamless: { color: STATUS_SUCCESS, label: 'Seamless' },
  'loading-screen': { color: STATUS_ERROR, label: 'Loading' },
  fade: { color: ACCENT_VIOLET, label: 'Fade' },
  portal: { color: STATUS_WARNING, label: 'Portal' },
};
