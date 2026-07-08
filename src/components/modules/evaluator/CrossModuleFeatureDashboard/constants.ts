import { FEATURE_STATUS_COLORS } from '@/lib/chart-colors';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { SubModuleId } from '@/types/modules';

export const ALL_MODULE_IDS = Object.keys(MODULE_FEATURE_DEFINITIONS) as SubModuleId[];

// ── Status colors ──

export const STATUS_COLORS = FEATURE_STATUS_COLORS;

export const STATUS_LABELS = {
  implemented: 'Implemented',
  improved: 'Improved',
  partial: 'Partial',
  missing: 'Missing',
  unknown: 'Unknown',
} as const;

export type StatusKey = keyof typeof STATUS_COLORS;
export const STATUS_KEYS: StatusKey[] = ['improved', 'implemented', 'partial', 'missing', 'unknown'];

// ── Category grouping ──

export const MODULE_CATEGORIES: Record<string, string> = {};
for (const id of ALL_MODULE_IDS) {
  if (id.startsWith('arpg-')) MODULE_CATEGORIES[id] = 'Core Engine';
  else if (['models', 'animations', 'materials', 'level-design', 'ui-hud', 'audio'].includes(id)) MODULE_CATEGORIES[id] = 'Content';
  else MODULE_CATEGORIES[id] = 'Game Systems';
}

export type SortKey = 'name' | 'completion' | 'missing';
