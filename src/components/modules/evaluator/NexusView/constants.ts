import { AlertTriangle, Eye, BookOpen, BarChart3, Swords } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_INFO, ACCENT_VIOLET, MODULE_COLORS } from '@/lib/chart-colors';
import type { NexusLayerId } from '@/lib/evaluator/nexus-signals';
import { TOPOLOGY_ROOMY } from '@/lib/topology/moduleGraph';

// ─── Node size of the roomy module topology (placement: @/lib/topology/moduleGraph) ──

export const { nodeW: NODE_W, nodeH: NODE_H } = TOPOLOGY_ROOMY;

// ─── Data layer toggle ─────────────────────────────────────────────────────

export type LayerId = NexusLayerId;

export interface LayerConfig {
  id: LayerId;
  label: string;
  color: string;
  icon: typeof Eye;
}

export const LAYERS: LayerConfig[] = [
  { id: 'patterns', label: 'Pattern Success', color: STATUS_SUCCESS, icon: BookOpen },
  { id: 'builds', label: 'Critical Findings', color: MODULE_COLORS.evaluator, icon: AlertTriangle },
  { id: 'sessions', label: 'Session Activity', color: STATUS_INFO, icon: BarChart3 },
  { id: 'genre', label: 'Genre Features', color: ACCENT_VIOLET, icon: Swords },
];

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
