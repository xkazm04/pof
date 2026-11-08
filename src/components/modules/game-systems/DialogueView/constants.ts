import {
  Swords, Package, MousePointerClick, MapPin, MessageSquare, Users, Target,
} from 'lucide-react';
import type { GeneratedQuest, QuestCategory } from '@/types/quest-generation';
import {
  MODULE_COLORS, STATUS_SUCCESS, STATUS_LIME, STATUS_WARNING, STATUS_BLOCKER, STATUS_ERROR,
} from '@/lib/chart-colors';

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

// The quality ramp reversed (easy = green, hardest = red). The old
// `var(--accent-*, #hex)` entries named CSS variables that are defined nowhere,
// so the raw hex fallbacks always rendered and bypassed the token set.
export const DIFFICULTY_COLORS = [
  STATUS_SUCCESS, // Lv1
  STATUS_LIME,    // Lv2
  STATUS_WARNING, // Lv3
  STATUS_BLOCKER, // Lv4
  STATUS_ERROR,   // Lv5
] as const;

export const MAX_PIPS = 5;
