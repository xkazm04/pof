import {
  STATUS_INFO, ACCENT_VIOLET, STATUS_SUCCESS, STATUS_BLOCKER,
  STATUS_WARNING, ACCENT_EMERALD, ACCENT_PINK,
  STATUS_SUBDUED, ACCENT_CYAN_LIGHT,
  MODULE_COLORS,
} from '@/lib/chart-colors';
import type { EmitterType, ReverbPreset } from '@/types/audio-scene';

export const MINIMAP_W = 120;
export const MINIMAP_H = 90;

/** Screen pixels an item press must travel before it becomes a drag (below it: a click). */
export const DRAG_THRESHOLD_PX = 3;

export const CHROME_ACCENT = MODULE_COLORS.content;

// ── Constants ──

// Keyed by the ReverbPreset union, so a preset added to the type without a hue fails tsc.
export const ZONE_COLORS: Record<ReverbPreset, string> = {
  'none': 'var(--text-muted)',
  'small-room': STATUS_INFO,
  'large-hall': ACCENT_VIOLET,
  'cave': STATUS_SUBDUED,
  'outdoor': STATUS_SUCCESS,
  'underwater': ACCENT_CYAN_LIGHT,
  'metal-corridor': STATUS_BLOCKER,
  'stone-chamber': STATUS_WARNING,
  'forest': ACCENT_EMERALD,
  'custom': ACCENT_PINK,
};

/**
 * Colors a newly drawn zone cycles through: every preset hue EXCEPT `none`, whose
 * neutral `--text-muted` token means "no reverb preset" and would paint the first
 * drawn zone as if it were unconfigured.
 */
export const NEW_ZONE_PALETTE: string[] = Object.entries(ZONE_COLORS)
  .filter(([preset]) => preset !== 'none')
  .map(([, color]) => color);

export const EMITTER_COLORS: Record<EmitterType, string> = {
  ambient: STATUS_SUCCESS,
  point: STATUS_INFO,
  loop: ACCENT_VIOLET,
  oneshot: STATUS_WARNING,
  music: ACCENT_PINK,
};
