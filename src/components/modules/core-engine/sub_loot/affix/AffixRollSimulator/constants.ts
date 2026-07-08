import { STATUS_WARNING, ACCENT_EMERALD, ACCENT_VIOLET } from '@/lib/chart-colors';

export const CATEGORY_COLORS: Record<string, string> = {
  Offensive: STATUS_WARNING,
  Defensive: ACCENT_EMERALD,
  Utility: ACCENT_VIOLET,
};

// Reel choreography: the three slots stop staggered left-to-right (ms from spin
// start) so a roll reads as "landing" one reel at a time with an ease-out settle.
export const REEL_STOP_MS = [400, 600, 800] as const;
// How fast a still-spinning slot cycles through random affix names.
export const REEL_CYCLE_MS = 80;
