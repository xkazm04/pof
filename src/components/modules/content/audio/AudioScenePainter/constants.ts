import {
  STATUS_INFO, ACCENT_VIOLET, STATUS_SUCCESS, STATUS_BLOCKER,
  STATUS_WARNING, ACCENT_EMERALD, ACCENT_PINK,
  STATUS_SUBDUED, ACCENT_CYAN_LIGHT,
  MODULE_COLORS,
} from '@/lib/chart-colors';
import type { EmitterType } from '@/types/audio-scene';

export const MINIMAP_W = 120;
export const MINIMAP_H = 90;

export const CHROME_ACCENT = MODULE_COLORS.content;

// ── Constants ──

export const ZONE_COLORS: Record<string, string> = {
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

export const EMITTER_COLORS: Record<EmitterType, string> = {
  ambient: STATUS_SUCCESS,
  point: STATUS_INFO,
  loop: ACCENT_VIOLET,
  oneshot: STATUS_WARNING,
  music: ACCENT_PINK,
};
