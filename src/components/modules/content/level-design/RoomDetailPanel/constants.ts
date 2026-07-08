import {
  Swords, Puzzle, Compass, Crown, Shield, ArrowRightLeft, Film, Home,
} from 'lucide-react';
import type { RoomType, DifficultyLevel, PacingCurve } from '@/types/level-design';
import type { LucideIcon } from 'lucide-react';
import { STATUS_ERROR, ACCENT_VIOLET, ACCENT_EMERALD, STATUS_WARNING, STATUS_INFO, ACCENT_PINK, STATUS_SUCCESS, STATUS_LIME, STATUS_BLOCKER, STATUS_SUBDUED, ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';

export const ROOM_TYPE_CONFIG: Record<RoomType, { icon: LucideIcon; color: string; label: string }> = {
  combat: { icon: Swords, color: STATUS_ERROR, label: 'Combat' },
  puzzle: { icon: Puzzle, color: ACCENT_VIOLET, label: 'Puzzle' },
  exploration: { icon: Compass, color: ACCENT_EMERALD, label: 'Exploration' },
  boss: { icon: Crown, color: STATUS_WARNING, label: 'Boss' },
  safe: { icon: Shield, color: STATUS_INFO, label: 'Safe Zone' },
  transition: { icon: ArrowRightLeft, color: STATUS_SUBDUED, label: 'Transition' },
  cutscene: { icon: Film, color: ACCENT_PINK, label: 'Cutscene' },
  hub: { icon: Home, color: ACCENT_CYAN_LIGHT, label: 'Hub' },
};

export const ALL_ROOM_TYPES: RoomType[] = ['combat', 'puzzle', 'exploration', 'boss', 'safe', 'transition', 'cutscene', 'hub'];
export const ALL_PACING: PacingCurve[] = ['rest', 'buildup', 'rising', 'peak', 'falling'];
export const ALL_DIFFICULTIES: DifficultyLevel[] = [1, 2, 3, 4, 5];

export const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  1: STATUS_SUCCESS, 2: STATUS_LIME, 3: STATUS_WARNING, 4: STATUS_BLOCKER, 5: STATUS_ERROR,
};
