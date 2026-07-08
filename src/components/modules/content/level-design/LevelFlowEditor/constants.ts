import type { RoomType, DifficultyLevel } from '@/types/level-design';
import type { PacingSeverity } from '@/lib/level-design/pacing-linter';
import {
  STATUS_ERROR, STATUS_SUCCESS, STATUS_LIME, STATUS_WARNING, STATUS_BLOCKER, STATUS_INFO, STATUS_SUBDUED,
  ACCENT_VIOLET, ACCENT_EMERALD, ACCENT_PINK, ACCENT_CYAN_LIGHT,
} from '@/lib/chart-colors';

// ── Constants ──

export const ROOM_W = 160;
export const ROOM_H = 80;

export const ROOM_TYPE_CONFIG: Record<RoomType, { color: string; label: string }> = {
  combat: { color: STATUS_ERROR, label: 'Combat' },
  puzzle: { color: ACCENT_VIOLET, label: 'Puzzle' },
  exploration: { color: ACCENT_EMERALD, label: 'Exploration' },
  boss: { color: STATUS_WARNING, label: 'Boss' },
  safe: { color: STATUS_INFO, label: 'Safe Zone' },
  transition: { color: STATUS_SUBDUED, label: 'Transition' },
  cutscene: { color: ACCENT_PINK, label: 'Cutscene' },
  hub: { color: ACCENT_CYAN_LIGHT, label: 'Hub' },
};

export const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  1: STATUS_SUCCESS,
  2: STATUS_LIME,
  3: STATUS_WARNING,
  4: STATUS_BLOCKER,
  5: STATUS_ERROR,
};

export const SEVERITY_COLORS: Record<PacingSeverity, string> = {
  info: STATUS_INFO,
  warning: STATUS_WARNING,
  critical: STATUS_ERROR,
};

export const SEVERITY_RANK: Record<PacingSeverity, number> = {
  info: 1,
  warning: 2,
  critical: 3,
};
