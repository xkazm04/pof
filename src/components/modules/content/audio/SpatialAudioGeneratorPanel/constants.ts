import { MODULE_COLORS } from '@/lib/constants';
import {
  STATUS_SUCCESS, STATUS_NEUTRAL, STATUS_WARNING,
  ACCENT_PURPLE_BOLD, ACCENT_PINK, ACCENT_EMERALD_DARK,
} from '@/lib/chart-colors';

export const ROOM_TYPE_COLORS: Record<string, string> = {
  combat: MODULE_COLORS.evaluator,
  boss: STATUS_WARNING,
  puzzle: ACCENT_PURPLE_BOLD,
  exploration: STATUS_SUCCESS,
  safe: MODULE_COLORS.core,
  transition: STATUS_NEUTRAL,
  cutscene: ACCENT_PINK,
  hub: ACCENT_EMERALD_DARK,
};
