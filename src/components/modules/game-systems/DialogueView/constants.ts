import {
  Swords, Package, MousePointerClick, MapPin, MessageSquare, Users, Target,
} from 'lucide-react';
import type { GeneratedQuest, QuestCategory } from '@/types/quest-generation';
import { MODULE_COLORS, STATUS_SUCCESS } from '@/lib/chart-colors';

// ── Stable empty refs ──

export const EMPTY_QUESTS: GeneratedQuest[] = [];
export const EMPTY_NOTES: string[] = [];

// ── Config ──

export const ACCENT = MODULE_COLORS.systems;

export const CATEGORY_LABELS: Record<QuestCategory, { label: string; color: string }> = {
  main: { label: 'Main', color: MODULE_COLORS.content },
  side: { label: 'Side', color: MODULE_COLORS.core },
  bounty: { label: 'Bounty', color: MODULE_COLORS.evaluator },
  exploration: { label: 'Exploration', color: STATUS_SUCCESS },
  fetch: { label: 'Fetch', color: MODULE_COLORS.systems },
};

export const OBJ_ICONS: Record<string, typeof Swords> = {
  kill: Swords,
  collect: Package,
  interact: MousePointerClick,
  'reach-location': MapPin,
  escort: Users,
  defend: Target,
  talk: MessageSquare,
};

// ── Difficulty pips ──

export const DIFFICULTY_COLORS = [
  'var(--accent-green, #22c55e)',   // Lv1
  'var(--accent-green, #84cc16)',   // Lv2
  'var(--accent-yellow, #eab308)', // Lv3
  'var(--accent-orange, #f97316)', // Lv4
  'var(--accent-red, #ef4444)',    // Lv5
] as const;

export const MAX_PIPS = 5;
