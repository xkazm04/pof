import { AlertTriangle, Eye, BookOpen, BarChart3, Swords } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_INFO, ACCENT_VIOLET, MODULE_COLORS } from '@/lib/chart-colors';
import type { ImplementationPattern } from '@/types/pattern-library';
import { TOPOLOGY_ROOMY } from '@/components/modules/evaluator/_shared/moduleTopology';

// ─── Layout constants (shared with DependencyGraph via _shared/moduleTopology) ──

export const { colWidth: COL_WIDTH, rowHeight: ROW_HEIGHT, nodeW: NODE_W, nodeH: NODE_H, padX: PAD_X, padY: PAD_Y } = TOPOLOGY_ROOMY;

// ─── Data layer toggle ─────────────────────────────────────────────────────

export type LayerId = 'patterns' | 'builds' | 'sessions' | 'genre';

export interface LayerConfig {
  id: LayerId;
  label: string;
  color: string;
  icon: typeof Eye;
}

export const LAYERS: LayerConfig[] = [
  { id: 'patterns', label: 'Pattern Success', color: STATUS_SUCCESS, icon: BookOpen },
  { id: 'builds', label: 'Build Health', color: MODULE_COLORS.evaluator, icon: AlertTriangle },
  { id: 'sessions', label: 'Session Activity', color: STATUS_INFO, icon: BarChart3 },
  { id: 'genre', label: 'Genre Features', color: ACCENT_VIOLET, icon: Swords },
];

// ─── Stable empty constants ────────────────────────────────────────────────

export const EMPTY_PATTERNS: ImplementationPattern[] = [];
export const EMPTY_HISTORY: { id: string; prompt: string; status: string; timestamp: number }[] = [];

// ─── Genre item → module mapping ───────────────────────────────────────────

export const ITEM_PREFIX_TO_MODULE: Record<string, string> = {
  ac: 'arpg-character',
  aa: 'arpg-animation',
  ag: 'arpg-gas',
  acb: 'arpg-combat',
  ae: 'arpg-enemy-ai',
  ai: 'arpg-inventory',
  al: 'arpg-loot',
  au: 'arpg-ui',
  ap: 'arpg-progression',
  aw: 'arpg-world',
  as: 'arpg-save',
  apl: 'arpg-polish',
};
