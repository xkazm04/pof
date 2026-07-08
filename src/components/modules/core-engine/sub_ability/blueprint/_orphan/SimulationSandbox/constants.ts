import {
  STATUS_SUCCESS,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE,
  MODULE_COLORS,
} from '@/lib/chart-colors';
import type { AttrCategory } from './types';

/* ══════════════════════════════════════════════════════════════════════════
   SIMULATION ENGINE (pure functions)
   ══════════════════════════════════════════════════════════════════════════ */

export const SIM_STEP = 0.25; // seconds per tick
export const SIM_MAX_TIME = 30; // max simulation length

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */

export const CAT_COLORS: Record<AttrCategory, string> = {
  meta: ACCENT_CYAN,
  vital: STATUS_SUCCESS,
  primary: ACCENT_VIOLET,
  combat: ACCENT_ORANGE,
  progression: MODULE_COLORS.core,
};
