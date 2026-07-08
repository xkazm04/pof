import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_NEUTRAL } from '@/lib/chart-colors';

// ---------- Constants ----------

export const MINIMAP_W = 160;
export const MINIMAP_H = 110;

export const STATUS_DOT_COLORS: Record<string, string> = {
  implemented: STATUS_SUCCESS,
  partial: STATUS_WARNING,
  missing: STATUS_ERROR,
  unknown: STATUS_NEUTRAL,
};
